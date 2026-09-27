import type { FlashcardReviewRepository } from '../../../domain/flashcards/repositories/FlashcardReviewRepository';
import type { ReviewState } from '../../../domain/flashcards/engines/scheduler';
import { db as defaultDb, type LunaClairDatabase } from '../schema/LunaClairDatabase';

export class DexieFlashcardReviewRepository implements FlashcardReviewRepository {
    /**
     * The database this adapter writes to. Injected rather than reached for as
     * a module singleton so a caller that already owns a transaction on its OWN
     * `LunaClairDatabase` (a multi-table cascade in a test's isolated database,
     * say) can delegate its review clear here and have the tombstone join that
     * transaction. Dexie reuses a parent transaction when the requested scope is
     * a subset of the running one, which is exactly `flashcardReviews` +
     * `syncQueue` inside a wider removal transaction.
     */
    private readonly db: LunaClairDatabase;

    constructor(db: LunaClairDatabase = defaultDb) {
        this.db = db;
    }

    async getAllReviews(signal?: AbortSignal): Promise<ReviewState[]> {
        if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
        return this.db.flashcardReviews.toArray();
    }

    async getByKeys(keys: string[]): Promise<ReviewState[]> {
        if (keys.length === 0) return [];
        return this.db.flashcardReviews.where('key').anyOf(keys).toArray();
    }

    async getByMaterial(materialId: string): Promise<ReviewState[]> {
        if (!materialId) return [];
        return this.db.flashcardReviews.where('materialId').equals(materialId).toArray();
    }

    async save(reviews: ReviewState[]): Promise<void> {
        if (reviews.length === 0) return;
        const now = new Date().toISOString();
        await this.db.transaction('rw', [this.db.flashcardReviews, this.db.syncQueue], async () => {
            await this.db.flashcardReviews.bulkPut(reviews);
            const queueItems = reviews.map((r) => ({
                id: crypto.randomUUID(),
                clientMutationId: crypto.randomUUID(),
                entityType: 'flashcardReview' as const,
                entityId: r.key,
                operation: 'UPSERT' as const,
                clientTimestamp: r.lastReviewedAt ?? now,
                payload: r,
                status: 'pending' as const,
                createdAt: now,
                retryCount: 0,
            }));
            await this.db.syncQueue.bulkPut(queueItems);
        });
    }

    /**
     * Clears review state, and tombstones each cleared key in the sync outbox in
     * the same transaction as the row delete.
     *
     * A bare local delete is not a delete: the remote row stays live, the next
     * pull restores it, and the schedule resurrects with stale SM-2 state. The
     * tombstone is what makes a local clear authoritative — the Worker applies
     * it as Model A LWW (`flashcardReview` is an `lww` entity), stamps
     * `user_entities.deleted_at`, and every other device drops the row when the
     * `DELETE` change comes back through pull.
     *
     * The mutation mirrors `save`: same transaction scope, same `entityId`
     * (the card key), same `status`/`createdAt`/`retryCount` shape, a fresh
     * `clientMutationId` for idempotent replay. `clientTimestamp` is the moment
     * of deletion — `save` prefers the entity's own `lastReviewedAt` and falls
     * back to `now`, and a deletion has no entity payload to prefer, so it takes
     * that same fallback. That also keeps the tombstone strictly newer than the
     * UPSERT that created the row, which is what the Worker's
     * `timestamp >= existingEntity.updatedAt` LWW check requires.
     */
    async deleteByKeys(keys: string[]): Promise<void> {
        if (keys.length === 0) return;
        const now = new Date().toISOString();
        await this.db.transaction('rw', [this.db.flashcardReviews, this.db.syncQueue], async () => {
            await this.db.flashcardReviews.bulkDelete(keys);
            const queueItems = keys.map((key) => ({
                id: crypto.randomUUID(),
                clientMutationId: crypto.randomUUID(),
                entityType: 'flashcardReview' as const,
                entityId: key,
                operation: 'DELETE' as const,
                clientTimestamp: now,
                payload: null,
                status: 'pending' as const,
                createdAt: now,
                retryCount: 0,
            }));
            await this.db.syncQueue.bulkPut(queueItems);
        });
    }
}

export const dexieFlashcardReviewRepository = new DexieFlashcardReviewRepository();
