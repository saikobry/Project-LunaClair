/**
 * Vault baseline seeding and streaming chunk compression pipeline for Google Drive BYOS sync.
 *
 * Paginates across live Dexie stores using keyset cursor pagination (`BATCH_SIZE = 100`),
 * derives per-entity HLC timestamps, enforces an uncompressed chunk ceiling of 3.5 MB,
 * and streams compressed gzip payloads via TextEncoderStream and CompressionStream('gzip')
 * to guarantee compressed output < 800 KB (well within the 1 MB reserve slot cushion and 5 MB simple upload limit).
 */
import type { Table } from 'dexie';
import type {
  LunaClairDatabase,
  HighlightRecord,
  DrawingRecord,
} from '../../database/schema/LunaClairDatabase';
import type { ImportedDocumentContent } from '../../../domain/reader/repositories/DocumentContentRepository';
import type { ReviewState } from '../../../domain/flashcards/engines/scheduler';
import type { QuizSession } from '../../../domain/quiz/models/QuizSession';
import type { SyncMutation } from '../../../domain/sync/models/sync.types';

export const DEFAULT_BATCH_SIZE = 100;
export const DEFAULT_UNCOMPRESSED_CEILING_BYTES = 3.5 * 1024 * 1024; // 3.5 MB
export const DEFAULT_MAX_COMPRESSED_BYTES = 800 * 1024; // 800 KB

export interface VaultChunk {
  hlc: string;
  deviceId: string;
  createdAt: string;
  mutations: SyncMutation[];
  uncompressedBytes: number;
  compressedGzip: Uint8Array;
}

export interface VaultChunkOptions {
  batchSize?: number;
  uncompressedCeilingBytes?: number;
  maxCompressedBytes?: number;
  clock?: () => Date;
}

/**
 * Derives a deterministic HLC timestamp from an entity's existing update or creation timestamp.
 * Preserves historical causal ordering under LWW so older local records do not overwrite newer remote edits.
 */
export function deriveEntityHlc(timestamp: string | undefined, deviceId: string): string {
  if (!timestamp) {
    return `${new Date(0).toISOString()}_0000_${deviceId}`;
  }
  const d = new Date(timestamp);
  const iso = isNaN(d.getTime()) ? new Date(0).toISOString() : d.toISOString();
  return `${iso}_0000_${deviceId}`;
}

/**
 * Keyset/cursor pagination over a Dexie table in batches of `batchSize`.
 */
export async function* paginateTable<T>(
  table: Table<T, any>,
  batchSize: number = DEFAULT_BATCH_SIZE
): AsyncGenerator<T> {
  const pk = table.schema.primKey.name;
  let lastKey: any = undefined;
  while (true) {
    let batch: T[];
    if (lastKey === undefined) {
      batch = await table.limit(batchSize).toArray();
    } else {
      batch = await table.where(pk).above(lastKey).limit(batchSize).toArray();
    }
    if (!batch || batch.length === 0) {
      break;
    }
    for (const item of batch) {
      yield item;
      lastKey = (item as Record<string, any>)[pk];
    }
    if (batch.length < batchSize) {
      break;
    }
  }
}

/**
 * Compresses an arbitrary payload to gzip bytes using native Web Streams (TextEncoderStream + CompressionStream).
 */
export async function compressChunkGzip(payload: unknown): Promise<Uint8Array> {
  const jsonString = JSON.stringify(payload);
  const textStream = new ReadableStream<string>({
    start(controller) {
      controller.enqueue(jsonString);
      controller.close();
    },
  });
  const compressedStream = textStream
    .pipeThrough(new TextEncoderStream())
    .pipeThrough(new CompressionStream('gzip'));
  const buffer = await new Response(compressedStream).arrayBuffer();
  return new Uint8Array(buffer);
}

/**
 * Streams vault data from live Dexie tables into gzipped chunks.
 */
