import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { DB_NAME } from '../../schema/schema';
import { openVaultDatabase, clearVaultDatabaseCache, type LunaClairDatabase } from '../../schema/LunaClairDatabase';
import { DexieConflictDraftRepository } from '../DexieConflictDraftRepository';
import type { ConflictDraft } from '../../../../domain/sync/models/sync.types';
import type { JournalOp } from '../../../../domain/sync/reconcilers/plugins/MergePlugin';

describe('DexieConflictDraftRepository', () => {
    let testDb: LunaClairDatabase;
    let conflictRepo: DexieConflictDraftRepository;

    beforeEach(async () => {
        clearVaultDatabaseCache();
        await Dexie.delete(DB_NAME);
        testDb = openVaultDatabase(DB_NAME);
        await testDb.open();
        conflictRepo = new DexieConflictDraftRepository(testDb);
    });

    afterEach(async () => {
        if (testDb.isOpen()) {
            testDb.close();
        }
        clearVaultDatabaseCache();
        await Dexie.delete(DB_NAME);
    });

    it('saves conflict drafts, retrieves by documentId, retrieves by id, and removes', async () => {
        const draft1: ConflictDraft = {
            id: 'draft-conf-1',
            documentId: 'doc-patho-1',
            baseVersion: 1,
            serverVersion: 2,
            localContent: '# Local Edits',
            serverContent: '# Remote Edits',
            createdAt: '2026-08-27T12:00:00.000Z',
        };

        const draft2: ConflictDraft = {
            id: 'draft-conf-2',
            documentId: 'doc-patho-1',
            baseVersion: 2,
            serverVersion: 3,
            localContent: '# Local Second Branch',
            serverContent: '# Remote Third Version',
            createdAt: '2026-08-27T12:15:00.000Z',
        };

        const draftOtherDoc: ConflictDraft = {
            id: 'draft-conf-3',
            documentId: 'doc-anat-1',
            baseVersion: 1,
            serverVersion: 2,
            localContent: '# Anatomy Local',
            serverContent: '# Anatomy Remote',
            createdAt: '2026-08-27T12:30:00.000Z',
        };

        await conflictRepo.saveConflictDraft(draft1);
        await conflictRepo.saveConflictDraft(draft2);
        await conflictRepo.saveConflictDraft(draftOtherDoc);

        // getById
        const fetched1 = await conflictRepo.getById('draft-conf-1');
        expect(fetched1).toEqual(draft1);

        const missing = await conflictRepo.getById('non-existent-draft');
        expect(missing).toBeNull();

        // getByDocumentId
        const pathoDrafts = await conflictRepo.getByDocumentId('doc-patho-1');
        expect(pathoDrafts).toHaveLength(2);
        expect(pathoDrafts.map((d) => d.id)).toEqual(
            expect.arrayContaining(['draft-conf-1', 'draft-conf-2'])
        );

        const anatDrafts = await conflictRepo.getByDocumentId('doc-anat-1');
        expect(anatDrafts).toHaveLength(1);
        expect(anatDrafts[0].id).toBe('draft-conf-3');

        // removeConflictDraft
        await conflictRepo.removeConflictDraft('draft-conf-1');
        expect(await conflictRepo.getById('draft-conf-1')).toBeNull();

        const pathoAfterDelete = await conflictRepo.getByDocumentId('doc-patho-1');
        expect(pathoAfterDelete).toHaveLength(1);
        expect(pathoAfterDelete[0].id).toBe('draft-conf-2');
    });

    it('resolveConflict with merge updates documentContents, removes draft, and emits exactly 1 outbox row', async () => {
        const draft: ConflictDraft = {
            id: 'draft-merge-1',
            documentId: 'doc-merge-1',
            baseVersion: 1,
            serverVersion: 2,
            localContent: '# Local Branch',
            serverContent: '# Remote Branch',
            createdAt: '2026-10-17T00:00:00.000Z',
        };

        await conflictRepo.saveConflictDraft(draft);

        await conflictRepo.resolveConflict({
            draftId: 'draft-merge-1',
            resolution: 'merge',
            mergedContent: '# Merged Result',
        });

        expect(await conflictRepo.getById('draft-merge-1')).toBeNull();

        const doc = await testDb.documentContents.get('doc-merge-1');
        expect(doc).toBeDefined();
        expect(doc?.content).toBe('# Merged Result');

        const queueItems = (await testDb.syncQueue.toArray()) as unknown as JournalOp[];
        expect(queueItems).toHaveLength(1);
        expect(queueItems[0].entity).toBe('documentContent');
        expect(queueItems[0].key).toBe('doc-merge-1');
        expect(queueItems[0].op).toBe('put');
    });

    it('resolveConflict with keep_local updates documentContents, removes draft, and emits exactly 1 outbox row', async () => {
        const draft: ConflictDraft = {
            id: 'draft-local-1',
            documentId: 'doc-local-1',
            baseVersion: 1,
            serverVersion: 2,
            localContent: '# Local Overwrite',
            serverContent: '# Remote Overwritten',
            createdAt: '2026-10-17T00:00:00.000Z',
        };

        await conflictRepo.saveConflictDraft(draft);

        await conflictRepo.resolveConflict({
            draftId: 'draft-local-1',
            resolution: 'keep_local',
        });

        expect(await conflictRepo.getById('draft-local-1')).toBeNull();

        const doc = await testDb.documentContents.get('doc-local-1');
        expect(doc).toBeDefined();
        expect(doc?.content).toBe('# Local Overwrite');

        const queueItems = (await testDb.syncQueue.toArray()) as unknown as JournalOp[];
        expect(queueItems).toHaveLength(1);
        expect(queueItems[0].entity).toBe('documentContent');
        expect(queueItems[0].key).toBe('doc-local-1');
        expect(queueItems[0].op).toBe('put');
    });

    it('resolveConflict with keep_server updates documentContents with server content, removes draft, and emits exactly 1 outbox row', async () => {
        const draft: ConflictDraft = {
            id: 'draft-server-1',
            documentId: 'doc-server-1',
            baseVersion: 1,
            serverVersion: 2,
            localContent: '# Local Ignored',
            serverContent: '# Remote Accepted',
            createdAt: '2026-10-17T00:00:00.000Z',
        };

        await conflictRepo.saveConflictDraft(draft);

        await conflictRepo.resolveConflict({
            draftId: 'draft-server-1',
            resolution: 'keep_server',
        });

        expect(await conflictRepo.getById('draft-server-1')).toBeNull();

        const doc = await testDb.documentContents.get('doc-server-1');
        expect(doc).toBeDefined();
        expect(doc?.content).toBe('# Remote Accepted');

        const queueItems = (await testDb.syncQueue.toArray()) as unknown as JournalOp[];
        expect(queueItems).toHaveLength(1);
        expect(queueItems[0].entity).toBe('documentContent');
        expect(queueItems[0].key).toBe('doc-server-1');
        expect(queueItems[0].op).toBe('put');
    });

    it('resolveConflict removes the resolved draft AND cleans up any duplicate drafts for the same documentId', async () => {
        const draft1: ConflictDraft = {
            id: 'draft-stale-1',
            documentId: 'doc-dup-1',
            baseVersion: 1,
            serverVersion: 2,
            localContent: '# Local Branch',
            serverContent: '# Remote Branch 2',
            createdAt: '2026-10-17T00:00:00.000Z',
        };
        const draft2: ConflictDraft = {
            id: 'draft-stale-2',
            documentId: 'doc-dup-1',
            baseVersion: 1,
            serverVersion: 3,
            localContent: '# Local Branch',
            serverContent: '# Remote Branch 3',
            createdAt: '2026-10-17T00:05:00.000Z',
        };

        await conflictRepo.saveConflictDraft(draft1);
        await conflictRepo.saveConflictDraft(draft2);

        expect(await conflictRepo.getByDocumentId('doc-dup-1')).toHaveLength(2);

        await conflictRepo.resolveConflict({
            draftId: 'draft-stale-1',
            resolution: 'keep_server',
        });

        // Both drafts must now be deleted
        expect(await conflictRepo.getById('draft-stale-1')).toBeNull();
        expect(await conflictRepo.getById('draft-stale-2')).toBeNull();
        expect(await conflictRepo.getByDocumentId('doc-dup-1')).toHaveLength(0);
    });
});
