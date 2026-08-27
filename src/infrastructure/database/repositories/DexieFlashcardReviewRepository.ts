import type { FlashcardReviewRepository } from '../../../domain/flashcards/FlashcardReviewRepository';
import type { ReviewState } from '../../../domain/flashcards/scheduler';
import { db } from '../LunaClairDatabase';

export class DexieFlashcardReviewRepository implements FlashcardReviewRepository {
    async getAllReviews(signal?: AbortSignal): Promise<ReviewState[]> {
        if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
        return db.flashcardReviews.toArray();
    }

    async getByKeys(keys: string[]): Promise<ReviewState[]> {
        if (keys.length === 0) return [];
        return db.flashcardReviews.where('key').anyOf(keys).toArray();
    }

    async getByMaterial(materialId: string): Promise<ReviewState[]> {
        if (!materialId) return [];
        return db.flashcardReviews.where('materialId').equals(materialId).toArray();
    }

    async save(reviews: ReviewState[]): Promise<void> {
        if (reviews.length === 0) return;
        const now = new Date().toISOString();
        await db.transaction('rw', [db.flashcardReviews, db.syncQueue], async () => {
            await db.flashcardReviews.bulkPut(reviews);
            for (const r of reviews) {
                await db.syncQueue.put({
                    id: crypto.randomUUID(),
                    clientMutationId: crypto.randomUUID(),
                    entityType: 'flashcardReview',
                    entityId: r.key,
                    operation: 'UPSERT',
                    clientTimestamp: r.lastReviewedAt ?? now,
                    payload: r,
                    status: 'pending',
                    createdAt: now,
                    retryCount: 0,
                });
            }
        });
    }

    async deleteByKeys(keys: string[]): Promise<void> {
        if (keys.length === 0) return;
        await db.flashcardReviews.bulkDelete(keys);
    }
}

export const dexieFlashcardReviewRepository = new DexieFlashcardReviewRepository();
