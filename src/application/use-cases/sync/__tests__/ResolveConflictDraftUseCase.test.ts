import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { DB_NAME } from '../../../../infrastructure/database/schema/schema';
import { LunaClairDatabase } from '../../../../infrastructure/database/schema/LunaClairDatabase';
import { DexieConflictDraftRepository } from '../../../../infrastructure/database/repositories/DexieConflictDraftRepository';
import { ResolveConflictDraftUseCase } from '../ResolveConflictDraftUseCase';
import type { ConflictDraft } from '../../../../domain/sync/models/sync.types';

describe('ResolveConflictDraftUseCase', () => {
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

    it('keep_server: removes draft without mutating documentContents or outbox queue', async () => {
        const draft: ConflictDraft = {
            id: 'draft-server-1',
            documentId: 'doc-bio-1',
            baseVersion: 1,
            serverVersion: 2,
            localContent: '# Local Divergent Content',
            serverContent: '# Server Authoritative Content',
            createdAt: '2026-08-27T10:00:00.000Z',
        };
        await conflictRepo.saveConflictDraft(draft);

        const useCase = new ResolveConflictDraftUseCase(conflictRepo);
        await useCase.execute({
            draftId: 'draft-server-1',
            resolution: 'keep_server',
        });

        // Draft deleted
        expect(await conflictRepo.getById('draft-server-1')).toBeNull();

        // No outbox mutation enqueued
        const queueCount = await testDb.syncQueue.count();
        expect(queueCount).toBe(0);
    });

    it('keep_local: applies local content, updates version to serverVersion + 1, and enqueues outbox mutation', async () => {
        const draft: ConflictDraft = {
            id: 'draft-local-1',
            documentId: 'doc-bio-2',
            baseVersion: 1,
            serverVersion: 3,
            localContent: '# Preserved Local Changes',
            serverContent: '# Stale Server Content v3',
            createdAt: '2026-08-27T10:00:00.000Z',
        };
        await conflictRepo.saveConflictDraft(draft);

        const useCase = new ResolveConflictDraftUseCase(conflictRepo);
        await useCase.execute({
            draftId: 'draft-local-1',
            resolution: 'keep_local',
        });

        // Draft deleted
        expect(await conflictRepo.getById('draft-local-1')).toBeNull();

        // Document updated with local content and version 4 (serverVersion 3 + 1)
        const doc = await testDb.documentContents.get('doc-bio-2');
        expect(doc).toBeDefined();
        expect(doc?.content).toBe('# Preserved Local Changes');
        expect(doc?.version).toBe(4);

        // Outbox mutation enqueued with baseVersion: 3 and version: 4
        const queueItems = await testDb.syncQueue.toArray();
        expect(queueItems).toHaveLength(1);
        expect(queueItems[0]).toMatchObject({
            entityType: 'document',
            entityId: 'doc-bio-2',
            operation: 'UPSERT',
            baseVersion: 3,
            payload: {
                documentId: 'doc-bio-2',
                content: '# Preserved Local Changes',
                version: 4,
            },
        });
    });

    it('merge: applies merged content, updates version to serverVersion + 1, and enqueues outbox mutation', async () => {
        const draft: ConflictDraft = {
            id: 'draft-merge-1',
            documentId: 'doc-bio-3',
            baseVersion: 2,
            serverVersion: 4,
            localContent: '# Local Portion',
            serverContent: '# Remote Portion',
            createdAt: '2026-08-27T10:00:00.000Z',
        };
        await conflictRepo.saveConflictDraft(draft);

        const useCase = new ResolveConflictDraftUseCase(conflictRepo);
        await useCase.execute({
            draftId: 'draft-merge-1',
            resolution: 'merge',
            mergedContent: '# Combined Merged Content\nLocal and Remote together',
        });

        // Draft deleted
        expect(await conflictRepo.getById('draft-merge-1')).toBeNull();

        // Document updated with merged content and version 5 (4 + 1)
        const doc = await testDb.documentContents.get('doc-bio-3');
        expect(doc).toBeDefined();
        expect(doc?.content).toBe('# Combined Merged Content\nLocal and Remote together');
        expect(doc?.version).toBe(5);

        // Outbox mutation enqueued
        const queueItems = await testDb.syncQueue.toArray();
        expect(queueItems).toHaveLength(1);
        expect(queueItems[0].baseVersion).toBe(4);
        expect((queueItems[0].payload as { version: number }).version).toBe(5);
    });

    it('throws error when draftId is not found', async () => {
        const useCase = new ResolveConflictDraftUseCase(conflictRepo);
        await expect(
            useCase.execute({
                draftId: 'non-existent-draft',
                resolution: 'keep_local',
            }),
        ).rejects.toThrow(/Conflict draft with ID non-existent-draft not found/i);
    });

    it('throws error when draftId is empty', async () => {
        const useCase = new ResolveConflictDraftUseCase(conflictRepo);
        await expect(
            useCase.execute({
                draftId: '',
                resolution: 'keep_server',
            }),
        ).rejects.toThrow(/draftId is required/i);
    });
});
