/**
 * Drizzle schema for Cloudflare D1 — the cloud sync/content layer for LunaClair.
 *
 * Cloud Sync + StudyPackage sharing schema:
 * - `userDocuments`, `userEntities`, `syncChanges`, `syncIdempotency`: Cloud Sync (Phase 10)
 * - `shares`: Published StudyPackage snapshot shares (Phase 11C / Phase 12)
 *
 * Timestamp convention: all persisted timestamps are ISO-8601 UTC text strings
 * (`YYYY-MM-DDTHH:mm:ss.sssZ`), matching the domain/Dexie representation.
 */
import {
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
} from 'drizzle-orm/sqlite-core';

/**
 * Cloud Sync Tables — Phase 10
 *
 * 4 tables supporting bidirectional local-first synchronization between Dexie and D1:
 * - `userDocuments`: user documents with CAS optimistic versioning
 * - `userEntities`: key-value store for domain entities (highlights, bookmarks, progress, etc.)
 * - `syncChanges`: append-only change log for cursor/sequence-based delta pulls
 * - `syncIdempotency`: mutation idempotency ledger
 */
export const userDocuments = sqliteTable(
  'user_documents',
  {
    userId: text('user_id').notNull(),
    documentId: text('document_id').notNull(),
    version: integer('version').notNull().default(1),
    title: text('title').notNull(),
    content: text('content').notNull(),
    updatedAt: text('updated_at').notNull(),
    deletedAt: text('deleted_at'),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.documentId] }),
  ],
);

export const userEntities = sqliteTable(
  'user_entities',
  {
    userId: text('user_id').notNull(),
    entityType: text('entity_type').notNull(),
    entityId: text('entity_id').notNull(),
    payload: text('payload').notNull(),
    updatedAt: text('updated_at').notNull(),
    deletedAt: text('deleted_at'),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.entityType, table.entityId] }),
  ],
);

export const syncChanges = sqliteTable(
  'sync_changes',
  {
    sequence: integer('sequence').primaryKey({ autoIncrement: true }),
    userId: text('user_id').notNull(),
    entityType: text('entity_type').notNull(),
    entityId: text('entity_id').notNull(),
    operation: text('operation').notNull(),
    version: integer('version'),
    changedAt: text('changed_at').notNull(),
  },
  (table) => [
    index('idx_sync_changes_user_seq').on(table.userId, table.sequence),
  ],
);

/**
 * Client mutation deduplication ledger.
 *
 * `processed_at` is indexed for **retention** only — nothing reads the ledger by time. The prune in
 * `core/retention.ts` deletes entries older than the replay-retention window in bounded batches, and
 * without the index that delete scans the one table here whose size grows with traffic.
 */
export const syncIdempotency = sqliteTable(
  'sync_idempotency',
  {
    clientMutationId: text('client_mutation_id').primaryKey(),
    userId: text('user_id').notNull(),
    deviceId: text('device_id').notNull(),
    entityType: text('entity_type').notNull(),
    entityId: text('entity_id').notNull(),
    processedAt: text('processed_at').notNull(),
  },
  (table) => [index('idx_sync_idempotency_processed_at').on(table.processedAt)],
);

/**
 * Published StudyPackage Shares (Phase 11C).
 *
 * Stores immutable published package snapshots for remote sharing and cloning.
 * Format is strictly 'lcpack' with schemaVersion 1.
 * D1 ID: `share_<id>`
 * Package payload: Self-contained serialized StudyPackage JSON.
 */
export const shares = sqliteTable('shares', {
  id: text('id').primaryKey(),
  format: text('format').notNull().default('lcpack'),
  schemaVersion: integer('schema_version').notNull().default(1),
  title: text('title').notNull(),
  description: text('description'),
  author: text('author'),
  accessType: text('access_type').notNull().default('public'),
  passcodeHash: text('passcode_hash'),
  packagePayload: text('package_payload').notNull(),
  userId: text('user_id'),
  viewCount: integer('view_count').notNull().default(0),
  downloadCount: integer('download_count').notNull().default(0),
  expiresAt: text('expires_at'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});
