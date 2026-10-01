import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { DB_NAME } from '../../schema/schema';
import { LunaClairDatabase } from '../../schema/LunaClairDatabase';
import { DexieSyncReconciler } from '../DexieSyncReconciler';
import type { SyncPullResponse, SyncPushRequest, SyncPushResponse, SyncQueueItem } from '../../../../domain/sync/models/sync.types';

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
            entityType: 'flashcardReview',
            entityId: 'fc-anat-1',
            operation: 'UPSERT',
            changedAt: '2026-08-27T10:10:00.000Z',
            data: {
              key: 'fc-anat-1',
              repetitions: 1,
              easeFactor: 2.5,
              intervalDays: 1,
              dueAt: '2026-08-28T10:10:00.000Z',
              lapses: 0,
              lastReviewedAt: '2026-08-27T10:10:00.000Z',
              reviewCount: 1,
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

      // Verify all tables were updated atomically
      const doc = await testDb.documentContents.get('doc-anat-1');
      expect(doc?.title).toBe('Human Anatomy');
      expect(doc?.content).toBe('# Anatomy Overview');

      const hl = await testDb.highlights.get('hl-anat-1');
      expect(hl?.text).toBe('Anatomy');

      const dr = await testDb.drawings.get('dr-anat-1');
      expect(dr?.color).toBe('#00ff00');

      const fc = await testDb.flashcardReviews.get('fc-anat-1');
      expect(fc?.repetitions).toBe(1);

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
});
