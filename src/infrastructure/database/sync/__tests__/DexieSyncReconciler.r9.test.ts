import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { DB_NAME } from '../../schema/schema';
import { LunaClairDatabase } from '../../schema/LunaClairDatabase';
import { DexieSyncReconciler } from '../DexieSyncReconciler';
import { DexieAnnotationRepository } from '../../repositories/DexieAnnotationRepository';
import type { SyncPullResponse, SyncQueueItem } from '../../../../domain/sync/models/sync.types';
import { createClock } from '../../../../domain/sync/reconcilers/plugins/MergePlugin';
import { createSyncStateKey } from '../../../../domain/sync/utils/syncIdentity';
import { installSyncHooks } from '../syncHooks';

/**
 * TaskId: r9-marker-closeout-20261026-e471a9
 *
 * Regression test suite verifying R9 null-deletion fix and reconciler deletion semantics:
 * 1. Fresh documentContent and document alias UPSERT with deletedAt: null stores body without erroneous tombstone.
 * 2. Existing document with valid fast-forward revision + deletedAt: null updates body; concurrent edit preserves both via ConflictDraft.
 * 3. Material and drawing UPSERT with deletedAt: null or absent marker remain live and store rows.
 * 4. Explicit DELETE with null/undefined/missing payload or genuine soft-deletion timestamp retains deletion semantics and records tombstone.
 * 5. Malformed/missing UPSERT payload does NOT delete existing rows; routes to heldOps with reason malformed-payload.
 * 6. Newer genuine tombstone is not erased by stale replay.
 * 7. Remote apply suppresses echo outbox entries in syncQueue and commits data/checkpoint atomically (post-write atomic rollback).
 * 8. Malformed or invalid deletedAt markers on UPSERT (invalid string, empty/whitespace, booleans, objects, numeric) are held with reason malformed-marker.
 */
