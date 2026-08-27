import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { DB_NAME } from '../../../../infrastructure/database/schema';
import { LunaClairDatabase } from '../../../../infrastructure/database/LunaClairDatabase';
import { DexieConflictDraftRepository } from '../../../../infrastructure/database/sync/DexieConflictDraftRepository';
import {
  ResolveConflictDraftUseCase,
  TriggerSyncUseCase,
  GetSyncStatusUseCase,
  GetConflictDraftsUseCase,
} from '../index';
import { SyncStatusStore } from '../../../sync/SyncStatusStore';
import type { SyncEngine } from '../../../sync/SyncEngine';
import type {
  ConflictDraft,
  SessionCredentials,
  SessionCredentialsProvider,
} from '../../../../domain/sync';

describe('Application Sync Use Cases', () => {
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

  describe('ResolveConflictDraftUseCase', () => {
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

      const useCase = new ResolveConflictDraftUseCase(testDb, conflictRepo);
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

      const useCase = new ResolveConflictDraftUseCase(testDb, conflictRepo);
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

      const useCase = new ResolveConflictDraftUseCase(testDb, conflictRepo);
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
      const useCase = new ResolveConflictDraftUseCase(testDb, conflictRepo);
      await expect(
        useCase.execute({
          draftId: 'non-existent-draft',
          resolution: 'keep_local',
        })
      ).rejects.toThrow(/Conflict draft with ID non-existent-draft not found/i);
    });

    it('throws error when draftId is empty', async () => {
      const useCase = new ResolveConflictDraftUseCase(testDb, conflictRepo);
      await expect(
        useCase.execute({
          draftId: '',
          resolution: 'keep_server',
        })
      ).rejects.toThrow(/draftId is required/i);
    });
  });

  describe('TriggerSyncUseCase', () => {
    let mockSyncEngine: SyncEngine;

    beforeEach(() => {
      mockSyncEngine = {
        sync: vi.fn().mockResolvedValue(undefined),
      } as unknown as SyncEngine;
    });

    it('triggers sync directly with passed credentials', async () => {
      const creds: SessionCredentials = {
        userId: 'user_direct_1',
        deviceId: 'device_direct_1',
        token: 'token_direct_1',
      };

      const useCase = new TriggerSyncUseCase(mockSyncEngine);
      await useCase.execute({ credentials: creds });

      expect(mockSyncEngine.sync).toHaveBeenCalledWith(creds);
    });

    it('resolves credentials from SessionCredentialsProvider when not explicitly provided', async () => {
      const creds: SessionCredentials = {
        userId: 'user_from_provider',
        deviceId: 'device_from_provider',
        token: 'token_from_provider',
      };

      const mockProvider: SessionCredentialsProvider = {
        getCredentials: vi.fn().mockResolvedValue(creds),
        setCredentials: vi.fn(),
        clearCredentials: vi.fn(),
      };

      const useCase = new TriggerSyncUseCase(mockSyncEngine, mockProvider);
      await useCase.execute();

      expect(mockProvider.getCredentials).toHaveBeenCalled();
      expect(mockSyncEngine.sync).toHaveBeenCalledWith(creds);
    });

    it('throws error when no credentials are provided and provider returns null', async () => {
      const mockProvider: SessionCredentialsProvider = {
        getCredentials: vi.fn().mockResolvedValue(null),
        setCredentials: vi.fn(),
        clearCredentials: vi.fn(),
      };

      const useCase = new TriggerSyncUseCase(mockSyncEngine, mockProvider);
      await expect(useCase.execute()).rejects.toThrow(/No session credentials available/i);
    });
  });

  describe('GetSyncStatusUseCase', () => {
    it('returns current state from statusStore', () => {
      const statusStore = new SyncStatusStore();
      statusStore.setState({
        state: 'syncing',
        pendingCount: 5,
        lastServerCursor: 42,
      });

      const useCase = new GetSyncStatusUseCase(statusStore);
      const status = useCase.execute();

      expect(status.state).toBe('syncing');
      expect(status.pendingCount).toBe(5);
      expect(status.lastServerCursor).toBe(42);
    });
  });

  describe('GetConflictDraftsUseCase', () => {
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
});