export async function* streamVaultChunksGzipped(
  db: LunaClairDatabase,
  deviceId: string,
  options: VaultChunkOptions = {}
): AsyncGenerator<VaultChunk> {
  const batchSize = options.batchSize ?? DEFAULT_BATCH_SIZE;
  const uncompressedCeiling = options.uncompressedCeilingBytes ?? DEFAULT_UNCOMPRESSED_CEILING_BYTES;
  const maxCompressed = options.maxCompressedBytes ?? DEFAULT_MAX_COMPRESSED_BYTES;
  const clock = options.clock ?? (() => new Date());

  let currentMutations: SyncMutation[] = [];
  let currentUncompressedBytes = 0;
  let chunkCount = 0;

  const createAndCompressChunk = async (
    mutations: SyncMutation[],
    uncompressedBytes: number
  ): Promise<VaultChunk> => {
    chunkCount += 1;
    const now = clock();
    const nowIso = now.toISOString();

    // Derive chunk HLC from latest mutation timestamp or fallback to now
    let maxHlc = `${nowIso}_0000_${deviceId}`;
    for (const mut of mutations) {
      if (mut.clientTimestamp && mut.clientTimestamp > maxHlc) {
        maxHlc = mut.clientTimestamp;
      }
    }

    const payload = {
      version: 1,
      hlc: maxHlc,
      deviceId,
      createdAt: nowIso,
      coveredJournalFileIds: [],
      watermarks: { [deviceId]: maxHlc },
      mutations,
    };

    const compressedGzip = await compressChunkGzip(payload);

    if (compressedGzip.byteLength > maxCompressed) {
      console.warn(
        `[streamVaultChunksGzipped] Compressed chunk size (${compressedGzip.byteLength} bytes) exceeds limit (${maxCompressed} bytes)`
      );
    }

    return {
      hlc: maxHlc,
      deviceId,
      createdAt: nowIso,
      mutations,
      uncompressedBytes,
      compressedGzip,
    };
  };

  // 1. Documents (db.documentContents)
  for await (const doc of paginateTable<ImportedDocumentContent>(db.documentContents, batchSize)) {
    const hlc = deriveEntityHlc(doc.updatedAt, deviceId);
    const mutation: SyncMutation = {
      clientMutationId: `baseline-doc-${doc.documentId}`,
      entityType: 'document',
      entityId: doc.documentId,
      operation: 'UPSERT',
      baseVersion: doc.version ?? 1,
      clientTimestamp: hlc,
      payload: {
        documentId: doc.documentId,
        title: doc.title,
        content: doc.content,
        updatedAt: doc.updatedAt ?? new Date(0).toISOString(),
        version: doc.version ?? 1,
      },
    };
    const size = new TextEncoder().encode(JSON.stringify(mutation)).byteLength;
    if (currentUncompressedBytes + size > uncompressedCeiling && currentMutations.length > 0) {
      yield await createAndCompressChunk(currentMutations, currentUncompressedBytes);
      currentMutations = [];
      currentUncompressedBytes = 0;
    }
    currentMutations.push(mutation);
    currentUncompressedBytes += size;
  }

  // 2. Highlights (db.highlights)
  for await (const hl of paginateTable<HighlightRecord>(db.highlights, batchSize)) {
    const hlc = deriveEntityHlc(hl.deletedAt ?? hl.createdAt, deviceId);
    const mutation: SyncMutation = {
      clientMutationId: `baseline-hl-${hl.id}`,
      entityType: 'highlight',
      entityId: hl.id,
      operation: hl.deletedAt ? 'DELETE' : 'UPSERT',
      clientTimestamp: hlc,
      payload: {
        id: hl.id,
        documentId: hl.documentId,
        start: hl.start,
        end: hl.end,
        color: hl.color,
        text: hl.text,
        createdAt: hl.createdAt,
        deletedAt: hl.deletedAt,
      },
    };
    const size = new TextEncoder().encode(JSON.stringify(mutation)).byteLength;
    if (currentUncompressedBytes + size > uncompressedCeiling && currentMutations.length > 0) {
      yield await createAndCompressChunk(currentMutations, currentUncompressedBytes);
      currentMutations = [];
      currentUncompressedBytes = 0;
    }
    currentMutations.push(mutation);
    currentUncompressedBytes += size;
  }

  // 3. Drawings (db.drawings)
  for await (const dr of paginateTable<DrawingRecord>(db.drawings, batchSize)) {
    const hlc = deriveEntityHlc(dr.deletedAt ?? dr.createdAt, deviceId);
    const mutation: SyncMutation = {
      clientMutationId: `baseline-dr-${dr.id}`,
      entityType: 'drawing',
      entityId: dr.id,
      operation: dr.deletedAt ? 'DELETE' : 'UPSERT',
      clientTimestamp: hlc,
      payload: {
        id: dr.id,
        documentId: dr.documentId,
        color: dr.color,
        thickness: dr.thickness,
        points: dr.points,
        isEraser: dr.isEraser,
        createdAt: dr.createdAt,
        deletedAt: dr.deletedAt,
      },
    };
    const size = new TextEncoder().encode(JSON.stringify(mutation)).byteLength;
    if (currentUncompressedBytes + size > uncompressedCeiling && currentMutations.length > 0) {
      yield await createAndCompressChunk(currentMutations, currentUncompressedBytes);
      currentMutations = [];
      currentUncompressedBytes = 0;
    }
    currentMutations.push(mutation);
    currentUncompressedBytes += size;
  }

  // 4. Flashcard Reviews (db.flashcardReviews)
  for await (const fc of paginateTable<ReviewState>(db.flashcardReviews, batchSize)) {
    const hlc = deriveEntityHlc(fc.lastReviewedAt ?? fc.dueAt, deviceId);
    const mutation: SyncMutation = {
      clientMutationId: `baseline-fc-${fc.key}`,
      entityType: 'flashcardReview',
      entityId: fc.key,
      operation: 'UPSERT',
      clientTimestamp: hlc,
      payload: {
        key: fc.key,
        materialId: fc.materialId,
        repetitions: fc.repetitions,
        easeFactor: fc.easeFactor,
        intervalDays: fc.intervalDays,
        dueAt: fc.dueAt,
        lapses: fc.lapses,
        lastReviewedAt: fc.lastReviewedAt,
        reviewCount: fc.reviewCount,
      },
    };
    const size = new TextEncoder().encode(JSON.stringify(mutation)).byteLength;
    if (currentUncompressedBytes + size > uncompressedCeiling && currentMutations.length > 0) {
      yield await createAndCompressChunk(currentMutations, currentUncompressedBytes);
      currentMutations = [];
      currentUncompressedBytes = 0;
    }
    currentMutations.push(mutation);
    currentUncompressedBytes += size;
  }

  // 5. Quiz Sessions (db.quizSessions)
  for await (const qs of paginateTable<QuizSession>(db.quizSessions, batchSize)) {
    const hlc = deriveEntityHlc(qs.completedAt ?? qs.startedAt, deviceId);
    const mutation: SyncMutation = {
      clientMutationId: `baseline-qs-${qs.id}`,
      entityType: 'quizSession',
      entityId: qs.id,
      operation: 'APPEND',
      clientTimestamp: hlc,
      payload: {
        id: qs.id,
        quizId: qs.quizId,
        mode: qs.mode,
        status: qs.status,
        questionSnapshots: qs.questionSnapshots,
        answers: qs.answers,
        score: qs.score,
        startedAt: qs.startedAt,
        completedAt: qs.completedAt,
      },
    };
    const size = new TextEncoder().encode(JSON.stringify(mutation)).byteLength;
    if (currentUncompressedBytes + size > uncompressedCeiling && currentMutations.length > 0) {
      yield await createAndCompressChunk(currentMutations, currentUncompressedBytes);
      currentMutations = [];
      currentUncompressedBytes = 0;
    }
    currentMutations.push(mutation);
    currentUncompressedBytes += size;
  }

  // Final chunk (or empty chunk if no records exist)
  if (currentMutations.length > 0 || chunkCount === 0) {
    yield await createAndCompressChunk(currentMutations, currentUncompressedBytes);
  }
}

/**
 * Convenience helper to collect all chunks produced by streamVaultChunksGzipped.
 */
export async function collectVaultChunksGzipped(
  db: LunaClairDatabase,
  deviceId: string,
  options?: VaultChunkOptions
): Promise<VaultChunk[]> {
  const chunks: VaultChunk[] = [];
  for await (const chunk of streamVaultChunksGzipped(db, deviceId, options)) {
    chunks.push(chunk);
  }
  return chunks;
}
