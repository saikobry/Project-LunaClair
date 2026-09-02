import type { SyncQueueRepository } from '../../../domain/sync/repositories/SyncQueueRepository';
import type { SyncQueueItem, SyncStatus } from '../../../domain/sync/models/sync.types';
import { db as defaultDb, type LunaClairDatabase } from '../LunaClairDatabase';

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

        const pending = await this.db.syncQueue
            .where('status')
            .equals('pending')
            .sortBy('createdAt');

        return pending.slice(0, limit);
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
