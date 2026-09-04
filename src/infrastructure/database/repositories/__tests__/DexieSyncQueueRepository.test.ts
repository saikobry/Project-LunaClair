import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { DB_NAME } from '../../schema/schema';
import { LunaClairDatabase } from '../../schema/LunaClairDatabase';
import { DexieSyncQueueRepository } from '../DexieSyncQueueRepository';
import type { SyncQueueItem } from '../../../../domain/sync/models/sync.types';

describe('DexieSyncQueueRepository', () => {
    let testDb: LunaClairDatabase;
    let queueRepo: DexieSyncQueueRepository;

    beforeEach(async () => {
        await Dexie.delete(DB_NAME);
        testDb = new LunaClairDatabase();
        await testDb.open();
        queueRepo = new DexieSyncQueueRepository(testDb);
    });

    afterEach(async () => {
        testDb.close();
        await Dexie.delete(DB_NAME);
    });

    it('enqueues mutations and counts pending items', async () => {
        expect(await queueRepo.countPending()).toBe(0);

        const item1: SyncQueueItem = {
            id: 'q-item-1',
            clientMutationId: 'mut-1',
            entityType: 'document',
            entityId: 'doc-1',
            operation: 'UPSERT',
            clientTimestamp: '2026-08-27T10:00:00.000Z',
            payload: { title: 'Doc 1' },
            status: 'pending',
            createdAt: '2026-08-27T10:00:00.000Z',
            retryCount: 0,
        };

        await queueRepo.enqueue(item1);
        expect(await queueRepo.countPending()).toBe(1);

        const item2: SyncQueueItem = {
            id: 'q-item-2',
            clientMutationId: 'mut-2',
            entityType: 'highlight',
            entityId: 'hl-1',
            operation: 'UPSERT',
            clientTimestamp: '2026-08-27T10:01:00.000Z',
            payload: { text: 'Highlight 1' },
            status: 'pending',
            createdAt: '2026-08-27T10:01:00.000Z',
            retryCount: 0,
        };

        await queueRepo.enqueue(item2);
        expect(await queueRepo.countPending()).toBe(2);
    });

    it('peekPending returns pending mutations ordered chronologically by createdAt and respects limit', async () => {
        const itemOlder: SyncQueueItem = {
            id: 'q-older',
            clientMutationId: 'mut-older',
            entityType: 'document',
            entityId: 'doc-older',
            operation: 'UPSERT',
            clientTimestamp: '2026-08-27T08:00:00.000Z',
            payload: { title: 'Older' },
            status: 'pending',
            createdAt: '2026-08-27T08:00:00.000Z',
            retryCount: 0,
        };

        const itemNewer: SyncQueueItem = {
            id: 'q-newer',
            clientMutationId: 'mut-newer',
            entityType: 'document',
            entityId: 'doc-newer',
            operation: 'UPSERT',
            clientTimestamp: '2026-08-27T09:00:00.000Z',
            payload: { title: 'Newer' },
            status: 'pending',
            createdAt: '2026-08-27T09:00:00.000Z',
            retryCount: 0,
        };

        const itemFailed: SyncQueueItem = {
            id: 'q-failed',
            clientMutationId: 'mut-failed',
            entityType: 'document',
            entityId: 'doc-failed',
            operation: 'UPSERT',
            clientTimestamp: '2026-08-27T08:30:00.000Z',
            payload: { title: 'Failed' },
            status: 'failed',
            createdAt: '2026-08-27T08:30:00.000Z',
            retryCount: 1,
        };

        // Enqueue in mixed order
        await queueRepo.enqueue(itemNewer);
        await queueRepo.enqueue(itemFailed);
        await queueRepo.enqueue(itemOlder);

        // Limit 1 should return only the oldest pending item
        const peek1 = await queueRepo.peekPending(1);
        expect(peek1).toHaveLength(1);
        expect(peek1[0].id).toBe('q-older');

        // Limit 10 should return all pending items in chronological order (excludes failed)
        const peekAll = await queueRepo.peekPending(10);
        expect(peekAll).toHaveLength(2);
        expect(peekAll[0].id).toBe('q-older');
        expect(peekAll[1].id).toBe('q-newer');

        // Limit 0 or negative returns empty array
        expect(await queueRepo.peekPending(0)).toHaveLength(0);
        expect(await queueRepo.peekPending(-5)).toHaveLength(0);
    });

    it('updateStatus increments retryCount and records lastAttemptAt and lastError on failure, and supports resetting to pending', async () => {
        const item: SyncQueueItem = {
            id: 'q-update-1',
            clientMutationId: 'mut-update-1',
            entityType: 'drawing',
            entityId: 'dr-1',
            operation: 'UPSERT',
            clientTimestamp: '2026-08-27T10:00:00.000Z',
            payload: { color: '#ff0000' },
            status: 'pending',
            createdAt: '2026-08-27T10:00:00.000Z',
            retryCount: 0,
        };

        await queueRepo.enqueue(item);

        // Mark as failed
        const failTime = '2026-08-27T10:05:00.000Z';
        await queueRepo.updateStatus('q-update-1', 'failed', {
            lastAttemptAt: failTime,
            lastError: 'HTTP 500: Server unavailable',
        });

        const fetched1 = await testDb.syncQueue.get('q-update-1');
        expect(fetched1?.status).toBe('failed');
        expect(fetched1?.retryCount).toBe(1);
        expect(fetched1?.lastAttemptAt).toBe(failTime);
        expect(fetched1?.lastError).toBe('HTTP 500: Server unavailable');

        // Mark as failed a second time -> retryCount increments to 2
        const failTime2 = '2026-08-27T10:10:00.000Z';
        await queueRepo.updateStatus('q-update-1', 'failed', {
            lastAttemptAt: failTime2,
            lastError: 'HTTP 503: Gateway timeout',
        });

        const fetched2 = await testDb.syncQueue.get('q-update-1');
        expect(fetched2?.status).toBe('failed');
        expect(fetched2?.retryCount).toBe(2);
        expect(fetched2?.lastAttemptAt).toBe(failTime2);
        expect(fetched2?.lastError).toBe('HTTP 503: Gateway timeout');

        // Reset back to pending for retry
        await queueRepo.updateStatus('q-update-1', 'pending');
        const fetchedReset = await testDb.syncQueue.get('q-update-1');
        expect(fetchedReset?.status).toBe('pending');
        expect(fetchedReset?.retryCount).toBe(2); // Retains historical retry count unless explicitly cleared

        // Updating non-existent item safely does nothing
        await expect(queueRepo.updateStatus('non-existent-id', 'failed')).resolves.toBeUndefined();
    });

    it('removes processed or discarded mutations from the queue', async () => {
        const item: SyncQueueItem = {
            id: 'q-del-1',
            clientMutationId: 'mut-del-1',
            entityType: 'quizSession',
            entityId: 'sess-1',
            operation: 'APPEND',
            clientTimestamp: '2026-08-27T10:00:00.000Z',
            payload: { score: 100 },
            status: 'pending',
            createdAt: '2026-08-27T10:00:00.000Z',
            retryCount: 0,
        };

        await queueRepo.enqueue(item);
        expect(await testDb.syncQueue.get('q-del-1')).toBeDefined();

        await queueRepo.remove('q-del-1');
        expect(await testDb.syncQueue.get('q-del-1')).toBeUndefined();
    });
});
