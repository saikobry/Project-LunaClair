import Dexie from 'dexie';
import type { SyncQueueRepository } from '../../../domain/sync/repositories/SyncQueueRepository';
import type { SyncQueueItem, SyncStatus } from '../../../domain/sync/models/sync.types';
import { db as defaultDb, type LunaClairDatabase } from '../schema/LunaClairDatabase';

/**
 * Dexie-backed implementation of `SyncQueueRepository` for local persistent outbox queue.
 */
export class DexieSyncQueueRepository implements SyncQueueRepository {
    private readonly db: LunaClairDatabase;

    constructor(database: LunaClairDatabase = defaultDb) {
        this.db = database;
    }

    async enqueue(item: SyncQueueItem): Promise<void> {
        await this.db.syncQueue.put(item);
    }

    async peekPending(limit: number): Promise<SyncQueueItem[]> {
        if (limit <= 0) {
            return [];
        }

        // Index-ordered and bounded: `[status+createdAt]` yields pending items oldest-first, so
        // `.limit()` stops the cursor at the batch size instead of materialising the entire backlog
        // and sorting it in memory — the outbox is the one store that grows without bound during a
        // long offline stretch, so draining it is the worst case worth capping. A compound range
        // must be bounded on its leading half, hence the minKey/maxKey pair: it is Dexie's idiom for
        // "every `createdAt` under this status", and it preserves `sortBy`'s ascending order.
        // Rows missing either half are absent from the index, which the domain model precludes — a
        // `SyncQueueItem` requires both `status` and `createdAt`, and every writer sets them.
        return this.db.syncQueue
            .where('[status+createdAt]')
            .between(['pending', Dexie.minKey], ['pending', Dexie.maxKey])
            .limit(limit)
            .toArray();
    }

    async updateStatus(
        id: string,
        status: SyncStatus,
        metadata?: { lastAttemptAt?: string; lastError?: string }
    ): Promise<void> {
        const existing = await this.db.syncQueue.get(id);
        if (!existing) {
            return;
        }

        const changes: Partial<SyncQueueItem> = {
            status,
        };

        if (status === 'failed') {
            changes.retryCount = (existing.retryCount ?? 0) + 1;
            changes.lastAttemptAt = metadata?.lastAttemptAt ?? new Date().toISOString();
            if (metadata?.lastError !== undefined) {
                changes.lastError = metadata.lastError;
            }
        } else {
            if (metadata?.lastAttemptAt !== undefined) {
                changes.lastAttemptAt = metadata.lastAttemptAt;
            }
            if (metadata?.lastError !== undefined) {
                changes.lastError = metadata.lastError;
            }
        }

        await this.db.syncQueue.update(id, changes);
    }

    async remove(id: string): Promise<void> {
        await this.db.syncQueue.delete(id);
    }

    async countPending(): Promise<number> {
        return await this.db.syncQueue.where('status').equals('pending').count();
    }
}

/** Singleton instance of DexieSyncQueueRepository */
export const dexieSyncQueueRepository = new DexieSyncQueueRepository();
