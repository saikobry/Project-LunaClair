import type { SyncStateRepository } from '../../../domain/sync/repositories/SyncStateRepository';
import type { SyncState } from '../../../domain/sync/sync.types';
import { db as defaultDb, type LunaClairDatabase } from '../LunaClairDatabase';

/**
 * Dexie-backed implementation of `SyncStateRepository` for local sync checkpoint state.
 */
export class DexieSyncStateRepository implements SyncStateRepository {
    private readonly db: LunaClairDatabase;

    constructor(database: LunaClairDatabase = defaultDb) {
        this.db = database;
    }

    async getSyncState(key: string): Promise<SyncState | null> {
        const state = await this.db.syncState.get(key);
        return state ?? null;
    }

    async saveSyncState(state: SyncState): Promise<void> {
        await this.db.syncState.put(state);
    }
}

/** Singleton instance of DexieSyncStateRepository */
export const dexieSyncStateRepository = new DexieSyncStateRepository();
