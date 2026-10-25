import type { SyncStateRepository } from '../../../domain/sync/repositories/SyncStateRepository';
import type { SyncState } from '../../../domain/sync/models/sync.types';
import { getActiveVaultDatabase, type LunaClairDatabase } from '../schema/LunaClairDatabase';

/**
 * Dexie-backed implementation of `SyncStateRepository` for local sync checkpoint state.
 */
export class DexieSyncStateRepository implements SyncStateRepository {
    private readonly db: LunaClairDatabase;

    constructor(database: LunaClairDatabase = getActiveVaultDatabase()) {
        this.db = database;
    }

    async getSyncState(key: string): Promise<SyncState | null> {
        const state = await this.db.syncState.get(key);
        return state ?? null;
    }

    async saveSyncState(state: SyncState): Promise<void> {
        await this.db.syncState.put(state);
    }

    async updateSyncState(
        key: string,
        updater: (current: SyncState | null) => SyncState
    ): Promise<SyncState> {
        return await this.db.transaction('rw', this.db.syncState, async () => {
            const existing = (await this.db.syncState.get(key)) ?? null;
            const updated = updater(existing);
            await this.db.syncState.put(updated);
            return updated;
        });
    }
}

/** Singleton instance of DexieSyncStateRepository */
export const dexieSyncStateRepository = new DexieSyncStateRepository();
