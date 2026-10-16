import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import 'fake-indexeddb/auto';
import {
  openVaultDatabase,
  clearVaultDatabaseCache,
  type LunaClairDatabase,
} from '../../../database/schema/LunaClairDatabase';
import {
  deriveEntityHlc,
  paginateTable,
  compressChunkGzip,
  streamVaultChunksGzipped,
  collectVaultChunksGzipped,
  DEFAULT_MAX_COMPRESSED_BYTES,
} from '../streamVaultChunksGzipped';
import { FLOOR_ISO, CANONICAL_FLOOR_HLC } from '../../../../domain/sync/utils/hlc';
import { gzipDecompress } from '../GoogleDriveClient';

describe('Infrastructure: streamVaultChunksGzipped', () => {
  const testDbName = 'test-stream-vault-db';
  let db: LunaClairDatabase;
  const testDeviceId = 'device-test-123';

  beforeEach(async () => {
    clearVaultDatabaseCache();
    db = openVaultDatabase(testDbName);
    await db.open();
    await Promise.all([
      db.documentContents.clear(),
      db.highlights.clear(),
      db.drawings.clear(),
      db.flashcardReviews.clear(),
      db.quizSessions.clear(),
    ]);
  });

  afterEach(async () => {
    if (db && db.isOpen()) {
      await Promise.all([
        db.documentContents.clear(),
        db.highlights.clear(),
        db.drawings.clear(),
        db.flashcardReviews.clear(),
        db.quizSessions.clear(),
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

    it('reads all 5 tables, packages mutations, and derives per-entity HLC timestamps', async () => {
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

      await db.flashcardReviews.put({
        key: 'fc-1',
        materialId: 'mat-1',
        repetitions: 3,
        easeFactor: 2.5,
        intervalDays: 6,
        dueAt: '2026-10-18T10:00:00.000Z',
        lapses: 0,
        lastReviewedAt: '2026-10-12T10:00:00.000Z',
        reviewCount: 3,
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
        'document',
        'highlight',
        'drawing',
        'flashcardReview',
        'quizSession',
      ]);

      const docMutation = chunk.mutations.find((m) => m.entityType === 'document')!;
      expect(docMutation.clientTimestamp).toBe('2026-10-10T10:00:00.000Z_0000_device-test-123');

      const hlMutation = chunk.mutations.find((m) => m.entityType === 'highlight')!;
      expect(hlMutation.clientTimestamp).toBe('2026-10-11T11:00:00.000Z_0000_device-test-123');

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
  });
});
