import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { DB_NAME } from '../../schema/schema';
import { LunaClairDatabase } from '../../schema/LunaClairDatabase';
import { DexieConflictDraftRepository } from '../DexieConflictDraftRepository';
import type { ConflictDraft } from '../../../../domain/sync/models/sync.types';

describe('DexieConflictDraftRepository', () => {
    let testDb: LunaClairDatabase;
    let conflictRepo: DexieConflictDraftRepository;

    beforeEach(async () => {
        await Dexie.delete(DB_NAME);
        testDb = new LunaClairDatabase();
        await testDb.open();
        conflictRepo = new DexieConflictDraftRepository(testDb);
    });

    afterEach(async () => {
        testDb.close();
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
});
