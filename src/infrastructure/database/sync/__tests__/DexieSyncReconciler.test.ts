import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { DB_NAME } from '../../schema/schema';
import { LunaClairDatabase } from '../../schema/LunaClairDatabase';
import { DexieSyncReconciler } from '../DexieSyncReconciler';
import type { SyncPullResponse, SyncPushRequest, SyncPushResponse, SyncQueueItem } from '../../../../domain/sync/models/sync.types';
import { PLUGINS } from '../../../../domain/sync/reconcilers/plugins/MergePlugin';

describe('DexieSyncReconciler (Transactional Pull & Push Reconciler)', () => {
  let testDb: LunaClairDatabase;
  let reconciler: DexieSyncReconciler;
  const userId = 'user-test-101';
  const deviceId = 'device-macbook-pro';

  beforeEach(async () => {
    await Dexie.delete(DB_NAME);
    testDb = new LunaClairDatabase();
    await testDb.open();
    reconciler = new DexieSyncReconciler();
  });

  afterEach(async () => {
    testDb.close();
    await Dexie.delete(DB_NAME);
  });

  describe('reconcilePullBatch', () => {
    it('applies batch changes across entities and commits checkpoint cursor in one transaction', async () => {
      const pullResponse: SyncPullResponse = {
        newCursor: 15,
        hasMore: false,
        changes: [
          {
            sequence: 11,
            entityType: 'document',
            entityId: 'doc-anat-1',
            operation: 'UPSERT',
            version: 1,
            changedAt: '2026-08-27T10:00:00.000Z',
            data: {
              title: 'Human Anatomy',
              content: '# Anatomy Overview',
              updatedAt: '2026-08-27T10:00:00.000Z',
            },
          },
          {
            sequence: 12,
            entityType: 'highlight',
            entityId: 'hl-anat-1',
            operation: 'UPSERT',
            changedAt: '2026-08-27T10:05:00.000Z',
            data: {
              id: 'hl-anat-1',
              documentId: 'doc-anat-1',
              start: 0,
              end: 10,
              color: 'yellow',
              text: 'Anatomy',
              createdAt: '2026-08-27T10:05:00.000Z',
            },
          },
          {
            sequence: 13,
            entityType: 'drawing',
            entityId: 'dr-anat-1',
            operation: 'UPSERT',
            changedAt: '2026-08-27T10:06:00.000Z',
            data: {
              id: 'dr-anat-1',
              documentId: 'doc-anat-1',
              color: '#00ff00',
              thickness: 3,
              points: [{ x: 0.5, y: 0.5 }],
              createdAt: '2026-08-27T10:06:00.000Z',
            },
          },
          {
            sequence: 14,
            entityType: 'reviewLog',
            entityId: 'rl-anat-1',
            operation: 'UPSERT',
            changedAt: '2026-08-27T10:10:00.000Z',
            data: {
              id: 'rl-anat-1',
              cardKey: 'fc-anat-1',
              rating: 3,
              state: 1,
              due: '2026-08-28T10:10:00.000Z',
              stability: 2.5,
              difficulty: 5.0,
              elapsedDays: 0,
              lastElapsedDays: 0,
              scheduledDays: 1,
              review: '2026-08-27T10:10:00.000Z',
              at: 1724753400000,
            },
          },
          {
            sequence: 15,
            entityType: 'quizSession',
            entityId: 'sess-anat-1',
            operation: 'APPEND',
            changedAt: '2026-08-27T10:15:00.000Z',
            data: {
              id: 'sess-anat-1',
              quizId: 'quiz-anat-101',
              mode: 'standard',
              status: 'completed',
              questionSnapshots: {},
              answers: [],
              startedAt: '2026-08-27T10:00:00.000Z',
              completedAt: '2026-08-27T10:15:00.000Z',
            },
          },
        ],
      };

      const result = await reconciler.reconcilePullBatch(
        testDb,
        userId,
        deviceId,
        10,
        pullResponse
      );

      expect(result.appliedCount).toBe(5);
      expect(result.conflictCount).toBe(0);
      expect(result.newCursor).toBe(15);
      expect(result.touchedEntities).toEqual(
        expect.arrayContaining(['document', 'highlight', 'drawing', 'reviewLog', 'quizSession'])
      );

      // Verify all tables were updated atomically
      const doc = await testDb.documentContents.get('doc-anat-1');
      expect(doc?.title).toBe('Human Anatomy');
      expect(doc?.content).toBe('# Anatomy Overview');

      const hl = await testDb.highlights.get('hl-anat-1');
      expect(hl?.text).toBe('Anatomy');

      const dr = await testDb.drawings.get('dr-anat-1');
      expect(dr?.color).toBe('#00ff00');

      const rl = await testDb.reviewLogs.get('rl-anat-1');
      expect(rl?.cardKey).toBe('fc-anat-1');

      const sess = await testDb.quizSessions.get('sess-anat-1');
      expect(sess?.quizId).toBe('quiz-anat-101');

      const syncState = await testDb.syncState.get(`${userId}:${deviceId}`);
      expect(syncState?.lastServerCursor).toBe(15);
      expect(syncState?.lastSyncedAt).toBeDefined();
    });

    it('branches ConflictDraft, updates canonical document, and clears outbox item when document diverges during pull', async () => {
      // 1. Setup local document and pending unpushed mutation based on v1
      await testDb.documentContents.put({
        documentId: 'doc-diverge-1',
        title: 'Original Title',
        content: '# Local Offline Edits',
        updatedAt: '2026-08-27T09:00:00.000Z',
      });

      const queueItem: SyncQueueItem = {
        id: 'q-doc-diverge',
        clientMutationId: 'mut-doc-diverge',
        entityType: 'document',
        entityId: 'doc-diverge-1',
        operation: 'UPSERT',
        baseVersion: 1, // Offline edit was based on v1
        clientTimestamp: '2026-08-27T09:05:00.000Z',
        payload: {
          title: 'Original Title',
          content: '# Local Offline Edits',
        },
        status: 'pending',
        createdAt: '2026-08-27T09:05:00.000Z',
        retryCount: 0,
      };
      await testDb.syncQueue.put(queueItem);

      // 2. Incoming pull change shows remote is already at version 3
      const pullResponse: SyncPullResponse = {
        newCursor: 20,
        hasMore: false,
        changes: [
          {
            sequence: 20,
            entityType: 'document',
            entityId: 'doc-diverge-1',
            operation: 'UPSERT',
            version: 3,
            changedAt: '2026-08-27T10:00:00.000Z',
            data: {
              title: 'Server Master Title',
              content: '# Server Master Content v3',
              updatedAt: '2026-08-27T10:00:00.000Z',
            },
          },
        ],
      };

      const result = await reconciler.reconcilePullBatch(
        testDb,
        userId,
        deviceId,
        19,
        pullResponse
      );

      expect(result.appliedCount).toBe(0);
      expect(result.conflictCount).toBe(1);

      // Conflict draft stashed
      const drafts = await testDb.conflictDrafts.where('documentId').equals('doc-diverge-1').toArray();
      expect(drafts).toHaveLength(1);
      expect(drafts[0].baseVersion).toBe(1);
      expect(drafts[0].serverVersion).toBe(3);
      expect(drafts[0].localContent).toBe('# Local Offline Edits');
      expect(drafts[0].serverContent).toBe('# Server Master Content v3');

      // Canonical document applied
      const doc = await testDb.documentContents.get('doc-diverge-1');
      expect(doc?.content).toBe('# Server Master Content v3');

      // Conflicting unpushed outbox item deleted
      expect(await testDb.syncQueue.get('q-doc-diverge')).toBeUndefined();
    });

    it('correctly handles deletion and tombstone changes during pull', async () => {
      // Local highlight exists
      await testDb.highlights.put({
        id: 'hl-to-delete',
        documentId: 'doc-1',
        start: 0,
        end: 5,
        color: 'yellow',
        text: 'test',
        createdAt: '2026-08-27T08:00:00.000Z',
      });

      const pullResponse: SyncPullResponse = {
        newCursor: 30,
        hasMore: false,
        changes: [
          {
            sequence: 30,
            entityType: 'highlight',
            entityId: 'hl-to-delete',
            operation: 'DELETE',
            changedAt: '2026-08-27T09:00:00.000Z',
            data: null,
          },
        ],
      };

      const result = await reconciler.reconcilePullBatch(
        testDb,
        userId,
        deviceId,
        29,
        pullResponse
      );

      expect(result.appliedCount).toBe(1);
      expect(await testDb.highlights.get('hl-to-delete')).toBeUndefined();
    });

    it('skips inbound changes for disabled categories during pull reconciliation', async () => {
      const selectiveReconciler = new DexieSyncReconciler(
        testDb,
        (category) => category !== 'annotations'
      );

      const pullResponse: SyncPullResponse = {
        newCursor: 35,
        hasMore: false,
        changes: [
          {
            sequence: 31,
            entityType: 'highlight',
            entityId: 'hl-skipped-1',
            operation: 'UPSERT',
            changedAt: '2026-08-27T11:00:00.000Z',
            data: {
              id: 'hl-skipped-1',
              documentId: 'doc-1',
              start: 0,
              end: 5,
              color: 'yellow',
              text: 'Ignored',
              createdAt: '2026-08-27T11:00:00.000Z',
            },
          },
          {
            sequence: 32,
            entityType: 'quizSession',
            entityId: 'sess-kept-1',
            operation: 'APPEND',
            changedAt: '2026-08-27T11:05:00.000Z',
            data: {
              id: 'sess-kept-1',
              quizId: 'quiz-1',
              startedAt: '2026-08-27T11:05:00.000Z',
              completedAt: '2026-08-27T11:10:00.000Z',
              score: 90,
              totalQuestions: 10,
              correctAnswers: 9,
              status: 'completed',
              responses: [],
            },
          },
        ],
      };

      const result = await selectiveReconciler.reconcilePullBatch(
        testDb,
        userId,
        deviceId,
        30,
        pullResponse
      );

      // Only quizSession is applied; highlight is skipped
      expect(result.appliedCount).toBe(1);
      expect(await testDb.highlights.get('hl-skipped-1')).toBeUndefined();
      expect(await testDb.quizSessions.get('sess-kept-1')).toBeDefined();
    });

    it('enqueues Explore pointer into pendingHydrations', async () => {
      const pullResponse: SyncPullResponse = {
        newCursor: 40,
        hasMore: false,
        changes: [
          {
            sequence: 40,
            entityType: 'pointer',
            entityId: 'share-explore-123',
            operation: 'UPSERT',
            changedAt: '2026-08-27T12:00:00.000Z',
            data: {
              originShareId: 'share-explore-123',
              title: 'Explore Package',
              publishedAt: '2026-08-27T12:00:00.000Z',
              schemaVersion: 1,
            },
          },
        ],
      };

      const result = await reconciler.reconcilePullBatch(
        testDb,
        userId,
        deviceId,
        39,
        pullResponse
      );

      expect(result.appliedCount).toBe(1);
      const pending = await testDb.pendingHydrations.get('share-explore-123');
      expect(pending).toBeDefined();
      expect(pending?.originShareId).toBe('share-explore-123');
      expect(pending?.title).toBe('Explore Package');
      expect(pending?.attempts).toBe(0);
    });

    it('does not enqueue Explore pointer into pendingHydrations if material already exists in local library', async () => {
      await testDb.materials.put({
        id: 'mat_share_share-explore-123',
        documentId: 'doc_share_share-explore-123',
        title: 'Explore Package',
        order: 0,
        createdAt: '2026-08-27T12:00:00.000Z',
        updatedAt: '2026-08-27T12:00:00.000Z',
        originShareId: 'share-explore-123',
      });

      const pullResponse: SyncPullResponse = {
        newCursor: 41,
        hasMore: false,
        changes: [
          {
            sequence: 41,
            entityType: 'pointer',
            entityId: 'share-explore-123',
            operation: 'UPSERT',
            changedAt: '2026-08-27T12:00:00.000Z',
            data: {
              originShareId: 'share-explore-123',
              title: 'Explore Package',
              publishedAt: '2026-08-27T12:00:00.000Z',
              schemaVersion: 1,
            },
          },
        ],
      };

      const result = await reconciler.reconcilePullBatch(
        testDb,
        userId,
        deviceId,
        40,
        pullResponse
      );

      expect(result.appliedCount).toBe(1);
      const pending = await testDb.pendingHydrations.get('share-explore-123');
      expect(pending).toBeUndefined();
    });

    it('preserves existing retry state and backoff when reconciling a pointer that is already pending', async () => {
      const futureAttemptTime = Date.now() + 60000;
      await testDb.pendingHydrations.put({
        originShareId: 'share-explore-123',
        attempts: 3,
        nextAttemptAt: futureAttemptTime,
        title: 'Old Title',
        lastError: 'Network failure',
      });

      const pullResponse: SyncPullResponse = {
        newCursor: 42,
        hasMore: false,
        changes: [
          {
            sequence: 42,
            entityType: 'pointer',
            entityId: 'share-explore-123',
            operation: 'UPSERT',
            changedAt: '2026-08-27T12:00:00.000Z',
            data: {
              originShareId: 'share-explore-123',
              title: 'Updated Remote Title',
              publishedAt: '2026-08-27T12:00:00.000Z',
              schemaVersion: 1,
            },
          },
        ],
      };

      const result = await reconciler.reconcilePullBatch(
        testDb,
        userId,
        deviceId,
        41,
        pullResponse
      );

      expect(result.appliedCount).toBe(1);
      const pending = await testDb.pendingHydrations.get('share-explore-123');
      expect(pending).toBeDefined();
      expect(pending?.originShareId).toBe('share-explore-123');
      expect(pending?.title).toBe('Updated Remote Title');
      expect(pending?.attempts).toBe(3);
      expect(pending?.nextAttemptAt).toBe(futureAttemptTime);
      expect(pending?.lastError).toBe('Network failure');
    });

    it('parks poison ops in heldOps when pure plugin throws an exception', async () => {
      const spy = vi.spyOn(PLUGINS.lww, 'apply').mockImplementationOnce(() => {
        throw new Error('Malformed or corrupted payload');
      });

      const pullResponse: SyncPullResponse = {
        newCursor: 45,
        hasMore: false,
        changes: [
          {
            sequence: 45,
            entityType: 'highlight',
            entityId: 'hl-poison-1',
            operation: 'UPSERT',
            changedAt: '2026-08-27T12:00:00.000Z',
            data: { text: 'poison' },
          },
        ],
      };

      const result = await reconciler.reconcilePullBatch(
        testDb,
        userId,
        deviceId,
        44,
        pullResponse
      );

      spy.mockRestore();

      // Poison op is caught and does not increment appliedCount
      expect(result.appliedCount).toBe(0);
      const held = await testDb.heldOps.get('hl-poison-1');
      expect(held).toBeDefined();
      expect(held?.id).toBe('hl-poison-1');
      expect(held?.error).toContain('Malformed or corrupted payload');
    });

    it('parks unknown entities in heldOps', async () => {
      const pullResponse: SyncPullResponse = {
        newCursor: 50,
        hasMore: false,
        changes: [
          {
            sequence: 50,
            entityType: 'futureEntity',
            entityId: 'future-item-1',
            operation: 'UPSERT',
            changedAt: '2026-08-27T12:00:00.000Z',
            data: { foo: 'bar' },
          },
        ],
      };

      const result = await reconciler.reconcilePullBatch(
        testDb,
        userId,
        deviceId,
        49,
        pullResponse
      );

      expect(result.appliedCount).toBe(0);
      const held = await testDb.heldOps.toArray();
      const unknownHeld = held.find((h) => h.op.entity === 'futureEntity');
      expect(unknownHeld).toBeDefined();
      expect(unknownHeld?.reason).toBe('unknown-entity');
    });

    it('collects unique touchedEntities for pointer and delete operations', async () => {
      await testDb.materials.put({
        id: 'mat_share_pkg-ptr-1',
        documentId: 'doc-ptr-1',
        title: 'Share Material',
        originShareId: 'pkg-ptr-1',
        tags: [],
        createdAt: '2026-08-27T10:00:00.000Z',
        updatedAt: '2026-08-27T10:00:00.000Z',
      });
      await testDb.highlights.put({
        id: 'hl-to-del-1',
        documentId: 'doc-1',
        start: 0,
        end: 5,
        color: 'yellow',
        text: 'Hello',
        createdAt: '2026-08-27T10:00:00.000Z',
      });

      const pullResponse: SyncPullResponse = {
        newCursor: 60,
        hasMore: false,
        changes: [
          {
            sequence: 55,
            entityType: 'pointer',
            entityId: 'pkg-ptr-1',
            operation: 'UPSERT',
            changedAt: '2026-08-27T11:00:00.000Z',
            data: { originShareId: 'pkg-ptr-1', title: 'Share Material' },
          },
          {
            sequence: 56,
            entityType: 'highlight',
            entityId: 'hl-to-del-1',
            operation: 'DELETE',
            changedAt: '2026-08-27T11:05:00.000Z',
            data: { id: 'hl-to-del-1', deletedAt: '2026-08-27T11:05:00.000Z' },
          },
        ],
      };

      const result = await reconciler.reconcilePullBatch(
        testDb,
        userId,
        deviceId,
        50,
        pullResponse
      );

      expect(result.appliedCount).toBe(2);
      expect(result.touchedEntities).toEqual(expect.arrayContaining(['pointer', 'highlight']));
    });

    it('suppresses conflict draft when local and server contents are identical on pull, advances version, and purges stale drafts', async () => {
      await testDb.documentContents.put({
        documentId: 'doc-ident-pull',
        title: 'Identical Doc',
        content: '# Identical Body',
        updatedAt: '2026-08-27T09:00:00.000Z',
      });

      await testDb.syncQueue.put({
        id: 'q-ident-pull',
        clientMutationId: 'mut-ident-pull',
        entityType: 'document',
        entityId: 'doc-ident-pull',
        operation: 'UPSERT',
        baseVersion: 1,
        clientTimestamp: '2026-08-27T09:05:00.000Z',
        payload: { content: '# Identical Body' },
        status: 'pending',
        createdAt: '2026-08-27T09:05:00.000Z',
        retryCount: 0,
      });

      // Pre-seed an old stale draft
      await testDb.conflictDrafts.put({
        id: 'draft-stale-ident',
        documentId: 'doc-ident-pull',
        baseVersion: 1,
        serverVersion: 2,
        localContent: '# Identical Body',
        serverContent: '# Earlier Divergence',
        createdAt: '2026-08-27T08:00:00.000Z',
      });

      const pullResponse: SyncPullResponse = {
        newCursor: 25,
        hasMore: false,
        changes: [
          {
            sequence: 25,
            entityType: 'document',
            entityId: 'doc-ident-pull',
            operation: 'UPSERT',
            version: 3,
            changedAt: '2026-08-27T10:00:00.000Z',
            data: {
              title: 'Identical Doc',
              content: '  # Identical Body\n  ',
              updatedAt: '2026-08-27T10:00:00.000Z',
            },
          },
        ],
      };

      const result = await reconciler.reconcilePullBatch(
        testDb,
        userId,
        deviceId,
        24,
        pullResponse
      );

      expect(result.appliedCount).toBe(1);
      expect(result.conflictCount).toBe(0);

      // Stale draft was purged, no new draft created
      const drafts = await testDb.conflictDrafts.where('documentId').equals('doc-ident-pull').toArray();
      expect(drafts).toHaveLength(0);

      // Document version advanced
      const doc = await testDb.documentContents.get('doc-ident-pull') as { version?: number; content: string };
      expect(doc?.version).toBe(3);

      // Outbox item deleted
      expect(await testDb.syncQueue.get('q-ident-pull')).toBeUndefined();
    });

    it('enforces single draft invariant per document by updating existing draft on pull when content diverges again', async () => {
      await testDb.documentContents.put({
        documentId: 'doc-single-pull',
        title: 'Single Draft Doc',
        content: '# Local Offline Edits',
        updatedAt: '2026-08-27T09:00:00.000Z',
      });

      await testDb.syncQueue.put({
        id: 'q-single-pull',
        clientMutationId: 'mut-single-pull',
        entityType: 'document',
        entityId: 'doc-single-pull',
        operation: 'UPSERT',
        baseVersion: 1,
        clientTimestamp: '2026-08-27T09:05:00.000Z',
        payload: { content: '# Local Offline Edits' },
        status: 'pending',
        createdAt: '2026-08-27T09:05:00.000Z',
        retryCount: 0,
      });

      // Existing draft already present
      await testDb.conflictDrafts.put({
        id: 'draft-orig-single',
        documentId: 'doc-single-pull',
        baseVersion: 1,
        serverVersion: 2,
        localContent: '# Local Offline Edits',
        serverContent: '# Remote Version 2',
        createdAt: '2026-08-27T08:00:00.000Z',
      });

      // Remote advances to v4 with new content
      const pullResponse: SyncPullResponse = {
        newCursor: 28,
        hasMore: false,
        changes: [
          {
            sequence: 28,
            entityType: 'document',
            entityId: 'doc-single-pull',
            operation: 'UPSERT',
            version: 4,
            changedAt: '2026-08-27T10:00:00.000Z',
            data: {
              title: 'Single Draft Doc',
              content: '# Remote Version 4 Fresh',
              updatedAt: '2026-08-27T10:00:00.000Z',
            },
          },
        ],
      };

      const result = await reconciler.reconcilePullBatch(
        testDb,
        userId,
        deviceId,
        27,
        pullResponse
      );

      expect(result.conflictCount).toBe(1);

      // Exactly ONE draft remains for this documentId
      const drafts = await testDb.conflictDrafts.where('documentId').equals('doc-single-pull').toArray();
      expect(drafts).toHaveLength(1);
      expect(drafts[0].id).toBe('draft-orig-single');
      expect(drafts[0].baseVersion).toBe(1);
      expect(drafts[0].serverVersion).toBe(4);
      expect(drafts[0].localContent).toBe('# Local Offline Edits');
      expect(drafts[0].serverContent).toBe('# Remote Version 4 Fresh');
    });

  });

  describe('applyPushResult', () => {
    it('deletes accepted items from queue and updates document version atomically', async () => {
      // Setup outbox item and local document
      await testDb.documentContents.put({
        documentId: 'doc-push-1',
        title: 'Doc Push',
        content: '# Doc Push Content',
        updatedAt: '2026-08-27T10:00:00.000Z',
      });

      await testDb.syncQueue.put({
        id: 'q-push-1',
        clientMutationId: 'mut-push-accepted',
        entityType: 'document',
        entityId: 'doc-push-1',
        operation: 'UPSERT',
        baseVersion: 1,
        clientTimestamp: '2026-08-27T10:00:00.000Z',
        payload: { content: '# Doc Push Content' },
        status: 'pending',
        createdAt: '2026-08-27T10:00:00.000Z',
        retryCount: 0,
      });

      const pushRequest: SyncPushRequest = {
        deviceId,
        mutations: [
          {
            clientMutationId: 'mut-push-accepted',
            entityType: 'document',
            entityId: 'doc-push-1',
            operation: 'UPSERT',
            baseVersion: 1,
            clientTimestamp: '2026-08-27T10:00:00.000Z',
            payload: { content: '# Doc Push Content' },
          },
        ],
      };

      const pushResponse: SyncPushResponse = {
        accepted: [
          {
            clientMutationId: 'mut-push-accepted',
            entityType: 'document',
            entityId: 'doc-push-1',
            newVersion: 2,
          },
        ],
        conflicts: [],
        rejected: [],
      };

      const result = await reconciler.applyPushResult(
        testDb,
        userId,
        deviceId,
        pushRequest,
        pushResponse
      );

      expect(result.acceptedCount).toBe(1);
      expect(result.conflictCount).toBe(0);

      // Queue item removed
      expect(await testDb.syncQueue.get('q-push-1')).toBeUndefined();

      // Document version updated
      const doc = await testDb.documentContents.get('doc-push-1') as { version?: number; content: string };
      expect(doc?.version).toBe(2);

      // Sync state updated
      const syncState = await testDb.syncState.get(`${userId}:${deviceId}`);
      expect(syncState?.lastServerCursor).toBe(0);
    });

    it('stashes ConflictDraft and updates canonical document when push returns conflict', async () => {
      await testDb.documentContents.put({
        documentId: 'doc-push-conflict',
        title: 'Doc Push',
        content: '# Local Stale Content',
        updatedAt: '2026-08-27T10:00:00.000Z',
      });

      await testDb.syncQueue.put({
        id: 'q-push-conf',
        clientMutationId: 'mut-push-conflict',
        entityType: 'document',
        entityId: 'doc-push-conflict',
        operation: 'UPSERT',
        baseVersion: 1,
        clientTimestamp: '2026-08-27T10:00:00.000Z',
        payload: { content: '# Local Stale Content' },
        status: 'pending',
        createdAt: '2026-08-27T10:00:00.000Z',
        retryCount: 0,
      });

      const pushRequest: SyncPushRequest = {
        deviceId,
        mutations: [
          {
            clientMutationId: 'mut-push-conflict',
            entityType: 'document',
            entityId: 'doc-push-conflict',
            operation: 'UPSERT',
            baseVersion: 1,
            clientTimestamp: '2026-08-27T10:00:00.000Z',
            payload: { content: '# Local Stale Content' },
          },
        ],
      };

      const pushResponse: SyncPushResponse = {
        accepted: [],
        conflicts: [
          {
            clientMutationId: 'mut-push-conflict',
            entityType: 'document',
            entityId: 'doc-push-conflict',
            serverVersion: 2,
            serverPayload: {
              title: 'Server Master Doc',
              content: '# Server Master Content v2',
              updatedAt: '2026-08-27T10:10:00.000Z',
            },
          },
        ],
        rejected: [],
      };

      const result = await reconciler.applyPushResult(
        testDb,
        userId,
        deviceId,
        pushRequest,
        pushResponse
      );

      expect(result.acceptedCount).toBe(0);
      expect(result.conflictCount).toBe(1);

      // Draft created
      const drafts = await testDb.conflictDrafts.where('documentId').equals('doc-push-conflict').toArray();
      expect(drafts).toHaveLength(1);
      expect(drafts[0].baseVersion).toBe(1);
      expect(drafts[0].serverVersion).toBe(2);
      expect(drafts[0].localContent).toBe('# Local Stale Content');
      expect(drafts[0].serverContent).toBe('# Server Master Content v2');

      // Canonical server payload applied to document
      const doc = await testDb.documentContents.get('doc-push-conflict');
      expect(doc?.content).toBe('# Server Master Content v2');

      // Queue item removed
      expect(await testDb.syncQueue.get('q-push-conf')).toBeUndefined();
    });

    it('writes no ConflictDraft and leaves the document untouched when the conflicting queue row was already drained by another tab', async () => {
      // Simulates the second tab: the user edited the document again *after* the first
      // tab resolved the conflict, and the outbox row for this mutation is already gone.
      await testDb.documentContents.put({
        documentId: 'doc-already-resolved',
        title: 'Doc Resolved',
        content: '# Local Edit Made After Resolution',
        updatedAt: '2026-08-27T11:00:00.000Z',
      });

      // Deliberately NO syncQueue row: this call drained nothing.
      const pushRequest: SyncPushRequest = {
        deviceId,
        mutations: [
          {
            clientMutationId: 'mut-already-resolved',
            entityType: 'document',
            entityId: 'doc-already-resolved',
            operation: 'UPSERT',
            baseVersion: 1,
            clientTimestamp: '2026-08-27T11:00:00.000Z',
            payload: { content: '# Local Edit Made After Resolution' },
          },
        ],
      };

      // Same conflict array the first tab already handled.
      const pushResponse: SyncPushResponse = {
        accepted: [],
        conflicts: [
          {
            clientMutationId: 'mut-already-resolved',
            entityType: 'document',
            entityId: 'doc-already-resolved',
            serverVersion: 2,
            serverPayload: {
              title: 'Server Master Doc',
              content: '# Server Master Content v2',
              updatedAt: '2026-08-27T10:10:00.000Z',
            },
          },
        ],
        rejected: [],
      };

      await reconciler.applyPushResult(
        testDb,
        userId,
        deviceId,
        pushRequest,
        pushResponse
      );

      // No duplicate draft for an already-resolved mutation.
      expect(await testDb.conflictDrafts.toArray()).toHaveLength(0);

      // The more dangerous half: the stale server payload must NOT clobber the local
      // edit made after the first tab resolved the conflict.
      const doc = await testDb.documentContents.get('doc-already-resolved');
      expect(doc?.content).toBe('# Local Edit Made After Resolution');
      expect(doc?.updatedAt).toBe('2026-08-27T11:00:00.000Z');
    });



    it('drafts only the conflicts whose queue rows were drained in a mixed batch', async () => {
      await testDb.documentContents.put({
        documentId: 'doc-mixed-a',
        title: 'Doc A',
        content: '# Local A',
        updatedAt: '2026-08-27T10:00:00.000Z',
      });
      await testDb.documentContents.put({
        documentId: 'doc-mixed-b',
        title: 'Doc B',
        content: '# Local B',
        updatedAt: '2026-08-27T10:00:00.000Z',
      });

      // Only mutation A still has an outbox row; B was drained by the other tab.
      await testDb.syncQueue.put({
        id: 'q-mixed-a',
        clientMutationId: 'mut-mixed-a',
        entityType: 'document',
        entityId: 'doc-mixed-a',
        operation: 'UPSERT',
        baseVersion: 1,
        clientTimestamp: '2026-08-27T10:00:00.000Z',
        payload: { content: '# Local A' },
        status: 'pending',
        createdAt: '2026-08-27T10:00:00.000Z',
        retryCount: 0,
      });

      const pushRequest: SyncPushRequest = {
        deviceId,
        mutations: [
          {
            clientMutationId: 'mut-mixed-a',
            entityType: 'document',
            entityId: 'doc-mixed-a',
            operation: 'UPSERT',
            baseVersion: 1,
            clientTimestamp: '2026-08-27T10:00:00.000Z',
            payload: { content: '# Local A' },
          },
          {
            clientMutationId: 'mut-mixed-b',
            entityType: 'document',
            entityId: 'doc-mixed-b',
            operation: 'UPSERT',
            baseVersion: 1,
            clientTimestamp: '2026-08-27T10:00:00.000Z',
            payload: { content: '# Local B' },
          },
        ],
      };

      const pushResponse: SyncPushResponse = {
        accepted: [],
        conflicts: [
          {
            clientMutationId: 'mut-mixed-a',
            entityType: 'document',
            entityId: 'doc-mixed-a',
            serverVersion: 2,
            serverPayload: {
              title: 'Server A',
              content: '# Server A Content v2',
              updatedAt: '2026-08-27T10:10:00.000Z',
            },
          },
          {
            clientMutationId: 'mut-mixed-b',
            entityType: 'document',
            entityId: 'doc-mixed-b',
            serverVersion: 3,
            serverPayload: {
              title: 'Server B',
              content: '# Server B Content v3',
              updatedAt: '2026-08-27T10:11:00.000Z',
            },
          },
        ],
        rejected: [],
      };

      const result = await reconciler.applyPushResult(
        testDb,
        userId,
        deviceId,
        pushRequest,
        pushResponse
      );

      // Exactly one draft, and it belongs to the drained mutation.
      const drafts = await testDb.conflictDrafts.toArray();
      expect(drafts).toHaveLength(1);
      expect(drafts[0].documentId).toBe('doc-mixed-a');
      expect(drafts[0].serverContent).toBe('# Server A Content v2');

      // Only the drained document was rewritten; B's local content survives.
      const docA = await testDb.documentContents.get('doc-mixed-a');
      expect(docA?.content).toBe('# Server A Content v2');
      const docB = await testDb.documentContents.get('doc-mixed-b');
      expect(docB?.content).toBe('# Local B');

      // The queue row this call owned is gone.
      expect(await testDb.syncQueue.get('q-mixed-a')).toBeUndefined();

      // The response still reported both conflicts; the gate affects what is written,
      // not what the server said.
      expect(result.conflictCount).toBe(2);
    });


    it('marks outbox item status as failed when mutation is rejected', async () => {
      await testDb.syncQueue.put({
        id: 'q-push-rej',
        clientMutationId: 'mut-rejected',
        entityType: 'document',
        entityId: 'doc-rej-1',
        operation: 'UPSERT',
        baseVersion: 1,
        clientTimestamp: '2026-08-27T10:00:00.000Z',
        payload: {},
        status: 'pending',
        createdAt: '2026-08-27T10:00:00.000Z',
        retryCount: 0,
      });

      const pushRequest: SyncPushRequest = {
        deviceId,
        mutations: [
          {
            clientMutationId: 'mut-rejected',
            entityType: 'document',
            entityId: 'doc-rej-1',
            operation: 'UPSERT',
            clientTimestamp: '2026-08-27T10:00:00.000Z',
            payload: {},
          },
        ],
      };

      const pushResponse: SyncPushResponse = {
        accepted: [],
        conflicts: [],
        rejected: [
          {
            clientMutationId: 'mut-rejected',
            entityType: 'document',
            entityId: 'doc-rej-1',
            reason: 'Payload validation failed: document content missing',
          },
        ],
      };

      await reconciler.applyPushResult(
        testDb,
        userId,
        deviceId,
        pushRequest,
        pushResponse
      );

      const item = await testDb.syncQueue.get('q-push-rej');
      expect(item?.status).toBe('failed');
      expect(item?.retryCount).toBe(1);
      expect(item?.lastError).toContain('Payload validation failed');
    });

    it('preserves existing lastServerCursor untouched on push result application', async () => {
      const stateKey = `${userId}:${deviceId}`;
      const priorPullCursor = 42;
      const priorSyncedAt = '2026-08-27T09:00:00.000Z';

      await testDb.syncState.put({
        key: stateKey,
        userId,
        deviceId,
        lastServerCursor: priorPullCursor,
        lastSyncedAt: priorSyncedAt,
      });

      const pushRequest: SyncPushRequest = {
        deviceId,
        mutations: [
          {
            clientMutationId: 'mut-preserve-cursor',
            entityType: 'highlight',
            entityId: 'hl-pres-1',
            operation: 'UPSERT',
            clientTimestamp: '2026-08-27T10:00:00.000Z',
            payload: { text: 'Highlight' },
          },
        ],
      };

      const pushResponse: SyncPushResponse = {
        accepted: [
          {
            clientMutationId: 'mut-preserve-cursor',
            entityType: 'highlight',
            entityId: 'hl-pres-1',
          },
        ],
        conflicts: [],
        rejected: [],
      };

      await reconciler.applyPushResult(
        testDb,
        userId,
        deviceId,
        pushRequest,
        pushResponse
      );

      const state = await testDb.syncState.get(stateKey);
      expect(state).toBeDefined();
      expect(state?.lastServerCursor).toBe(priorPullCursor);
      expect(state?.lastSyncedAt).not.toBe(priorSyncedAt);
    });
  });

    it('suppresses conflict draft when local and server contents are identical on push, advances version, and purges stale drafts', async () => {
      await testDb.documentContents.put({
        documentId: 'doc-push-ident',
        title: 'Identical Doc',
        content: '# Identical Push Content',
        updatedAt: '2026-08-27T09:00:00.000Z',
      });

      await testDb.syncQueue.put({
        id: 'q-push-ident',
        clientMutationId: 'mut-push-ident',
        entityType: 'document',
        entityId: 'doc-push-ident',
        operation: 'UPSERT',
        baseVersion: 1,
        clientTimestamp: '2026-08-27T09:05:00.000Z',
        payload: { content: '# Identical Push Content' },
        status: 'pending',
        createdAt: '2026-08-27T09:05:00.000Z',
        retryCount: 0,
      });

      // Stale draft exists
      await testDb.conflictDrafts.put({
        id: 'draft-stale-push',
        documentId: 'doc-push-ident',
        baseVersion: 1,
        serverVersion: 2,
        localContent: '# Identical Push Content',
        serverContent: '# Old Remote Content',
        createdAt: '2026-08-27T08:00:00.000Z',
      });

      const pushRequest: SyncPushRequest = {
        deviceId,
        mutations: [
          {
            clientMutationId: 'mut-push-ident',
            entityType: 'document',
            entityId: 'doc-push-ident',
            operation: 'UPSERT',
            baseVersion: 1,
            clientTimestamp: '2026-08-27T09:05:00.000Z',
            payload: { content: '# Identical Push Content' },
          },
        ],
      };

      const pushResponse: SyncPushResponse = {
        accepted: [],
        conflicts: [
          {
            clientMutationId: 'mut-push-ident',
            entityType: 'document',
            entityId: 'doc-push-ident',
            serverVersion: 3,
            serverPayload: {
              content: '  # Identical Push Content\n',
              updatedAt: '2026-08-27T10:00:00.000Z',
            },
          },
        ],
        rejected: [],
      };

      await reconciler.applyPushResult(
        testDb,
        userId,
        deviceId,
        pushRequest,
        pushResponse
      );

      // Stale draft deleted, no new draft created
      const drafts = await testDb.conflictDrafts.where('documentId').equals('doc-push-ident').toArray();
      expect(drafts).toHaveLength(0);

      // Version advanced
      const doc = await testDb.documentContents.get('doc-push-ident') as { version?: number; content: string };
      expect(doc?.version).toBe(3);

      // Outbox row removed
      expect(await testDb.syncQueue.get('q-push-ident')).toBeUndefined();
    });

    it('enforces single draft invariant per document on push by updating existing draft', async () => {
      await testDb.documentContents.put({
        documentId: 'doc-push-single',
        title: 'Single Push Doc',
        content: '# Local Push Content',
        updatedAt: '2026-08-27T09:00:00.000Z',
      });

      await testDb.syncQueue.put({
        id: 'q-push-single',
        clientMutationId: 'mut-push-single',
        entityType: 'document',
        entityId: 'doc-push-single',
        operation: 'UPSERT',
        baseVersion: 1,
        clientTimestamp: '2026-08-27T09:05:00.000Z',
        payload: { content: '# Local Push Content' },
        status: 'pending',
        createdAt: '2026-08-27T09:05:00.000Z',
        retryCount: 0,
      });

      // Existing draft already exists
      await testDb.conflictDrafts.put({
        id: 'draft-orig-push',
        documentId: 'doc-push-single',
        baseVersion: 1,
        serverVersion: 2,
        localContent: '# Local Push Content',
        serverContent: '# Remote Version 2',
        createdAt: '2026-08-27T08:00:00.000Z',
      });

      const pushRequest: SyncPushRequest = {
        deviceId,
        mutations: [
          {
            clientMutationId: 'mut-push-single',
            entityType: 'document',
            entityId: 'doc-push-single',
            operation: 'UPSERT',
            baseVersion: 1,
            clientTimestamp: '2026-08-27T09:05:00.000Z',
            payload: { content: '# Local Push Content' },
          },
        ],
      };

      const pushResponse: SyncPushResponse = {
        accepted: [],
        conflicts: [
          {
            clientMutationId: 'mut-push-single',
            entityType: 'document',
            entityId: 'doc-push-single',
            serverVersion: 5,
            serverPayload: {
              content: '# Remote Version 5 Fresh',
              updatedAt: '2026-08-27T10:00:00.000Z',
            },
          },
        ],
        rejected: [],
      };

      await reconciler.applyPushResult(
        testDb,
        userId,
        deviceId,
        pushRequest,
        pushResponse
      );

      // Exactly ONE draft remains for this documentId
      const drafts = await testDb.conflictDrafts.where('documentId').equals('doc-push-single').toArray();
      expect(drafts).toHaveLength(1);
      expect(drafts[0].id).toBe('draft-orig-push');
      expect(drafts[0].baseVersion).toBe(1);
      expect(drafts[0].serverVersion).toBe(5);
      expect(drafts[0].localContent).toBe('# Local Push Content');
      expect(drafts[0].serverContent).toBe('# Remote Version 5 Fresh');
    });

  describe('Transactional Rollback Resilience', () => {
    it('rolls back all mutations if an error occurs during reconcilePullBatch', async () => {
      const pullResponse: SyncPullResponse = {
        newCursor: 100,
        hasMore: false,
        changes: [
          {
            sequence: 99,
            entityType: 'document',
            entityId: 'doc-rollback-1',
            operation: 'UPSERT',
            version: 1,
            changedAt: '2026-08-27T10:00:00.000Z',
            data: {
              title: 'Rollback Doc',
              content: '# Should Roll Back',
            },
          },
        ],
      };

      // Monkey-patch syncState.put to throw an error
      const originalPut = testDb.syncState.put;
      (testDb.syncState as any).put = (async () => {
        throw new Error('Simulated disk/database failure');
      }) as any;

      await expect(
        reconciler.reconcilePullBatch(testDb, userId, deviceId, 98, pullResponse)
      ).rejects.toThrow('Simulated disk/database failure');

      // Restore original method
      testDb.syncState.put = originalPut;

      // Verify that doc-rollback-1 was NOT saved (rolled back)
      const doc = await testDb.documentContents.get('doc-rollback-1');
      expect(doc).toBeUndefined();

      // Verify sync state cursor did NOT update
      const state = await testDb.syncState.get(`${userId}:${deviceId}`);
      expect(state).toBeUndefined();
    });

    it('rolls back all changes if an error occurs during applyPushResult', async () => {
      await testDb.syncQueue.put({
        id: 'q-rollback-test',
        clientMutationId: 'mut-rb',
        entityType: 'document',
        entityId: 'doc-rb',
        operation: 'UPSERT',
        baseVersion: 1,
        clientTimestamp: '2026-08-27T10:00:00.000Z',
        payload: {},
        status: 'pending',
        createdAt: '2026-08-27T10:00:00.000Z',
        retryCount: 0,
      });

      const pushRequest: SyncPushRequest = {
        deviceId,
        mutations: [
          {
            clientMutationId: 'mut-rb',
            entityType: 'document',
            entityId: 'doc-rb',
            operation: 'UPSERT',
            clientTimestamp: '2026-08-27T10:00:00.000Z',
            payload: {},
          },
        ],
      };

      const pushResponse: SyncPushResponse = {
        accepted: [
          {
            clientMutationId: 'mut-rb',
            entityType: 'document',
            entityId: 'doc-rb',
            newVersion: 2,
          },
        ],
        conflicts: [],
        rejected: [],
      };

      const originalPut = testDb.syncState.put;
      (testDb.syncState as any).put = (async () => {
        throw new Error('Simulated crash during push application');
      }) as any;

      await expect(
        reconciler.applyPushResult(testDb, userId, deviceId, pushRequest, pushResponse)
      ).rejects.toThrow('Simulated crash during push application');

      testDb.syncState.put = originalPut;

      // Queue item must still exist (not deleted due to rollback)
      const queueItem = await testDb.syncQueue.get('q-rollback-test');
      expect(queueItem).toBeDefined();
    });
  });

  describe('Checkpoint Revision & Empty Batch Freshness (R5/R6 Failure Fence)', () => {
    it('increments checkpointRevision on every successful pull receipt even with 0 ops / empty changes', async () => {
      const stateKey = `${userId}:${deviceId}`;
      await testDb.syncState.put({
        key: stateKey,
        userId,
        deviceId,
        lastServerCursor: 0,
        checkpointRevision: 0,
        pageToken: 'TOKEN_INIT',
      });

      const emptyPull1: SyncPullResponse = {
        newCursor: 0,
        hasMore: false,
        changes: [],
        receipt: {
          receiptId: 'rcpt-empty-1',
          userId,
          deviceId,
          baseCursor: 0,
          baseRevision: 0,
          pageToken: 'TOKEN_HEAD_1',
          appliedFileIds: [],
        },
      };

      const result1 = await reconciler.reconcilePullBatch(testDb, userId, deviceId, 0, emptyPull1);
      expect(result1.isStale).toBeFalsy();
      expect(result1.appliedCount).toBe(0);

      const state1 = await testDb.syncState.get(stateKey);
      expect(state1?.checkpointRevision).toBe(1);
      expect(state1?.pageToken).toBe('TOKEN_HEAD_1');

      // Second empty batch building on revision 1
      const emptyPull2: SyncPullResponse = {
        newCursor: 0,
        hasMore: false,
        changes: [],
        receipt: {
          receiptId: 'rcpt-empty-2',
          userId,
          deviceId,
          baseCursor: 0,
          baseRevision: 1,
          pageToken: 'TOKEN_HEAD_2',
          appliedFileIds: [],
        },
      };

      const result2 = await reconciler.reconcilePullBatch(testDb, userId, deviceId, 0, emptyPull2);
      expect(result2.isStale).toBeFalsy();
      expect(result2.appliedCount).toBe(0);

      const state2 = await testDb.syncState.get(stateKey);
      expect(state2?.checkpointRevision).toBe(2);
      expect(state2?.pageToken).toBe('TOKEN_HEAD_2');
    });

    it('fences stale empty batch when baseRevision does not match stored revision (EMPTY_BATCH_FRESHNESS probe)', async () => {
      const stateKey = `${userId}:${deviceId}`;
      await testDb.syncState.put({
        key: stateKey,
        userId,
        deviceId,
        lastServerCursor: 0,
        checkpointRevision: 0,
        pageToken: 'TOKEN_INIT',
      });

      // Older batch fetched with baseRevision 0 and token HEAD1
      const olderBatch: SyncPullResponse = {
        newCursor: 0,
        hasMore: false,
        changes: [],
        receipt: {
          receiptId: 'rcpt-older',
          userId,
          deviceId,
          baseCursor: 0,
          baseRevision: 0,
          pageToken: 'HEAD1',
          appliedFileIds: [],
        },
      };

      // Newer batch fetched with baseRevision 0 and token HEAD2
      const newerBatch: SyncPullResponse = {
        newCursor: 0,
        hasMore: false,
        changes: [],
        receipt: {
          receiptId: 'rcpt-newer',
          userId,
          deviceId,
          baseCursor: 0,
          baseRevision: 0,
          pageToken: 'HEAD2',
          appliedFileIds: [],
        },
      };

      // Newer batch commits first: advances stored revision to 1 and pageToken to HEAD2
      const newerResult = await reconciler.reconcilePullBatch(testDb, userId, deviceId, 0, newerBatch);
      expect(newerResult.isStale).toBeFalsy();

      const stateAfterNewer = await testDb.syncState.get(stateKey);
      expect(stateAfterNewer?.checkpointRevision).toBe(1);
      expect(stateAfterNewer?.pageToken).toBe('HEAD2');

      // Older batch (which had baseRevision 0) now attempts to reconcile
      const olderResult = await reconciler.reconcilePullBatch(testDb, userId, deviceId, 0, olderBatch);

      // Invariant: older batch MUST be rejected as stale because baseRevision (0) !== stored revision (1)
      expect(olderResult.isStale).toBe(true);
      expect(olderResult.appliedCount).toBe(0);

      // Invariant: pageToken in stored syncState must remain HEAD2 (not regressed to HEAD1)
      const stateAfterOlder = await testDb.syncState.get(stateKey);
      expect(stateAfterOlder?.pageToken).toBe('HEAD2');
      expect(stateAfterOlder?.checkpointRevision).toBe(1);
      expect(stateAfterOlder?.lastServerCursor).toBe(0);
    });

    it('defaults absent checkpointRevision on existing syncState rows to 0 and advances to 1 on commit', async () => {
      const stateKey = `${userId}:${deviceId}`;
      // Pre-existing state row without checkpointRevision field
      await testDb.syncState.put({
        key: stateKey,
        userId,
        deviceId,
        lastServerCursor: 5,
        pageToken: 'TOKEN_EXISTING',
      });

      const batch: SyncPullResponse = {
        newCursor: 5,
        hasMore: false,
        changes: [],
        receipt: {
          receiptId: 'rcpt-absent-test',
          userId,
          deviceId,
          baseCursor: 5,
          baseRevision: 0,
          pageToken: 'TOKEN_FRESH',
          appliedFileIds: [],
        },
      };

      const result = await reconciler.reconcilePullBatch(testDb, userId, deviceId, 5, batch);
      expect(result.isStale).toBeFalsy();

      const state = await testDb.syncState.get(stateKey);
      expect(state?.checkpointRevision).toBe(1);
      expect(state?.pageToken).toBe('TOKEN_FRESH');
    });

    it('rejects batch with mutations when baseRevision does not match stored revision', async () => {
      const stateKey = `${userId}:${deviceId}`;
      await testDb.syncState.put({
        key: stateKey,
        userId,
        deviceId,
        lastServerCursor: 10,
        checkpointRevision: 3,
        pageToken: 'TOKEN_REV3',
      });

      const staleMutationBatch: SyncPullResponse = {
        newCursor: 11,
        hasMore: false,
        changes: [
          {
            sequence: 11,
            entityType: 'drawing',
            entityId: 'draw-stale-rev',
            operation: 'UPSERT',
            changedAt: '2026-10-25T12:00:00.000Z',
            data: {
              id: 'draw-stale-rev',
              documentId: 'doc-1',
              color: '#ff0000',
              thickness: 1,
              points: [],
              createdAt: '2026-10-25T12:00:00.000Z',
            },
          },
        ],
        receipt: {
          receiptId: 'rcpt-stale-rev',
          userId,
          deviceId,
          baseCursor: 10,
          baseRevision: 2, // Stale! Stored is 3
          appliedFileIds: ['file-stale'],
        },
      };

      const result = await reconciler.reconcilePullBatch(testDb, userId, deviceId, 10, staleMutationBatch);
      expect(result.isStale).toBe(true);
      expect(result.appliedCount).toBe(0);

      // Verify drawing was not persisted
      expect(await testDb.drawings.get('draw-stale-rev')).toBeUndefined();

      // State remains at revision 3
      const state = await testDb.syncState.get(stateKey);
      expect(state?.checkpointRevision).toBe(3);
      expect(state?.lastServerCursor).toBe(10);
    });
  });
});
