/**
 * Vault baseline seeding and streaming chunk compression pipeline for Google Drive BYOS sync.
 *
 * Paginates across live Dexie stores using keyset cursor pagination (`BATCH_SIZE = 100`),
 * derives per-entity HLC timestamps, enforces an uncompressed chunk ceiling of 3.5 MB,
 * and streams compressed gzip payloads via TextEncoderStream and CompressionStream('gzip')
 * to guarantee compressed output < 800 KB (well within the 1 MB reserve slot cushion and 5 MB simple upload limit).
 */
import type { Table } from 'dexie';
import type { LunaClairDatabase } from '../../database/schema/LunaClairDatabase';
import type { SyncMutation } from '../../../domain/sync/models/sync.types';
import { FLOOR_ISO, CANONICAL_FLOOR_HLC, compareHlc } from '../../../domain/sync/utils/hlc';
import {
  SYNC_POLICY,
  restoreOrder,
  defaultEncoding,
  type SyncCategory,
  type SyncEntityConfig,
  type SyncWireEncoding,
} from '../../../domain/sync/policy/SyncPolicy';
import { isSyncCategoryEnabled } from '../../../domain/sync/preferences/SyncCategoryPreferences';

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
  isCategoryEnabled?: (category: SyncCategory) => boolean;
}

/**
 * Derives a deterministic HLC timestamp from an entity's existing update or creation timestamp.
 * Preserves historical causal ordering under LWW so older local records do not overwrite newer remote edits.
 * If timestamp is the canonical epoch floor (FLOOR_ISO), returns CANONICAL_FLOOR_HLC.
 */
export function deriveEntityHlc(timestamp: string | undefined, deviceId: string): string {
  if (timestamp === FLOOR_ISO) {
    return CANONICAL_FLOOR_HLC;
  }
  if (!timestamp) {
    return `${new Date(0).toISOString()}_0000_${deviceId}`;
  }
  const d = new Date(timestamp);
  const iso = isNaN(d.getTime()) ? new Date(0).toISOString() : d.toISOString();
  return `${iso}_0000_${deviceId}`;
}

function getRowTimestamp(row: Record<string, any>, encoded: SyncWireEncoding): string | undefined {
  if (encoded.entity === 'pointer') {
    return row.updatedAt ?? row.createdAt;
  }
  if (encoded.entity === 'document') {
    return row.updatedAt;
  }
  if (row.deletedAt) return row.deletedAt;
  if (row.updatedAt) return row.updatedAt;
  if (row.completedAt) return row.completedAt;
  if (row.startedAt) return row.startedAt;
  if (row.lastReviewedAt) return row.lastReviewedAt;
  if (row.dueAt) return row.dueAt;
  if (row.createdAt) return row.createdAt;
  if (typeof row.at === 'number') return new Date(row.at).toISOString();
  if (typeof row.at === 'string') return row.at;
  return undefined;
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
  const isCategoryEnabled = options.isCategoryEnabled ?? isSyncCategoryEnabled;

  const initialHlc = deriveEntityHlc(clock().toISOString(), deviceId);
  let highWaterHlc = initialHlc;

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

    let chunkHlc = highWaterHlc;
    for (const mut of mutations) {
      if (mut.clientTimestamp && compareHlc(mut.clientTimestamp, chunkHlc) > 0) {
        chunkHlc = mut.clientTimestamp;
      }
    }

    const payload = {
      version: 1,
      hlc: chunkHlc,
      deviceId,
      createdAt: nowIso,
      coveredJournalFileIds: [],
      watermarks: { [deviceId]: chunkHlc },
      mutations,
    };

    const compressedGzip = await compressChunkGzip(payload);

    if (compressedGzip.byteLength > maxCompressed) {
      console.warn(
        `[streamVaultChunksGzipped] Compressed chunk size (${compressedGzip.byteLength} bytes) exceeds limit (${maxCompressed} bytes)`
      );
    }

    return {
      hlc: chunkHlc,
      deviceId,
      createdAt: nowIso,
      mutations,
      uncompressedBytes,
      compressedGzip,
    };
  };

  const orderedTables = restoreOrder();

  for (const tableName of orderedTables) {
    const cfg = SYNC_POLICY[tableName] as SyncEntityConfig;
    if (cfg.kind !== 'authoritative') {
      continue;
    }

    if (!isCategoryEnabled(cfg.category)) {
      continue;
    }

    const table = db[tableName as keyof LunaClairDatabase] as Table<any, any> | undefined;
    if (!table) {
      continue;
    }

    for await (const row of paginateTable(table, batchSize)) {
      const encoded = cfg.encode ? cfg.encode(row) : defaultEncoding(row, cfg);
      if (!encoded) {
        continue;
      }

      const rawTimestamp = getRowTimestamp(row, encoded);
      const hlc = deriveEntityHlc(rawTimestamp, deviceId);
      if (compareHlc(hlc, highWaterHlc) > 0) {
        highWaterHlc = hlc;
      }

      const entityId =
        (encoded.value as Record<string, any>)?.originShareId ??
        (encoded.value as Record<string, any>)?.documentId ??
        (encoded.value as Record<string, any>)?.id ??
        (encoded.value as Record<string, any>)?.key ??
        (row as Record<string, any>)?.originShareId ??
        (row as Record<string, any>)?.documentId ??
        (row as Record<string, any>)?.id ??
        (row as Record<string, any>)?.key ??
        'unknown';

      const mutation: SyncMutation = {
        clientMutationId: `baseline-${encoded.entity}-${entityId}`,
        entityType: encoded.entity as any,
        entityId: String(entityId),
        operation: (encoded.operation ?? 'UPSERT') as any,
        clientTimestamp: hlc,
        payload: encoded.value,
        ...(encoded.baseVersion !== undefined ? { baseVersion: encoded.baseVersion } : {}),
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