describe('DexieSyncReconciler R9 Regression Tests (Null-Deletion Fix & Reconciler Semantics)', () => {
  let testDb: LunaClairDatabase;
  let reconciler: DexieSyncReconciler;
  const userId = 'user_test_r9';
  const deviceId = 'device_test_r9';

  beforeEach(async () => {
    await Dexie.delete(DB_NAME);
    testDb = new LunaClairDatabase();
    await testDb.open();
    reconciler = new DexieSyncReconciler(testDb);
  });

  afterEach(async () => {
    testDb.close();
    await Dexie.delete(DB_NAME);
  });

  describe('1. Fresh documentContent and document alias UPSERT with deletedAt: null', () => {
    it('1a: stores fresh documentContent body and creates NO erroneous tombstone when deletedAt is null', async () => {
      const docId = 'doc_test_fresh_content';
      const pullResponse: SyncPullResponse = {
        newCursor: 10,
        hasMore: false,
        changes: [
          {
            sequence: 1,
            entityType: 'documentContent',
            entityId: docId,
            operation: 'UPSERT',
            version: 1,
            changedAt: '2026-10-26T10:00:00.000Z',
            data: {
              documentId: docId,
              title: 'Anatomy Chapter 1',
              content: '# Anatomy Chapter 1\n\nFresh document content body.',
              updatedAt: '2026-10-26T10:00:00.000Z',
              version: 1,
              deletedAt: null,
            },
          },
        ],
      };

      const result = await reconciler.reconcilePullBatch(testDb, userId, deviceId, 0, pullResponse);

      expect(result.appliedCount).toBe(1);
      expect(result.conflictCount).toBe(0);

      // Document body must be stored in database
      const storedDoc = await testDb.documentContents.get(docId);
      expect(storedDoc).toBeDefined();
      expect(storedDoc?.title).toBe('Anatomy Chapter 1');
      expect(storedDoc?.content).toBe('# Anatomy Chapter 1\n\nFresh document content body.');

      // Erroneous tombstone must NOT be created
      const tombstone = await testDb.tombstones.get(`documentContent:${docId}`);
      expect(tombstone).toBeUndefined();
    });

    it('1b: stores fresh document (wire alias) body and creates NO erroneous tombstone when deletedAt is null', async () => {
      const docId = 'doc_test_fresh_alias';
      const pullResponse: SyncPullResponse = {
        newCursor: 11,
        hasMore: false,
        changes: [
          {
            sequence: 2,
            entityType: 'document',
            entityId: docId,
            operation: 'UPSERT',
            version: 1,
            changedAt: '2026-10-26T10:00:00.000Z',
            data: {
              documentId: docId,
              title: 'Spanish Vocabulary',
              content: '# Spanish Vocabulary\n\n- Hola\n- Gracias',
              updatedAt: '2026-10-26T10:00:00.000Z',
              version: 1,
              deletedAt: null,
            },
          },
        ],
      };

      const result = await reconciler.reconcilePullBatch(testDb, userId, deviceId, 10, pullResponse);

      expect(result.appliedCount).toBe(1);
      expect(result.conflictCount).toBe(0);

      // Document alias maps to documentContents table
      const storedDoc = await testDb.documentContents.get(docId);
      expect(storedDoc).toBeDefined();
      expect(storedDoc?.title).toBe('Spanish Vocabulary');
      expect(storedDoc?.content).toBe('# Spanish Vocabulary\n\n- Hola\n- Gracias');

      // No tombstone under either alias name
      const tombstoneContent = await testDb.tombstones.get(`documentContent:${docId}`);
      const tombstoneDoc = await testDb.tombstones.get(`document:${docId}`);
      expect(tombstoneContent).toBeUndefined();
      expect(tombstoneDoc).toBeUndefined();
    });
  });

  describe('2. Existing document revision handling with deletedAt: null', () => {
    it('2a: applies fast-forward revision without deleting row or creating tombstone when deletedAt is null', async () => {
      const docId = 'doc_test_ff';

      // Pre-populate existing document at v1
      await testDb.documentContents.put({
        documentId: docId,
        title: 'Original Title v1',
        content: '# Baseline Content v1',
        updatedAt: '2026-10-26T09:00:00.000Z',
        version: 1,
      } as any);

      const pullResponse: SyncPullResponse = {
        newCursor: 20,
        hasMore: false,
        changes: [
          {
            sequence: 15,
            entityType: 'documentContent',
            entityId: docId,
            operation: 'UPSERT',
            version: 2,
            changedAt: '2026-10-26T10:00:00.000Z',
            data: {
              documentId: docId,
              title: 'Updated Title v2',
              content: '# Fast-Forward Content v2',
              updatedAt: '2026-10-26T10:00:00.000Z',
              version: 2,
              deletedAt: null,
            },
          },
        ],
      };

      const result = await reconciler.reconcilePullBatch(testDb, userId, deviceId, 10, pullResponse);

      expect(result.appliedCount).toBe(1);
      expect(result.conflictCount).toBe(0);

      // Row must remain and reflect updated content
      const storedDoc = await testDb.documentContents.get(docId);
      expect(storedDoc).toBeDefined();
      expect(storedDoc?.title).toBe('Updated Title v2');
      expect(storedDoc?.content).toBe('# Fast-Forward Content v2');

      // No tombstone
      const tombstone = await testDb.tombstones.get(`documentContent:${docId}`);
      expect(tombstone).toBeUndefined();

      // No conflict drafts
      const drafts = await testDb.conflictDrafts.where('documentId').equals(docId).toArray();
      expect(drafts).toHaveLength(0);
    });

    it('2b: respects concurrent local edit retention and forks ConflictDraft instead of deleting when deletedAt is null', async () => {
      const docId = 'doc_test_concurrent';

      // Local document at v1 with divergent offline edit
      await testDb.documentContents.put({
        documentId: docId,
        title: 'Original Base Title',
        content: '# Local Offline Edits (Unpushed)',
        updatedAt: '2026-10-26T09:15:00.000Z',
        version: 1,
      } as any);

      const queueItem: SyncQueueItem = {
        id: 'q_doc_concurrent',
        clientMutationId: 'mut_doc_concurrent',
        entityType: 'document',
        entityId: docId,
        operation: 'UPSERT',
        baseVersion: 1,
        clientTimestamp: '2026-10-26T09:15:00.000Z',
        payload: {
          title: 'Original Base Title',
          content: '# Local Offline Edits (Unpushed)',
        },
        status: 'pending',
        createdAt: '2026-10-26T09:15:00.000Z',
        retryCount: 0,
      };
      await testDb.syncQueue.put(queueItem);

      // Incoming remote change is v3 carrying deletedAt: null
      const pullResponse: SyncPullResponse = {
        newCursor: 25,
        hasMore: false,
        changes: [
          {
            sequence: 20,
            entityType: 'document',
            entityId: docId,
            operation: 'UPSERT',
            version: 3,
            changedAt: '2026-10-26T10:00:00.000Z',
            data: {
              documentId: docId,
              title: 'Remote Master Title v3',
              content: '# Remote Master Content v3',
              updatedAt: '2026-10-26T10:00:00.000Z',
              version: 3,
              deletedAt: null,
            },
          },
        ],
      };

      const result = await reconciler.reconcilePullBatch(testDb, userId, deviceId, 10, pullResponse);

      expect(result.conflictCount).toBe(1);

      // Canonical document advances to remote master
      const canonicalDoc = await testDb.documentContents.get(docId);
      expect(canonicalDoc).toBeDefined();
      expect(canonicalDoc?.content).toBe('# Remote Master Content v3');

      // Local unpushed edits preserved in ConflictDraft
      const drafts = await testDb.conflictDrafts.where('documentId').equals(docId).toArray();
      expect(drafts).toHaveLength(1);
      expect(drafts[0].baseVersion).toBe(1);
      expect(drafts[0].serverVersion).toBe(3);
      expect(drafts[0].localContent).toBe('# Local Offline Edits (Unpushed)');
      expect(drafts[0].serverContent).toBe('# Remote Master Content v3');

      // No tombstone
      const tombstone = await testDb.tombstones.get(`documentContent:${docId}`);
      expect(tombstone).toBeUndefined();

      // Conflicting outbox item removed
      expect(await testDb.syncQueue.get('q_doc_concurrent')).toBeUndefined();
    });
  });

  describe('3. Material and drawing UPSERT with deletedAt: null and absent markers', () => {
    it('3a: stores material UPSERT with deletedAt: null without creating tombstone', async () => {
      const matId = 'mat_test_null_marker';
      const pullResponse: SyncPullResponse = {
        newCursor: 30,
        hasMore: false,
        changes: [
          {
            sequence: 31,
            entityType: 'material',
            entityId: matId,
            operation: 'UPSERT',
            changedAt: '2026-10-26T10:00:00.000Z',
            data: {
              id: matId,
              title: 'Human Physiology',
              description: 'Cardiovascular system notes',
              tags: ['cardio', 'physiology'],
              createdAt: '2026-10-26T09:00:00.000Z',
              updatedAt: '2026-10-26T10:00:00.000Z',
              deletedAt: null,
            },
          },
        ],
      };

      const result = await reconciler.reconcilePullBatch(testDb, userId, deviceId, 25, pullResponse);

      expect(result.appliedCount).toBe(1);

      const storedMat = await testDb.materials.get(matId);
      expect(storedMat).toBeDefined();
      expect(storedMat?.title).toBe('Human Physiology');

      const tombstone = await testDb.tombstones.get(`material:${matId}`);
      expect(tombstone).toBeUndefined();
    });

    it('3b: stores drawing UPSERT with deletedAt: null without creating tombstone', async () => {
      const drId = 'dr_test_null_marker';
      const pullResponse: SyncPullResponse = {
        newCursor: 32,
        hasMore: false,
        changes: [
          {
            sequence: 32,
            entityType: 'drawing',
            entityId: drId,
            operation: 'UPSERT',
            changedAt: '2026-10-26T10:00:00.000Z',
            data: {
              id: drId,
              documentId: 'doc_anat_1',
              color: '#00ff00',
              thickness: 3,
              points: [{ x: 0.1, y: 0.2 }, { x: 0.3, y: 0.4 }],
              createdAt: '2026-10-26T10:00:00.000Z',
              deletedAt: null,
            },
          },
        ],
      };

      const result = await reconciler.reconcilePullBatch(testDb, userId, deviceId, 30, pullResponse);

      expect(result.appliedCount).toBe(1);

      const storedDr = await testDb.drawings.get(drId);
      expect(storedDr).toBeDefined();
      expect(storedDr?.color).toBe('#00ff00');
      expect(storedDr?.points).toHaveLength(2);

      const tombstone = await testDb.tombstones.get(`drawing:${drId}`);
      expect(tombstone).toBeUndefined();
    });

    it('3c: stores material and drawing UPSERT with absent marker (deletedAt: undefined or omitted)', async () => {
      const matId = 'mat_test_absent_marker';
      const drId = 'dr_test_absent_marker';

      const pullResponse: SyncPullResponse = {
        newCursor: 35,
        hasMore: false,
        changes: [
          {
            sequence: 33,
            entityType: 'material',
            entityId: matId,
            operation: 'UPSERT',
            changedAt: '2026-10-26T10:00:00.000Z',
            data: {
              id: matId,
              title: 'Neuroanatomy Overview',
              createdAt: '2026-10-26T10:00:00.000Z',
              deletedAt: undefined, // Explicit undefined
            },
          },
          {
            sequence: 34,
            entityType: 'drawing',
            entityId: drId,
            operation: 'UPSERT',
            changedAt: '2026-10-26T10:00:00.000Z',
            data: {
              // deletedAt field omitted entirely
              id: drId,
              documentId: 'doc_anat_1',
              color: '#0000ff',
              thickness: 2,
              points: [{ x: 0.5, y: 0.5 }],
              createdAt: '2026-10-26T10:00:00.000Z',
            },
          },
        ],
      };

      const result = await reconciler.reconcilePullBatch(testDb, userId, deviceId, 32, pullResponse);

      expect(result.appliedCount).toBe(2);

      const storedMat = await testDb.materials.get(matId);
      expect(storedMat).toBeDefined();
      expect(storedMat?.title).toBe('Neuroanatomy Overview');

      const storedDr = await testDb.drawings.get(drId);
      expect(storedDr).toBeDefined();
      expect(storedDr?.color).toBe('#0000ff');

      expect(await testDb.tombstones.get(`material:${matId}`)).toBeUndefined();
      expect(await testDb.tombstones.get(`drawing:${drId}`)).toBeUndefined();
    });
  });

  describe('4. Explicit DELETE and genuine soft-deletion markers preserve deletion semantics', () => {
    it('4a: deletes row and records tombstone on explicit DELETE with data: null', async () => {
      const matId = 'mat_test_explicit_del_null';
      await testDb.materials.put({
        id: matId,
        title: 'To Be Explicitly Deleted',
        documentId: 'doc_anat_del',
        createdAt: '2026-10-26T08:00:00.000Z',
        updatedAt: '2026-10-26T08:00:00.000Z',
      });

      const pullResponse: SyncPullResponse = {
        newCursor: 40,
        hasMore: false,
        changes: [
          {
            sequence: 41,
            entityType: 'material',
            entityId: matId,
            operation: 'DELETE',
            changedAt: '2026-10-26T11:00:00.000Z',
            data: null,
          },
        ],
      };

      const result = await reconciler.reconcilePullBatch(testDb, userId, deviceId, 35, pullResponse);

      expect(result.appliedCount).toBe(1);

      // Material must be deleted
      expect(await testDb.materials.get(matId)).toBeUndefined();

      // Tombstone must be recorded
      const tombstone = await testDb.tombstones.get(`material:${matId}`);
      expect(tombstone).toBeDefined();
      expect(tombstone?.entity).toBe('material');
      expect(tombstone?.key).toBe(matId);
    });

    it('4b: deletes row and records tombstone on explicit DELETE carrying data: { deletedAt: null }', async () => {
      const drId = 'dr_test_explicit_del_with_obj';
      await testDb.drawings.put({
        id: drId,
        documentId: 'doc_1',
        color: '#ff0000',
        thickness: 1,
        points: [],
        createdAt: '2026-10-26T08:00:00.000Z',
      });

      const pullResponse: SyncPullResponse = {
        newCursor: 42,
        hasMore: false,
        changes: [
          {
            sequence: 42,
            entityType: 'drawing',
            entityId: drId,
            operation: 'DELETE',
            changedAt: '2026-10-26T11:00:00.000Z',
            data: { deletedAt: null },
          },
        ],
      };

      const result = await reconciler.reconcilePullBatch(testDb, userId, deviceId, 40, pullResponse);

      expect(result.appliedCount).toBe(1);
      expect(await testDb.drawings.get(drId)).toBeUndefined();

      const tombstone = await testDb.tombstones.get(`drawing:${drId}`);
      expect(tombstone).toBeDefined();
      expect(tombstone?.entity).toBe('drawing');
    });

    it('4c: deletes row and records tombstone on UPSERT with genuine soft-deletion timestamp', async () => {
      const matId = 'mat_test_genuine_soft_del';
      await testDb.materials.put({
        id: matId,
        title: 'Soft Deleted Material',
        documentId: 'doc_anat_soft',
        createdAt: '2026-10-26T08:00:00.000Z',
        updatedAt: '2026-10-26T08:00:00.000Z',
      });

      const softDeleteTimestamp = '2026-10-26T11:30:00.000Z';
      const pullResponse: SyncPullResponse = {
        newCursor: 45,
        hasMore: false,
        changes: [
          {
            sequence: 43,
            entityType: 'material',
            entityId: matId,
            operation: 'UPSERT',
            changedAt: softDeleteTimestamp,
            data: {
              id: matId,
              title: 'Soft Deleted Material',
              deletedAt: softDeleteTimestamp,
            },
          },
        ],
      };

      const result = await reconciler.reconcilePullBatch(testDb, userId, deviceId, 42, pullResponse);

      expect(result.appliedCount).toBe(1);
      expect(await testDb.materials.get(matId)).toBeUndefined();

      const tombstone = await testDb.tombstones.get(`material:${matId}`);
      expect(tombstone).toBeDefined();
      expect(tombstone?.entity).toBe('material');
      expect(tombstone?.key).toBe(matId);
    });

    it('4d: deletes row and records tombstone on explicit DELETE with data: undefined', async () => {
      const matId = 'mat_test_del_undefined_payload';
      await testDb.materials.put({
        id: matId,
        title: 'Delete With Undefined Data',
        documentId: 'doc_del_undef',
        createdAt: '2026-10-26T08:00:00.000Z',
        updatedAt: '2026-10-26T08:00:00.000Z',
      });

      const pullResponse: SyncPullResponse = {
        newCursor: 48,
        hasMore: false,
        changes: [
          {
            sequence: 48,
            entityType: 'material',
            entityId: matId,
            operation: 'DELETE',
            changedAt: '2026-10-26T11:45:00.000Z',
            data: undefined,
          },
        ],
      };

      const result = await reconciler.reconcilePullBatch(testDb, userId, deviceId, 45, pullResponse);

      expect(result.appliedCount).toBe(1);

      // Material must be deleted from table
      expect(await testDb.materials.get(matId)).toBeUndefined();

      // Tombstone must be recorded
      const tombstone = await testDb.tombstones.get(`material:${matId}`);
      expect(tombstone).toBeDefined();
      expect(tombstone?.entity).toBe('material');
      expect(tombstone?.key).toBe(matId);

      // No held op created
      expect(await testDb.heldOps.count()).toBe(0);
    });

    it('4e: deletes row and records tombstone on explicit DELETE with omitted data field', async () => {
      const drId = 'dr_test_del_omitted_data';
      await testDb.drawings.put({
        id: drId,
        documentId: 'doc_del_omitted',
        points: [{ x: 5, y: 5 }],
        color: '#000000',
        thickness: 2,
        createdAt: '2026-10-26T08:00:00.000Z',
      });

      const pullResponse: SyncPullResponse = {
        newCursor: 49,
        hasMore: false,
        changes: [
          {
            sequence: 49,
            entityType: 'drawing',
            entityId: drId,
            operation: 'DELETE',
            changedAt: '2026-10-26T11:50:00.000Z',
          } as any,
        ],
      };

      const result = await reconciler.reconcilePullBatch(testDb, userId, deviceId, 48, pullResponse);

      expect(result.appliedCount).toBe(1);

      // Drawing must be deleted from table
      expect(await testDb.drawings.get(drId)).toBeUndefined();

      // Tombstone must be recorded
      const tombstone = await testDb.tombstones.get(`drawing:${drId}`);
      expect(tombstone).toBeDefined();
      expect(tombstone?.entity).toBe('drawing');
      expect(tombstone?.key).toBe(drId);

      // No held op created
      expect(await testDb.heldOps.count()).toBe(0);
    });
  });

  describe('5. Malformed or missing UPSERT payload does NOT delete existing rows', () => {
    it('5a: preserves existing row and durably retains heldOp with reason malformed-payload when UPSERT carries data: null', async () => {
      const matId = 'mat_test_preserved_row';
      await testDb.materials.put({
        id: matId,
        title: 'Valid Pre-existing Material',
        description: 'Should never be deleted by malformed UPSERT',
        documentId: 'doc_anat_preserve',
        createdAt: '2026-10-26T08:00:00.000Z',
        updatedAt: '2026-10-26T08:00:00.000Z',
      });

      const pullResponse: SyncPullResponse = {
        newCursor: 50,
        hasMore: false,
        changes: [
          {
            sequence: 51,
            entityType: 'material',
            entityId: matId,
            operation: 'UPSERT',
            changedAt: '2026-10-26T12:00:00.000Z',
            data: null, // Malformed: UPSERT with null data must NOT become a deletion
          },
        ],
      };

      await reconciler.reconcilePullBatch(testDb, userId, deviceId, 45, pullResponse);

      // Existing row must remain intact and completely unmodified
      const preservedMat = await testDb.materials.get(matId);
      expect(preservedMat).toBeDefined();
      expect(preservedMat?.title).toBe('Valid Pre-existing Material');
      expect(preservedMat?.description).toBe('Should never be deleted by malformed UPSERT');
      expect(preservedMat?.documentId).toBe('doc_anat_preserve');
      expect(preservedMat?.createdAt).toBe('2026-10-26T08:00:00.000Z');
      expect(preservedMat?.updatedAt).toBe('2026-10-26T08:00:00.000Z');

      // No tombstone exists
      const tombstone = await testDb.tombstones.get(`material:${matId}`);
      expect(tombstone).toBeUndefined();

      // Assert exact durable retention in testDb.heldOps
      const held = await testDb.heldOps.toArray();
      expect(held).toHaveLength(1);
      const heldOp = held[0];
      expect(heldOp.id).toBe(`material:${matId}:${heldOp.op.hlc}`);
      expect(heldOp.reason).toBe('malformed-payload');
      expect(heldOp.op.entity).toBe('material');
      expect(heldOp.op.key).toBe(matId);
      expect(heldOp.op.value).toBeNull();

      // syncState advances and commits the batch cursor
      const state = await testDb.syncState.get(createSyncStateKey(userId, deviceId));
      expect(state?.lastServerCursor).toBe(50);
    });

    it('5b: preserves existing row and records heldOp with reason malformed-payload for non-object/array payloads', async () => {
      const matId = 'mat_test_held_variants';
      const initialMat = {
        id: matId,
        title: 'Variant Pre-existing Material',
        documentId: 'doc_anat_var',
        createdAt: '2026-10-26T08:00:00.000Z',
        updatedAt: '2026-10-26T08:00:00.000Z',
      };
      await testDb.materials.put(initialMat);

      const variants = [
        { label: 'array', payload: [] },
        { label: 'string', payload: 'not-an-object' },
        { label: 'absent', payload: undefined },
      ];

      for (const [idx, v] of variants.entries()) {
        const cursor = 52 + idx;
        const pullResponse: SyncPullResponse = {
          newCursor: cursor,
          hasMore: false,
          changes: [
            {
              sequence: cursor,
              entityType: 'material',
              entityId: matId,
              operation: 'UPSERT',
              changedAt: `2026-10-26T12:0${idx}:00.000Z`,
              data: v.payload,
            },
          ],
        };

        await reconciler.reconcilePullBatch(testDb, userId, deviceId, cursor - 1, pullResponse);

        // Pre-existing material remains completely intact
        const preserved = await testDb.materials.get(matId);
        expect(preserved).toEqual(initialMat);
        expect(await testDb.tombstones.get(`material:${matId}`)).toBeUndefined();
      }

      // Check heldOps has recorded all 3 variants with reason malformed-payload
      const held = await testDb.heldOps.toArray();
      expect(held).toHaveLength(3);
      for (const op of held) {
        expect(op.reason).toBe('malformed-payload');
        expect(op.op.entity).toBe('material');
        expect(op.op.key).toBe(matId);
      }
    });
  });

  describe('6. Newer genuine tombstone is not erased by stale replay', () => {
    it('6a: preserves newer tombstone and prevents resurrection when older UPSERT is replayed', async () => {
      const drId = 'dr_test_stale_replay';
      const newerTombstoneHlc = '2026-10-26T12:00:00.000Z_0000_device-reconciler';

      // Establish newer genuine tombstone
      await testDb.tombstones.put({
        id: `drawing:${drId}`,
        entity: 'drawing',
        key: drId,
        hlc: newerTombstoneHlc,
      });

      // Stale replay arrives with older timestamp and deletedAt: null
      const pullResponse: SyncPullResponse = {
        newCursor: 60,
        hasMore: false,
        changes: [
          {
            sequence: 61,
            entityType: 'drawing',
            entityId: drId,
            operation: 'UPSERT',
            changedAt: '2026-10-26T10:00:00.000Z',
            ...({ hlc: '2026-10-26T10:00:00.000Z_0000_device-stale' } as any),
            data: {
              id: drId,
              documentId: 'doc_1',
              color: '#123456',
              thickness: 2,
              points: [{ x: 0, y: 0 }],
              createdAt: '2026-10-26T10:00:00.000Z',
              deletedAt: null,
            },
          },
        ],
      };

      const result = await reconciler.reconcilePullBatch(testDb, userId, deviceId, 50, pullResponse);

      // Stale write should not increment appliedCount
      expect(result.appliedCount).toBe(0);

      // Drawing must NOT be resurrected
      expect(await testDb.drawings.get(drId)).toBeUndefined();

      // Tombstone must remain intact with its newer HLC
      const tombstone = await testDb.tombstones.get(`drawing:${drId}`);
      expect(tombstone).toBeDefined();
      expect(tombstone?.hlc).toBe(newerTombstoneHlc);
    });
  });

  describe('7. Remote apply echo outbox suppression and checkpoint atomicity', () => {
    it('7a: remote pull reconciliation does NOT emit echo entries to syncQueue', async () => {
      // Install sync hooks so local mutations are captured to syncQueue
      const clock = createClock('device_test_r9');
      installSyncHooks(testDb, clock);

      // Clear any prior queue state
      await testDb.syncQueue.clear();
      expect(await testDb.syncQueue.count()).toBe(0);

      const pullResponse: SyncPullResponse = {
        newCursor: 70,
        hasMore: false,
        changes: [
          {
            sequence: 71,
            entityType: 'material',
            entityId: 'mat_remote_echo_check',
            operation: 'UPSERT',
            changedAt: '2026-10-26T13:00:00.000Z',
            data: {
              id: 'mat_remote_echo_check',
              title: 'Echo Check Material',
              createdAt: '2026-10-26T13:00:00.000Z',
              deletedAt: null,
            },
          },
          {
            sequence: 72,
            entityType: 'drawing',
            entityId: 'dr_remote_echo_check',
            operation: 'UPSERT',
            changedAt: '2026-10-26T13:05:00.000Z',
            data: {
              id: 'dr_remote_echo_check',
              documentId: 'doc_1',
              points: [{ x: 1, y: 1 }],
              color: '#333333',
              thickness: 1,
              createdAt: '2026-10-26T13:05:00.000Z',
              deletedAt: null,
            },
          },
        ],
      };

      const result = await reconciler.reconcilePullBatch(testDb, userId, deviceId, 60, pullResponse);

      expect(result.appliedCount).toBe(2);

      // Entities exist in local storage
      expect(await testDb.materials.get('mat_remote_echo_check')).toBeDefined();
      expect(await testDb.drawings.get('dr_remote_echo_check')).toBeDefined();

      // Crucial invariant: syncQueue must remain empty (NO remote echo mutations captured)
      const outboxCount = await testDb.syncQueue.count();
      expect(outboxCount).toBe(0);
    });

    it('7b: rejects preflight receipt user mismatch before opening transaction or mutating state', async () => {
      const stateKey = createSyncStateKey(userId, deviceId);

      // Baseline pull batch succeeds and establishes cursor 75
      const successBatch: SyncPullResponse = {
        newCursor: 75,
        hasMore: false,
        changes: [
          {
            sequence: 75,
            entityType: 'material',
            entityId: 'mat_test_atomic_success',
            operation: 'UPSERT',
            changedAt: '2026-10-26T14:00:00.000Z',
            data: {
              id: 'mat_test_atomic_success',
              title: 'Atomic Success Material',
              createdAt: '2026-10-26T14:00:00.000Z',
              deletedAt: null,
            },
          },
        ],
      };

      await reconciler.reconcilePullBatch(testDb, userId, deviceId, 70, successBatch);

      const stateAfterSuccess = await testDb.syncState.get(stateKey);
      expect(stateAfterSuccess?.lastServerCursor).toBe(75);
      expect(await testDb.materials.get('mat_test_atomic_success')).toBeDefined();

      // Subsequent batch fails validation (user receipt mismatch)
      const failingBatch: SyncPullResponse = {
        newCursor: 90,
        hasMore: false,
        receipt: {
          receiptId: 'receipt_mismatch_test',
          baseCursor: 75,
          userId: 'mismatched_wrong_user',
          deviceId,
          appliedFileIds: [],
        },
        changes: [
          {
            sequence: 76,
            entityType: 'material',
            entityId: 'mat_test_should_abort',
            operation: 'UPSERT',
            changedAt: '2026-10-26T14:10:00.000Z',
            data: {
              id: 'mat_test_should_abort',
              title: 'Should Never Persist',
              createdAt: '2026-10-26T14:10:00.000Z',
            },
          },
        ],
      };

      await expect(
        reconciler.reconcilePullBatch(testDb, userId, deviceId, 75, failingBatch)
      ).rejects.toThrow('Receipt user mismatch');

      // Uncommitted row was NOT persisted
      expect(await testDb.materials.get('mat_test_should_abort')).toBeUndefined();

      // Checkpoint cursor was NOT updated to 90; remains at 75
      const stateAfterFailure = await testDb.syncState.get(stateKey);
      expect(stateAfterFailure?.lastServerCursor).toBe(75);
    });

    it('7c: atomically rolls back live entities, heldOps, and syncState when post-write transaction failure occurs', async () => {
      let hookReached = false;
      testDb.syncState.hook('creating', () => {
        hookReached = true;
        throw new Error('Injected checkpoint failure');
      });

      const newTime = '2026-10-26T14:30:00.000Z';
      const failingBatch: SyncPullResponse = {
        newCursor: 85,
        hasMore: false,
        changes: [
          {
            sequence: 86,
            entityType: 'material',
            entityId: 'mat_post_write_live',
            operation: 'UPSERT',
            changedAt: newTime,
            data: {
              id: 'mat_post_write_live',
              title: 'Live Material Rolled Back',
              documentId: 'doc_live_rollback',
              createdAt: newTime,
              deletedAt: null,
            },
          },
          {
            sequence: 87,
            entityType: 'material',
            entityId: 'mat_post_write_malformed',
            operation: 'UPSERT',
            changedAt: newTime,
            data: null, // malformed payload -> heldOp
          },
        ],
      };

      await expect(
        reconciler.reconcilePullBatch(testDb, userId, deviceId, 0, failingBatch)
      ).rejects.toThrow('Injected checkpoint failure');

      expect(hookReached).toBe(true);

      // Complete atomic rollback: no live entities, heldOps, or syncState persisted
      expect(await testDb.materials.count()).toBe(0);
      expect(await testDb.heldOps.count()).toBe(0);
      expect(await testDb.syncState.count()).toBe(0);
    });
  });

  describe('8. Malformed or invalid deletedAt markers on UPSERT are held and preserve live rows', () => {
    it("8a: holds UPSERT with invalid string marker ('not-a-timestamp') without deleting or mutating row", async () => {
      const drId = 'dr_test_marker_invalid_str';
      const docId = 'doc_marker_test';
      const seedDrawing = {
        id: drId,
        documentId: docId,
        points: [{ x: 10, y: 10 }],
        color: '#ff0000',
        thickness: 2,
        createdAt: '2026-10-20T10:00:00.000Z',
      };
      await testDb.drawings.put(seedDrawing);

      const pullResponse: SyncPullResponse = {
        newCursor: 81,
        hasMore: false,
        changes: [
          {
            sequence: 81,
            entityType: 'drawing',
            entityId: drId,
            operation: 'UPSERT',
            changedAt: '2026-10-26T12:00:00.000Z',
            data: {
              ...seedDrawing,
              points: [{ x: 20, y: 20 }],
              deletedAt: 'not-a-timestamp',
            },
          },
        ],
      };

      await reconciler.reconcilePullBatch(testDb, userId, deviceId, 80, pullResponse);

      // Prior row remains intact and unmodified in the table
      const stored = await testDb.drawings.get(drId);
      expect(stored).toEqual(seedDrawing);

      // No tombstone created
      expect(await testDb.tombstones.get(`drawing:${drId}`)).toBeUndefined();

      // Exactly one heldOp is recorded with reason: 'malformed-marker'
      const held = await testDb.heldOps.toArray();
      expect(held).toHaveLength(1);
      expect(held[0].id).toBe(`drawing:${drId}:${held[0].op.hlc}`);
      expect(held[0].reason).toBe('malformed-marker');
      expect((held[0].op.value as any)?.deletedAt).toBe('not-a-timestamp');

      // syncState commits the batch cursor
      const state = await testDb.syncState.get(createSyncStateKey(userId, deviceId));
      expect(state?.lastServerCursor).toBe(81);
    });

    it("8b: holds UPSERT with empty string ('') and whitespace string ('   ') markers", async () => {
      for (const [idx, marker] of ['', '   '].entries()) {
        const matId = `mat_test_marker_empty_${idx}`;
        const seedMat = {
          id: matId,
          title: `Material Empty Marker ${idx}`,
          documentId: 'doc_empty_marker',
          createdAt: '2026-10-20T10:00:00.000Z',
          updatedAt: '2026-10-20T10:00:00.000Z',
        };
        await testDb.materials.put(seedMat);

        const cursor = 82 + idx;
        const pullResponse: SyncPullResponse = {
          newCursor: cursor,
          hasMore: false,
          changes: [
            {
              sequence: cursor,
              entityType: 'material',
              entityId: matId,
              operation: 'UPSERT',
              changedAt: '2026-10-26T12:00:00.000Z',
              data: {
                ...seedMat,
                title: 'Mutated Title That Should Not Persist',
                deletedAt: marker,
              },
            },
          ],
        };

        await reconciler.reconcilePullBatch(testDb, userId, deviceId, cursor - 1, pullResponse);

        // Prior row remains intact
        const stored = await testDb.materials.get(matId);
        expect(stored).toEqual(seedMat);

        // No tombstone
        expect(await testDb.tombstones.get(`material:${matId}`)).toBeUndefined();

        // Exactly one heldOp with reason: 'malformed-marker'
        const held = await testDb.heldOps.where('id').startsWith(`material:${matId}:`).toArray();
        expect(held).toHaveLength(1);
        expect(held[0].reason).toBe('malformed-marker');
        expect((held[0].op.value as any)?.deletedAt).toBe(marker);

        // syncState commits cursor
        const state = await testDb.syncState.get(createSyncStateKey(userId, deviceId));
        expect(state?.lastServerCursor).toBe(cursor);
      }
    });

    it('8c: holds UPSERT with boolean true and false markers and verifies pre-existing drawing remains visible to getDrawings', async () => {
      const docId = 'doc_drawing_boolean_test';
      const annotationRepo = new DexieAnnotationRepository(testDb);

      for (const [idx, boolVal] of [true, false].entries()) {
        const drId = `dr_test_marker_bool_${idx}`;
        const seedDrawing = {
          id: drId,
          documentId: docId,
          points: [{ x: idx, y: idx }],
          color: '#00ff00',
          thickness: 1,
          createdAt: '2026-10-20T10:00:00.000Z',
        };
        await testDb.drawings.put(seedDrawing);

        // Verify pre-existing drawing is initially visible
        const initialDrawings = await annotationRepo.getDrawings(docId);
        expect(initialDrawings.some((d) => d.id === drId)).toBe(true);

        const cursor = 85 + idx;
        const pullResponse: SyncPullResponse = {
          newCursor: cursor,
          hasMore: false,
          changes: [
            {
              sequence: cursor,
              entityType: 'drawing',
              entityId: drId,
              operation: 'UPSERT',
              changedAt: '2026-10-26T12:00:00.000Z',
              data: {
                ...seedDrawing,
                points: [{ x: 99, y: 99 }],
                deletedAt: boolVal,
              },
            },
          ],
        };

        await reconciler.reconcilePullBatch(testDb, userId, deviceId, cursor - 1, pullResponse);

        // Prior row remains intact and unmodified in drawings table
        const stored = await testDb.drawings.get(drId);
        expect(stored).toEqual(seedDrawing);

        // Drawing remains visible to DexieAnnotationRepository.getDrawings(documentId)
        const visibleDrawings = await annotationRepo.getDrawings(docId);
        const visibleRecord = visibleDrawings.find((d) => d.id === drId);
        expect(visibleRecord).toBeDefined();
        expect(visibleRecord?.points).toEqual([{ x: idx, y: idx }]);

        // No tombstone created
        expect(await testDb.tombstones.get(`drawing:${drId}`)).toBeUndefined();

        // Exactly one heldOp recorded with reason: 'malformed-marker'
        const held = await testDb.heldOps.where('id').startsWith(`drawing:${drId}:`).toArray();
        expect(held).toHaveLength(1);
        expect(held[0].reason).toBe('malformed-marker');
        expect((held[0].op.value as any)?.deletedAt).toBe(boolVal);

        // syncState commits cursor
        const state = await testDb.syncState.get(createSyncStateKey(userId, deviceId));
        expect(state?.lastServerCursor).toBe(cursor);
      }
    });

    it('8d: holds UPSERT with object marker ({ invalid: true })', async () => {
      const matId = 'mat_test_marker_obj';
      const seedMat = {
        id: matId,
        title: 'Material Object Marker',
        documentId: 'doc_obj_marker',
        createdAt: '2026-10-20T10:00:00.000Z',
        updatedAt: '2026-10-20T10:00:00.000Z',
      };
      await testDb.materials.put(seedMat);

      const pullResponse: SyncPullResponse = {
        newCursor: 88,
        hasMore: false,
        changes: [
          {
            sequence: 88,
            entityType: 'material',
            entityId: matId,
            operation: 'UPSERT',
            changedAt: '2026-10-26T12:00:00.000Z',
            data: {
              ...seedMat,
              deletedAt: { invalid: true },
            },
          },
        ],
      };

      await reconciler.reconcilePullBatch(testDb, userId, deviceId, 87, pullResponse);

      // Prior row remains intact
      expect(await testDb.materials.get(matId)).toEqual(seedMat);

      // No tombstone
      expect(await testDb.tombstones.get(`material:${matId}`)).toBeUndefined();

      // Exactly one heldOp with reason: 'malformed-marker'
      const held = await testDb.heldOps.where('id').startsWith(`material:${matId}:`).toArray();
      expect(held).toHaveLength(1);
      expect(held[0].reason).toBe('malformed-marker');
      expect((held[0].op.value as any)?.deletedAt).toEqual({ invalid: true });

      // Cursor commits
      const state = await testDb.syncState.get(createSyncStateKey(userId, deviceId));
      expect(state?.lastServerCursor).toBe(88);
    });

    it('8e: holds UPSERT with numeric marker 0 and numeric timestamps without accepting unsupported numeric fallback', async () => {
      for (const [idx, numMarker] of [0, 1729900000000].entries()) {
        const matId = `mat_test_marker_num_${idx}`;
        const seedMat = {
          id: matId,
          title: `Material Numeric Marker ${idx}`,
          documentId: 'doc_num_marker',
          createdAt: '2026-10-20T10:00:00.000Z',
          updatedAt: '2026-10-20T10:00:00.000Z',
        };
        await testDb.materials.put(seedMat);

        const cursor = 90 + idx;
        const pullResponse: SyncPullResponse = {
          newCursor: cursor,
          hasMore: false,
          changes: [
            {
              sequence: cursor,
              entityType: 'material',
              entityId: matId,
              operation: 'UPSERT',
              changedAt: '2026-10-26T12:00:00.000Z',
              data: {
                ...seedMat,
                deletedAt: numMarker,
              },
            },
          ],
        };

        await reconciler.reconcilePullBatch(testDb, userId, deviceId, cursor - 1, pullResponse);

        // Prior row remains intact
        expect(await testDb.materials.get(matId)).toEqual(seedMat);

        // No tombstone
        expect(await testDb.tombstones.get(`material:${matId}`)).toBeUndefined();

        // Exactly one heldOp with reason: 'malformed-marker'
        const held = await testDb.heldOps.where('id').startsWith(`material:${matId}:`).toArray();
        expect(held).toHaveLength(1);
        expect(held[0].reason).toBe('malformed-marker');
        expect((held[0].op.value as any)?.deletedAt).toBe(numMarker);

        // Cursor commits
        const state = await testDb.syncState.get(createSyncStateKey(userId, deviceId));
        expect(state?.lastServerCursor).toBe(cursor);
      }
    });

    it('8f: confirms valid ISO 8601 timestamps and date-only strings are accepted as genuine soft deletes (contrast check)', async () => {
      for (const [idx, validTimestamp] of ['2026-10-26T15:00:00.000Z', '2026-10-26'].entries()) {
        const matId = `mat_test_valid_soft_del_${idx}`;
        await testDb.materials.put({
          id: matId,
          title: `Material Valid Soft Delete ${idx}`,
          documentId: 'doc_valid_del',
          createdAt: '2026-10-20T10:00:00.000Z',
          updatedAt: '2026-10-20T10:00:00.000Z',
        });

        const cursor = 95 + idx;
        const pullResponse: SyncPullResponse = {
          newCursor: cursor,
          hasMore: false,
          changes: [
            {
              sequence: cursor,
              entityType: 'material',
              entityId: matId,
              operation: 'UPSERT',
              changedAt: '2026-10-26T16:00:00.000Z',
              data: {
                id: matId,
                title: `Material Valid Soft Delete ${idx}`,
                documentId: 'doc_valid_del',
                deletedAt: validTimestamp,
              },
            },
          ],
        };

        const result = await reconciler.reconcilePullBatch(testDb, userId, deviceId, cursor - 1, pullResponse);
        expect(result.appliedCount).toBe(1);

        // Row deleted from table
        expect(await testDb.materials.get(matId)).toBeUndefined();

        // Tombstone created
        const tombstone = await testDb.tombstones.get(`material:${matId}`);
        expect(tombstone).toBeDefined();

        // No heldOp created
        const held = await testDb.heldOps.where('id').startsWith(`material:${matId}:`).toArray();
        expect(held).toHaveLength(0);

        // Cursor committed
        const state = await testDb.syncState.get(createSyncStateKey(userId, deviceId));
        expect(state?.lastServerCursor).toBe(cursor);
      }
    });
  });
});
