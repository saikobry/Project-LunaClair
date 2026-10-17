import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import 'fake-indexeddb/auto';
import {
  LunaClairDatabase,
  clearVaultDatabaseCache,
} from '../../../database/schema/LunaClairDatabase';
import {
  deriveEntityHlc,
  paginateTable,
  compressChunkGzip,
  streamVaultChunksGzipped,
  collectVaultChunksGzipped,
  DEFAULT_MAX_COMPRESSED_BYTES,
  DEFAULT_UNCOMPRESSED_CEILING_BYTES,
} from '../streamVaultChunksGzipped';
import { FLOOR_ISO, CANONICAL_FLOOR_HLC } from '../../../../domain/sync/utils/hlc';
import { gzipDecompress } from '../GoogleDriveClient';

describe('Infrastructure: streamVaultChunksGzipped', () => {
  const testDbName = 'test-stream-vault-db';
  let db: LunaClairDatabase;
  const testDeviceId = 'device-test-123';

  beforeEach(async () => {
    clearVaultDatabaseCache();
    db = new LunaClairDatabase(testDbName);
    await db.open();
    await Promise.all([
      db.materials.clear(),
      db.questions.clear(),
      db.quizzes.clear(),
      db.documentContents.clear(),
      db.highlights.clear(),
      db.drawings.clear(),
      db.flashcardReviews.clear(),
      db.quizSessions.clear(),
      db.reviewLogs.clear(),
    ]);
  });

  afterEach(async () => {
    if (db && db.isOpen()) {
      await Promise.all([
        db.materials.clear(),
        db.questions.clear(),
        db.quizzes.clear(),
        db.documentContents.clear(),
        db.highlights.clear(),
        db.drawings.clear(),
        db.flashcardReviews.clear(),
        db.quizSessions.clear(),
        db.reviewLogs.clear(),
      ]);
      db.close();
    }
    clearVaultDatabaseCache();
  });

  describe('deriveEntityHlc()', () => {
    it('formats valid ISO date into deterministic HLC string', () => {
      const hlc = deriveEntityHlc('2026-10-15T12:30:00.000Z', 'dev-1');
      expect(hlc).toBe('2026-10-15T12:30:00.000Z_0000_dev-1');
    });

    it('returns CANONICAL_FLOOR_HLC when timestamp equals FLOOR_ISO', () => {
      const hlc = deriveEntityHlc(FLOOR_ISO, 'dev-1');
      expect(hlc).toBe(CANONICAL_FLOOR_HLC);
    });

    it('falls back to Unix epoch if timestamp is undefined or invalid', () => {
      const hlc1 = deriveEntityHlc(undefined, 'dev-1');
      expect(hlc1).toBe('1970-01-01T00:00:00.000Z_0000_dev-1');

      const hlc2 = deriveEntityHlc('invalid-date', 'dev-1');
      expect(hlc2).toBe('1970-01-01T00:00:00.000Z_0000_dev-1');
    });
  });

  describe('paginateTable()', () => {
    it('paginates across records using keyset pagination with batchSize', async () => {
      const docs = Array.from({ length: 25 }, (_, i) => ({
        documentId: `doc-${String(i).padStart(3, '0')}`,
        title: `Document ${i}`,
        content: `Markdown content ${i}`,
        updatedAt: '2026-10-15T12:00:00.000Z',
        version: 1,
      }));

      await db.documentContents.bulkPut(docs);

      const retrieved: string[] = [];
      for await (const doc of paginateTable(db.documentContents, 10)) {
        retrieved.push(doc.documentId);
      }

      expect(retrieved).toHaveLength(25);
      expect(retrieved[0]).toBe('doc-000');
      expect(retrieved[24]).toBe('doc-024');
    });

    it('yields nothing when table is empty', async () => {
      const retrieved: unknown[] = [];
      for await (const doc of paginateTable(db.documentContents, 10)) {
        retrieved.push(doc);
      }
      expect(retrieved).toHaveLength(0);
    });
  });

  describe('compressChunkGzip()', () => {
    it('compresses JSON payload into valid gzip byte buffer', async () => {
      const payload = { test: 'value', numbers: [1, 2, 3, 4, 5] };
      const compressed = await compressChunkGzip(payload);

      expect(compressed).toBeInstanceOf(Uint8Array);
      expect(compressed.byteLength).toBeGreaterThan(0);

      // Verify round-trip decompression
      const decompressedBytes = await gzipDecompress(compressed);
      const decompressedJson = JSON.parse(new TextDecoder().decode(decompressedBytes));
      expect(decompressedJson).toEqual(payload);
    });
  });

  describe('streamVaultChunksGzipped()', () => {
    it('yields a single empty baseline snapshot chunk when vault has zero records', async () => {
      const chunks = await collectVaultChunksGzipped(db, testDeviceId);

      expect(chunks).toHaveLength(1);
      const chunk = chunks[0]!;
      expect(chunk.mutations).toHaveLength(0);
      expect(chunk.deviceId).toBe(testDeviceId);
      expect(chunk.compressedGzip.byteLength).toBeLessThan(DEFAULT_MAX_COMPRESSED_BYTES);

      const decompressed = JSON.parse(
        new TextDecoder().decode(await gzipDecompress(chunk.compressedGzip))
      );
      expect(decompressed.mutations).toEqual([]);
      expect(decompressed.version).toBe(1);
    });

    it('iterates over streamVaultChunksGzipped async generator directly', async () => {
      const chunks: unknown[] = [];
      for await (const chunk of streamVaultChunksGzipped(db, testDeviceId)) {
        chunks.push(chunk);
      }
      expect(chunks).toHaveLength(1);
    });

    it('reads authoritative tables, packages mutations, and derives per-entity HLC timestamps', async () => {
      await db.documentContents.put({
        documentId: 'doc-1',
        title: 'Doc 1',
        content: '# Content 1',
        updatedAt: '2026-10-10T10:00:00.000Z',
        version: 2,
      });

      await db.highlights.put({
        id: 'hl-1',
        documentId: 'doc-1',
        start: 0,
        end: 10,
        color: 'yellow',
        text: 'highlighted',
        createdAt: '2026-10-11T11:00:00.000Z',
      });

      await db.drawings.put({
        id: 'dr-1',
        documentId: 'doc-1',
        color: '#ff0000',
        thickness: 3,
        points: [{ x: 10, y: 20 }],
        createdAt: '2026-10-12T12:00:00.000Z',
      });

      await db.reviewLogs.put({
        id: 'rev-1',
        cardKey: 'fc-1',
        kind: 'review',
        rating: 3,
        at: new Date('2026-10-12T10:00:00.000Z').getTime(),
        deviceId: 'dev-1',
      });

      await db.quizSessions.put({
        id: 'qs-1',
        quizId: 'quiz-1',
        mode: 'practice',
        status: 'completed',
        questionSnapshots: {},
        answers: [],
        startedAt: '2026-10-14T15:00:00.000Z',
        completedAt: '2026-10-14T15:30:00.000Z',
      });

      const chunks = await collectVaultChunksGzipped(db, testDeviceId);

      expect(chunks).toHaveLength(1);
      const chunk = chunks[0]!;
      expect(chunk.mutations).toHaveLength(5);

      const entityTypes = chunk.mutations.map((m) => m.entityType);
      expect(entityTypes).toEqual([
        'reviewLog',
        'document',
        'highlight',
        'drawing',
        'quizSession',
      ]);

      const docMutation = chunk.mutations.find((m) => m.entityType === 'document')!;
      expect(docMutation.clientTimestamp).toBe('2026-10-10T10:00:00.000Z_0000_device-test-123');

      const hlMutation = chunk.mutations.find((m) => m.entityType === 'highlight')!;
      expect(hlMutation.clientTimestamp).toBe('2026-10-11T11:00:00.000Z_0000_device-test-123');

      const revMutation = chunk.mutations.find((m) => (m.entityType as string) === 'reviewLog')!;
      expect(revMutation.clientTimestamp).toBe('2026-10-12T10:00:00.000Z_0000_device-test-123');

      const qsMutation = chunk.mutations.find((m) => m.entityType === 'quizSession')!;
      expect(qsMutation.clientTimestamp).toBe('2026-10-14T15:30:00.000Z_0000_device-test-123');

      expect(chunk.compressedGzip.byteLength).toBeLessThan(DEFAULT_MAX_COMPRESSED_BYTES);
    });

    it('enforces uncompressed chunk ceiling and splits large vaults into multiple chunks', async () => {
      // Put 6 documents, but configure uncompressedCeilingBytes very low (300 bytes)
      const docs = Array.from({ length: 6 }, (_, i) => ({
        documentId: `doc-large-${i}`,
        title: `Document Large ${i}`,
        content: `Long text body intended to exceed byte threshold #${i} ${'x'.repeat(200)}`,
        updatedAt: '2026-10-15T12:00:00.000Z',
        version: 1,
      }));
      await db.documentContents.bulkPut(docs);

      const chunks = await collectVaultChunksGzipped(db, testDeviceId, {
        uncompressedCeilingBytes: 500, // Enforce split
      });

      expect(chunks.length).toBeGreaterThan(1);
      const totalMutations = chunks.reduce((acc, c) => acc + c.mutations.length, 0);
      expect(totalMutations).toBe(6);

      for (const chunk of chunks) {
        expect(chunk.compressedGzip.byteLength).toBeLessThan(DEFAULT_MAX_COMPRESSED_BYTES);
      }
    });

    it('skips unmodified template documents where updatedAt === FLOOR_ISO and !deletedAt from baseline snapshot', async () => {
      // 1. Unmodified template document (should be filtered out)
      await db.documentContents.put({
        documentId: 'doc-template-clean',
        title: 'Explore Template Document',
        content: '# Clean imported course',
        updatedAt: FLOOR_ISO,
        version: 1,
      });

      // 2. User-edited document (should be included)
      await db.documentContents.put({
        documentId: 'doc-user-edited',
        title: 'Edited Document',
        content: '# User edited content',
        updatedAt: '2026-10-16T10:00:00.000Z',
        version: 2,
      });

      // 3. Tombstoned document with floor updatedAt (should be included)
      await db.documentContents.put({
        documentId: 'doc-tombstoned',
        title: 'Tombstoned Document',
        content: '# Deleted content',
        updatedAt: FLOOR_ISO,
        deletedAt: '2026-10-16T11:00:00.000Z',
        version: 1,
      });

      const chunks = await collectVaultChunksGzipped(db, testDeviceId);
      expect(chunks).toHaveLength(1);

      const mutations = chunks[0]!.mutations;
      const docIds = mutations.map((m) => m.entityId);

      expect(docIds).not.toContain('doc-template-clean');
      expect(docIds).toContain('doc-user-edited');
      expect(docIds).toContain('doc-tombstoned');
      expect(mutations).toHaveLength(2);
    });

    it('Golden Parity Test: populated fixture database produces parent-first topological mutations, skips floor template, and satisfies chunk invariants', async () => {
      // 1. Explore cloned material (unmodified -> pointer)
      await db.materials.put({
        id: 'mat-explore-1',
        originShareId: 'share-explore-123',
        documentId: 'doc_share_share-explore-123',
        title: 'Quantum Foundations',
        description: 'Explore package course',
        tags: ['physics'],
        createdAt: '2026-10-01T10:00:00.000Z',
        updatedAt: '2026-10-01T10:00:00.000Z',
      });

      // 2. Custom material (original authoring -> material)
      await db.materials.put({
        id: 'mat-custom-1',
        documentId: 'doc-user-1',
        title: 'Cellular Biology',
        description: 'Original study material',
        tags: ['biology'],
        createdAt: '2026-10-02T10:00:00.000Z',
        updatedAt: '2026-10-02T10:00:00.000Z',
      });

      // 3. Unmodified Explore template document at FLOOR_ISO (must be skipped)
      await db.documentContents.put({
        documentId: 'doc_share_share-explore-123',
        title: 'Quantum Foundations Template',
        content: '# Clean imported course',
        updatedAt: FLOOR_ISO,
        version: 1,
      });

      // 4. User-modified document
      await db.documentContents.put({
        documentId: 'doc-user-1',
        title: 'Cell Organelles Notes',
        content: '# Mitochondria & Nucleus',
        updatedAt: '2026-10-05T12:00:00.000Z',
        version: 2,
      });

      // 5. Questions (child of mat-custom-1)
      await db.questions.put({
        id: 'q-custom-1',
        materialId: 'mat-custom-1',
        type: 'multiple_choice',
        prompt: 'Which organelle generates ATP?',
        difficulty: 'medium',
        points: 1,
        status: 'published',
        payload: {
          type: 'multiple_choice',
          choices: ['Mitochondria', 'Golgi apparatus'],
          correctIndex: 0,
        },
        createdAt: '2026-10-06T10:00:00.000Z',
        updatedAt: '2026-10-06T10:00:00.000Z',
        version: 1,
      });

      // 6. Quizzes (child of mat-custom-1 and q-custom-1)
      await db.quizzes.put({
        id: 'quiz-custom-1',
        materialId: 'mat-custom-1',
        title: 'Organelles Assessment',
        items: [
          {
            quizId: 'quiz-custom-1',
            questionId: 'q-custom-1',
            questionVersion: 1,
            order: 0,
            points: 1,
          },
        ],
        status: 'published',
        questionIds: ['q-custom-1'],
        createdAt: '2026-10-07T10:00:00.000Z',
        updatedAt: '2026-10-07T10:00:00.000Z',
      });

      // 7. Highlights (child of doc-user-1)
      await db.highlights.put({
        id: 'hl-custom-1',
        documentId: 'doc-user-1',
        start: 0,
        end: 12,
        color: 'yellow',
        text: 'Mitochondria',
        createdAt: '2026-10-08T10:00:00.000Z',
      });

      // 8. Drawings (child of doc-user-1)
      await db.drawings.put({
        id: 'dr-custom-1',
        documentId: 'doc-user-1',
        color: '#00ff00',
        thickness: 2,
        points: [{ x: 5, y: 10 }],
        createdAt: '2026-10-08T11:00:00.000Z',
      });

      // 9. Review logs (flashcard study log)
      await db.reviewLogs.put({
        id: 'rev-custom-1',
        cardKey: 'q:q-custom-1',
        kind: 'review',
        rating: 3,
        at: new Date('2026-10-09T10:00:00.000Z').getTime(),
        deviceId: testDeviceId,
      });

      // 10. Quiz sessions (child of quiz-custom-1)
      await db.quizSessions.put({
        id: 'qs-custom-1',
        quizId: 'quiz-custom-1',
        mode: 'practice',
        status: 'completed',
        questionSnapshots: {},
        answers: [],
        startedAt: '2026-10-10T14:00:00.000Z',
        completedAt: '2026-10-10T14:30:00.000Z',
      });

      const chunks = await collectVaultChunksGzipped(db, testDeviceId);

      expect(chunks).toHaveLength(1);
      const chunk = chunks[0]!;
      const mutations = chunk.mutations;

      // Invariant: Unmodified template document at FLOOR_ISO is NEVER emitted
      const entityIds = mutations.map((m) => m.entityId);
      expect(entityIds).not.toContain('doc_share_share-explore-123');

      // 9 valid mutations are emitted
      expect(mutations).toHaveLength(9);

      // Verify parent-first topological ordering invariants:
      const indexOfFirst = (entityType: string) =>
        mutations.findIndex((m) => m.entityType === entityType);
      const indexOfLast = (entityType: string) => {
        for (let i = mutations.length - 1; i >= 0; i--) {
          if (mutations[i]?.entityType === entityType) return i;
        }
        return -1;
      };

      const lastMaterialIdx = Math.max(indexOfLast('material'), indexOfLast('pointer'));
      const firstDocIdx = indexOfFirst('document');
      const firstQuestionIdx = indexOfFirst('question');
      const firstQuizIdx = indexOfFirst('quiz');
      const firstHighlightIdx = indexOfFirst('highlight');
      const firstDrawingIdx = indexOfFirst('drawing');
      const firstQuizSessionIdx = indexOfFirst('quizSession');

      // Materials (pointer and custom) appear before dependent documents and questions
      expect(lastMaterialIdx).toBeLessThan(firstDocIdx);
      expect(lastMaterialIdx).toBeLessThan(firstQuestionIdx);

      // Documents appear before annotations (highlights and drawings)
      expect(firstDocIdx).toBeLessThan(firstHighlightIdx);
      expect(firstDocIdx).toBeLessThan(firstDrawingIdx);

      // Questions appear before quizzes
      expect(firstQuestionIdx).toBeLessThan(firstQuizIdx);

      // Quizzes appear before quiz sessions
      expect(firstQuizIdx).toBeLessThan(firstQuizSessionIdx);

      // Verify uncompressed and compressed chunk invariants
      expect(chunk.uncompressedBytes).toBeGreaterThan(0);
      expect(chunk.uncompressedBytes).toBeLessThanOrEqual(DEFAULT_UNCOMPRESSED_CEILING_BYTES);
      expect(chunk.compressedGzip.byteLength).toBeGreaterThan(0);
      expect(chunk.compressedGzip.byteLength).toBeLessThan(DEFAULT_MAX_COMPRESSED_BYTES);

      // Round-trip decompression verification
      const decompressedBytes = await gzipDecompress(chunk.compressedGzip);
      const decompressedPayload = JSON.parse(new TextDecoder().decode(decompressedBytes));
      expect(decompressedPayload.version).toBe(1);
      expect(decompressedPayload.deviceId).toBe(testDeviceId);
      expect(decompressedPayload.mutations).toHaveLength(9);
      expect(decompressedPayload.watermarks[testDeviceId]).toBe(decompressedPayload.hlc);
    });

    it('skips tables belonging to disabled categories via isCategoryEnabled option', async () => {
      await db.materials.put({
        id: 'mat-1',
        documentId: 'doc-1',
        title: 'Title',
        createdAt: '2026-10-01T10:00:00.000Z',
        updatedAt: '2026-10-01T10:00:00.000Z',
      });

      await db.highlights.put({
        id: 'hl-1',
        documentId: 'doc-1',
        start: 0,
        end: 5,
        color: 'yellow',
        text: 'hello',
        createdAt: '2026-10-02T10:00:00.000Z',
      });

      // Disable annotations category
      const chunks = await collectVaultChunksGzipped(db, testDeviceId, {
        isCategoryEnabled: (cat) => cat !== 'annotations',
      });

      expect(chunks).toHaveLength(1);
      const types = chunks[0]!.mutations.map((m) => m.entityType);
      expect(types).toContain('material');
      expect(types).not.toContain('highlight');
    });
  });
});
