import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { DB_NAME } from '../../../../infrastructure/database/schema/schema';
import { LunaClairDatabase } from '../../../../infrastructure/database/schema/LunaClairDatabase';
import { DexieConflictDraftRepository } from '../../../../infrastructure/database/repositories/DexieConflictDraftRepository';
import { GetConflictDraftsUseCase } from '../GetConflictDraftsUseCase';

describe('GetConflictDraftsUseCase', () => {
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
        vi.restoreAllMocks();
    });

    it('returns all conflict drafts when no documentId filter is supplied', async () => {
        await conflictRepo.saveConflictDraft({
            id: 'draft-a',
            documentId: 'doc-1',
            baseVersion: 1,
            serverVersion: 2,
            localContent: 'L1',
            serverContent: 'S1',
            createdAt: '2026-08-27T10:00:00.000Z',
        });
        await conflictRepo.saveConflictDraft({
            id: 'draft-b',
            documentId: 'doc-2',
            baseVersion: 1,
            serverVersion: 3,
            localContent: 'L2',
            serverContent: 'S2',
            createdAt: '2026-08-27T10:05:00.000Z',
        });

        const useCase = new GetConflictDraftsUseCase(conflictRepo);
        const allDrafts = await useCase.execute();

        expect(allDrafts).toHaveLength(2);
        expect(allDrafts.map((d) => d.id)).toContain('draft-a');
        expect(allDrafts.map((d) => d.id)).toContain('draft-b');
    });

    it('returns conflict drafts filtered by documentId when provided', async () => {
        await conflictRepo.saveConflictDraft({
            id: 'draft-filter-1',
            documentId: 'doc-filter-target',
            baseVersion: 1,
            serverVersion: 2,
            localContent: 'L1',
            serverContent: 'S1',
            createdAt: '2026-08-27T10:00:00.000Z',
        });
        await conflictRepo.saveConflictDraft({
            id: 'draft-filter-2',
            documentId: 'doc-other',
            baseVersion: 1,
            serverVersion: 2,
            localContent: 'L2',
            serverContent: 'S2',
            createdAt: '2026-08-27T10:00:00.000Z',
        });

        const useCase = new GetConflictDraftsUseCase(conflictRepo);
        const filtered = await useCase.execute({ documentId: 'doc-filter-target' });

        expect(filtered).toHaveLength(1);
        expect(filtered[0].id).toBe('draft-filter-1');
        expect(filtered[0].documentId).toBe('doc-filter-target');
    });
});
