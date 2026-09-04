import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { DB_NAME } from '../../schema/schema';
import { LunaClairDatabase } from '../../schema/LunaClairDatabase';
import { DexieSyncStateRepository } from '../DexieSyncStateRepository';
import type { SyncState } from '../../../../domain/sync/models/sync.types';

describe('DexieSyncStateRepository', () => {
    let testDb: LunaClairDatabase;
    let stateRepo: DexieSyncStateRepository;

    beforeEach(async () => {
        await Dexie.delete(DB_NAME);
        testDb = new LunaClairDatabase();
        await testDb.open();
        stateRepo = new DexieSyncStateRepository(testDb);
    });

    afterEach(async () => {
        testDb.close();
        await Dexie.delete(DB_NAME);
    });

    it('returns null when sync state is not found', async () => {
        const result = await stateRepo.getSyncState('usr-missing:dev-missing');
        expect(result).toBeNull();
    });

    it('saves and retrieves sync state checkpoints', async () => {
        const state: SyncState = {
            key: 'usr-101:dev-mac-1',
            userId: 'usr-101',
            deviceId: 'dev-mac-1',
            lastServerCursor: 42,
            lastSyncedAt: '2026-08-27T11:00:00.000Z',
        };

        await stateRepo.saveSyncState(state);

        const fetched = await stateRepo.getSyncState('usr-101:dev-mac-1');
        expect(fetched).toEqual(state);

        // Update sync state cursor
        const updatedState: SyncState = {
            ...state,
            lastServerCursor: 43,
            lastSyncedAt: '2026-08-27T11:30:00.000Z',
        };
        await stateRepo.saveSyncState(updatedState);

        const fetchedUpdated = await stateRepo.getSyncState('usr-101:dev-mac-1');
        expect(fetchedUpdated?.lastServerCursor).toBe(43);
        expect(fetchedUpdated?.lastSyncedAt).toBe('2026-08-27T11:30:00.000Z');
    });
});
