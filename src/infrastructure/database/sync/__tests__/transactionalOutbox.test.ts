import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { DB_NAME } from '../../schema';
import { LunaClairDatabase } from '../../LunaClairDatabase';
import { runSyncableTransaction, type SyncableMutationInput } from '../transactionalOutbox';
import type { ImportedDocumentContent } from '../../../../domain/reader';

describe('Transactional Outbox Pattern (runSyncableTransaction)', () => {
    let testDb: LunaClairDatabase;

    beforeEach(async () => {
        await Dexie.delete(DB_NAME);
        testDb = new LunaClairDatabase();
        await testDb.open();
    });

    afterEach(async () => {
        testDb.close();
        await Dexie.delete(DB_NAME);
        vi.restoreAllMocks();
    });

    it('Test 1: Atomic success — entity is written to Dexie table and syncQueue item is created with matching clientMutationId and payload', async () => {
        const doc: ImportedDocumentContent = {
            documentId: 'doc-bio-1',
            title: 'Cellular Biology Notes',
            content: '# Cellular Respiration\n\nGlycolysis occurs in the cytoplasm.',
            updatedAt: '2026-08-27T12:00:00.000Z',
        };

        const mutationInput: SyncableMutationInput<{ content: string; title: string }> = {
            entityType: 'document',
            entityId: 'doc-bio-1',
            operation: 'UPSERT',
            payload: {
                content: doc.content,
                title: doc.title,
            },
            baseVersion: 1,
            clientMutationId: 'custom-mut-uuid-1',
        };

        const { result, queueItem } = await runSyncableTransaction(
            testDb,
            [testDb.documentContents, testDb.syncQueue],
            mutationInput,
            async () => {
                await testDb.documentContents.put(doc);
                return doc;
            }
        );

        // Verify entity result
        expect(result).toEqual(doc);

        // Verify queueItem structure
        expect(queueItem.id).toBeDefined();
        expect(queueItem.clientMutationId).toBe('custom-mut-uuid-1');
        expect(queueItem.entityType).toBe('document');
        expect(queueItem.entityId).toBe('doc-bio-1');
        expect(queueItem.operation).toBe('UPSERT');
        expect(queueItem.baseVersion).toBe(1);
        expect(queueItem.status).toBe('pending');
        expect(queueItem.retryCount).toBe(0);
        expect(queueItem.payload).toEqual({
            content: doc.content,
            title: doc.title,
        });

        // Verify persistence in Dexie documentContents
        const persistedDoc = await testDb.documentContents.get('doc-bio-1');
        expect(persistedDoc).toEqual(doc);

        // Verify persistence in Dexie syncQueue
        const persistedQueueItem = await testDb.syncQueue.get(queueItem.id);
        expect(persistedQueueItem).toEqual(queueItem);
    });

    it('Test 2: Entity failure — when mutationFn throws an error, the transaction rolls back and no syncQueue item is created', async () => {
        const doc: ImportedDocumentContent = {
            documentId: 'doc-fail-1',
            title: 'Failing Document',
            content: 'Should not persist',
            updatedAt: '2026-08-27T12:00:00.000Z',
        };

        const mutationInput: SyncableMutationInput<{ content: string }> = {
            entityType: 'document',
            entityId: 'doc-fail-1',
            operation: 'UPSERT',
            payload: { content: doc.content },
        };

        await expect(
            runSyncableTransaction(
                testDb,
                [testDb.documentContents],
                mutationInput,
                async () => {
                    await testDb.documentContents.put(doc);
                    throw new Error('Simulated entity mutation failure (e.g. disk/validation error)');
                }
            )
        ).rejects.toThrow('Simulated entity mutation failure');

        // Verify entity was NOT persisted (rolled back)
        const persistedDoc = await testDb.documentContents.get('doc-fail-1');
        expect(persistedDoc).toBeUndefined();

        // Verify no sync queue item was created
        const queueItems = await testDb.syncQueue.toArray();
        expect(queueItems).toHaveLength(0);
    });

    it('Test 3: Outbox failure simulation — if outbox insertion fails, entity write is rolled back completely', async () => {
        const doc: ImportedDocumentContent = {
            documentId: 'doc-outbox-fail-1',
            title: 'Outbox Failure Doc',
            content: 'Rollback test content',
            updatedAt: '2026-08-27T12:00:00.000Z',
        };

        const mutationInput: SyncableMutationInput<{ content: string }> = {
            entityType: 'document',
            entityId: 'doc-outbox-fail-1',
            operation: 'UPSERT',
            payload: { content: doc.content },
        };

        // Spy on testDb.syncQueue.add to simulate an unexpected outbox insertion error
        const addSpy = vi.spyOn(testDb.syncQueue, 'add').mockRejectedValueOnce(
            new Error('Simulated syncQueue outbox persistence error')
        );

        await expect(
            runSyncableTransaction(
                testDb,
                [testDb.documentContents, testDb.syncQueue],
                mutationInput,
                async () => {
                    await testDb.documentContents.put(doc);
                    return doc;
                }
            )
        ).rejects.toThrow('Simulated syncQueue outbox persistence error');

        expect(addSpy).toHaveBeenCalledTimes(1);

        // Verify entity was rolled back
        const persistedDoc = await testDb.documentContents.get('doc-outbox-fail-1');
        expect(persistedDoc).toBeUndefined();

        // Verify sync queue has no items
        const queueItems = await testDb.syncQueue.toArray();
        expect(queueItems).toHaveLength(0);
    });

    it('Test 4: clientMutationId stability — passing an explicit clientMutationId preserves it; omitting it generates a random UUID', async () => {
        const doc1: ImportedDocumentContent = {
            documentId: 'doc-stab-1',
            title: 'Doc with Custom ID',
            content: 'Custom ID content',
            updatedAt: '2026-08-27T12:00:00.000Z',
        };

        const explicitId = '00000000-0000-4000-8000-000000000001';
        const tx1 = await runSyncableTransaction(
            testDb,
            [testDb.documentContents],
            {
                entityType: 'document',
                entityId: 'doc-stab-1',
                operation: 'UPSERT',
                payload: { content: doc1.content },
                clientMutationId: explicitId,
            },
            async () => {
                await testDb.documentContents.put(doc1);
                return doc1;
            }
        );

        expect(tx1.queueItem.clientMutationId).toBe(explicitId);
        const persisted1 = await testDb.syncQueue.get(tx1.queueItem.id);
        expect(persisted1?.clientMutationId).toBe(explicitId);

        // Omitting clientMutationId generates a random UUID
        const doc2: ImportedDocumentContent = {
            documentId: 'doc-stab-2',
            title: 'Doc with Auto ID',
            content: 'Auto ID content',
            updatedAt: '2026-08-27T12:00:00.000Z',
        };

        const tx2 = await runSyncableTransaction(
            testDb,
            [testDb.documentContents],
            {
                entityType: 'document',
                entityId: 'doc-stab-2',
                operation: 'UPSERT',
                payload: { content: doc2.content },
            },
            async () => {
                await testDb.documentContents.put(doc2);
                return doc2;
            }
        );

        expect(tx2.queueItem.clientMutationId).toBeDefined();
        expect(typeof tx2.queueItem.clientMutationId).toBe('string');
        // Check standard UUID length / pattern
        expect(tx2.queueItem.clientMutationId.length).toBeGreaterThanOrEqual(32);
        expect(tx2.queueItem.clientMutationId).not.toBe(explicitId);
    });

    it('Test 5: Scope auto-inclusion — db.syncQueue is automatically included even if omitted in tables argument', async () => {
        const doc: ImportedDocumentContent = {
            documentId: 'doc-scope-1',
            title: 'Scope Inclusion Doc',
            content: 'Only passed documentContents in tables',
            updatedAt: '2026-08-27T12:00:00.000Z',
        };

        // Notice we only pass [testDb.documentContents], omitting testDb.syncQueue
        const { result, queueItem } = await runSyncableTransaction(
            testDb,
            [testDb.documentContents],
            {
                entityType: 'document',
                entityId: 'doc-scope-1',
                operation: 'UPSERT',
                payload: { content: doc.content },
            },
            async () => {
                await testDb.documentContents.put(doc);
                return doc;
            }
        );

        expect(result).toEqual(doc);
        const persistedDoc = await testDb.documentContents.get('doc-scope-1');
        expect(persistedDoc).toEqual(doc);

        const persistedQueueItem = await testDb.syncQueue.get(queueItem.id);
        expect(persistedQueueItem).toBeDefined();
        expect(persistedQueueItem?.entityId).toBe('doc-scope-1');
    });
});
