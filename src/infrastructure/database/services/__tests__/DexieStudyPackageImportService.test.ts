import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import 'fake-indexeddb/auto';
import { LunaClairDatabase } from '../../schema/LunaClairDatabase';
import { DexieStudyPackageImportService } from '../DexieStudyPackageImportService';
import { FLOOR_ISO } from '../../../../domain/sync/utils/hlc';
import type { ImportStudyPackageRecords } from '../../../../domain/package/services/StudyPackageImportService';
import type { ImportedDocumentContent } from '../../../../domain/reader/repositories/DocumentContentRepository';

describe('DexieStudyPackageImportService', () => {
  let db: LunaClairDatabase;
  let service: DexieStudyPackageImportService;

  beforeEach(async () => {
    db = new LunaClairDatabase(`test-import-service-${Math.random().toString(36).slice(2)}`);
    await db.open();
    service = new DexieStudyPackageImportService(db);
  });

  afterEach(async () => {
    await db.delete();
    db.close();
  });

  function createTestRecords(options: {
    documentId?: string;
    title?: string;
    content?: string;
    updatedAt?: string;
  } = {}): ImportStudyPackageRecords {
    const documentId = options.documentId ?? 'doc_share_physics_101';
    const materialId = 'mat_share_physics_101';

    return {
      materials: [
        {
          id: materialId,
          title: options.title ?? 'Physics 101',
          documentId,
          order: 0,
          createdAt: FLOOR_ISO,
          updatedAt: FLOOR_ISO,
        },
      ],
      documentContents: [
        {
          documentId,
          title: options.title ?? 'Physics 101',
          content: options.content ?? '# Physics Template Notes',
          updatedAt: options.updatedAt ?? FLOOR_ISO,
        },
      ],
      questions: [
        {
          id: 'q_share_physics_101_pkg_q_1',
          materialId,
          type: 'true_false',
          prompt: 'Energy is conserved.',
          payload: { type: 'true_false', correctAnswer: true },
          difficulty: 'easy',
          points: 5,
          status: 'published',
          version: 1,
          createdAt: FLOOR_ISO,
          updatedAt: FLOOR_ISO,
        },
      ],
      quizzes: [],
      assets: [],
    };
  }

  describe('Mode 1: Cold Clone (existingDoc == null)', () => {
    it('writes documentContents with updatedAt = FLOOR_ISO and deletedAt = null, bypassing syncQueue', async () => {
      const records = createTestRecords();

      await service.importStudyPackage(records);

      const doc = await db.documentContents.get('doc_share_physics_101');
      expect(doc).toBeDefined();
      expect(doc?.documentId).toBe('doc_share_physics_101');
      expect(doc?.title).toBe('Physics 101');
      expect(doc?.content).toBe('# Physics Template Notes');
      expect(doc?.updatedAt).toBe(FLOOR_ISO);
      expect(doc?.deletedAt).toBeNull();

      // Invariant: zero outbox entries emitted on cold clone
      const outbox = await db.syncQueue.toArray();
      expect(outbox).toHaveLength(0);

      // Verify materials and questions were also committed
      const mat = await db.materials.get('mat_share_physics_101');
      expect(mat).toBeDefined();
      expect(mat?.createdAt).toBe(FLOOR_ISO);

      const q = await db.questions.get('q_share_physics_101_pkg_q_1');
      expect(q).toBeDefined();
    });
  });

  describe('Mode 2: Preserved Hydration (existingDoc != null && !existingDoc.deletedAt)', () => {
    it('Branch A: preserves user content and updatedAt when existingDoc.updatedAt > FLOOR_ISO', async () => {
      const userEditedAt = '2026-10-16T10:30:00.000Z';
      const existingDoc: ImportedDocumentContent = {
        documentId: 'doc_share_physics_101',
        title: 'Physics 101',
        content: '# My Custom Personal Notes\nI added this explanation!',
        updatedAt: userEditedAt,
        version: 3,
        deletedAt: null,
      };
      await db.documentContents.put(existingDoc);

      const incomingRecords = createTestRecords({
        content: '# Upstream Template Should Not Overwrite',
        title: 'Physics 101 Updated Title',
      });

      await service.importStudyPackage(incomingRecords);

      const savedDoc = await db.documentContents.get('doc_share_physics_101');
      expect(savedDoc).toBeDefined();
      // Crucial: user markdown and user updatedAt are kept verbatim!
      expect(savedDoc?.content).toBe('# My Custom Personal Notes\nI added this explanation!');
      expect(savedDoc?.updatedAt).toBe(userEditedAt);
      expect(savedDoc?.version).toBe(3);
      expect(savedDoc?.title).toBe('Physics 101 Updated Title');

      // No sync outbox emitted
      const outbox = await db.syncQueue.toArray();
      expect(outbox).toHaveLength(0);
    });

    it('Branch B: updates content and title safely when existingDoc.updatedAt === FLOOR_ISO', async () => {
      const existingDoc: ImportedDocumentContent = {
        documentId: 'doc_share_physics_101',
        title: 'Physics 101 Old Title',
        content: '# Old Template Content',
        updatedAt: FLOOR_ISO,
        deletedAt: null,
      };
      await db.documentContents.put(existingDoc);

      const incomingRecords = createTestRecords({
        title: 'Physics 101 New Title',
        content: '# Refreshed Template Content',
      });

      await service.importStudyPackage(incomingRecords);

      const savedDoc = await db.documentContents.get('doc_share_physics_101');
      expect(savedDoc).toBeDefined();
      expect(savedDoc?.title).toBe('Physics 101 New Title');
      expect(savedDoc?.content).toBe('# Refreshed Template Content');
      expect(savedDoc?.updatedAt).toBe(FLOOR_ISO);
      expect(savedDoc?.deletedAt).toBeNull();

      // No sync outbox emitted
      const outbox = await db.syncQueue.toArray();
      expect(outbox).toHaveLength(0);
    });
  });

  describe('Mode 3: Tombstone Resurrection (existingDoc != null && existingDoc.deletedAt != null)', () => {
    it('revives tombstoned document, enqueues UPSERT to syncQueue, and sweeps lingering un-tombstoned annotations', async () => {
      const deletedAt = '2026-10-15T08:00:00.000Z';
      const existingDoc: ImportedDocumentContent = {
        documentId: 'doc_share_physics_101',
        title: 'Physics 101',
        content: '# Old Content',
        updatedAt: deletedAt,
        version: 2,
        deletedAt,
      };
      await db.documentContents.put(existingDoc);

      // Seed annotations: one un-tombstoned highlight, one already tombstoned highlight
      await db.highlights.bulkPut([
        {
          id: 'hl-lingering-1',
          documentId: 'doc_share_physics_101',
          start: 0,
          end: 10,
          color: 'yellow',
          text: 'Lingering',
          createdAt: '2026-10-14T00:00:00.000Z',
          // un-tombstoned (deletedAt undefined)
        },
        {
          id: 'hl-already-deleted',
          documentId: 'doc_share_physics_101',
          start: 15,
          end: 25,
          color: 'blue',
          text: 'Already Deleted',
          createdAt: '2026-10-14T00:00:00.000Z',
          deletedAt: '2026-10-14T12:00:00.000Z',
        },
      ]);

      // Seed drawings: one un-tombstoned drawing
      await db.drawings.bulkPut([
        {
          id: 'drawing-lingering-1',
          documentId: 'doc_share_physics_101',
          color: '#ff0000',
          thickness: 2,
          points: [{ x: 0.1, y: 0.1 }],
          createdAt: '2026-10-14T00:00:00.000Z',
          // un-tombstoned
        },
      ]);

      const incomingRecords = createTestRecords({
        title: 'Physics 101 Resurrected',
        content: '# Freshly Resurrected Course Notes',
      });

      const beforeImport = new Date().toISOString();
      await service.importStudyPackage(incomingRecords);
      const afterImport = new Date().toISOString();

      // 1. Verify document is resurrected
      const savedDoc = await db.documentContents.get('doc_share_physics_101');
      expect(savedDoc).toBeDefined();
      expect(savedDoc?.deletedAt).toBeNull();
      expect(savedDoc?.title).toBe('Physics 101 Resurrected');
      expect(savedDoc?.content).toBe('# Freshly Resurrected Course Notes');
      expect(savedDoc?.version).toBe(3);
      expect(savedDoc!.updatedAt >= beforeImport && savedDoc!.updatedAt <= afterImport).toBe(true);

      // 2. Verify syncQueue outbox mutation is enqueued
      const outbox = await db.syncQueue.toArray();
      expect(outbox).toHaveLength(1);
      const item = outbox[0];
      expect(item.entityType).toBe('document');
      expect(item.entityId).toBe('doc_share_physics_101');
      expect(item.operation).toBe('UPSERT');
      expect(item.baseVersion).toBe(2);
      expect(item.status).toBe('pending');
      expect(item.payload).toEqual({
        documentId: 'doc_share_physics_101',
        title: 'Physics 101 Resurrected',
        content: '# Freshly Resurrected Course Notes',
        updatedAt: savedDoc?.updatedAt,
        version: 3,
      });

      // 3. Verify lingering un-tombstoned annotations are swept
      const hlLingering = await db.highlights.get('hl-lingering-1');
      expect(hlLingering?.deletedAt).toBe(savedDoc?.updatedAt);
      expect(hlLingering?.updatedAt).toBe(savedDoc?.updatedAt);

      const hlAlreadyDeleted = await db.highlights.get('hl-already-deleted');
      expect(hlAlreadyDeleted?.deletedAt).toBe('2026-10-14T12:00:00.000Z'); // preserved

      const drawingLingering = await db.drawings.get('drawing-lingering-1');
      expect(drawingLingering?.deletedAt).toBe(savedDoc?.updatedAt);
      expect(drawingLingering?.updatedAt).toBe(savedDoc?.updatedAt);
    });
  });
});
