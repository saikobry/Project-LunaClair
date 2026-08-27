/**
 * Drizzle schema for Cloudflare D1 — the cloud sync/content layer for LunaClair.
 *
 * `documents` + `figures` hold the study material content (markdown + figure
 * images) that used to ship inside the PWA bundle. Content is ingested via the
 * Worker's PUT endpoints (seed script) and served publicly via GET.
 *
 * Timestamp convention: all persisted timestamps are ISO-8601 UTC text strings
 * (`YYYY-MM-DDTHH:mm:ss.sssZ`), matching the domain/Dexie representation, so
 * nothing converts formats across the API boundary. Set by the Worker (server
 * time) — clients never send timestamps.
 */
import {
  blob,
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
} from 'drizzle-orm/sqlite-core';

export const documents = sqliteTable('documents', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  content: text('content').notNull(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const figures = sqliteTable(
  'figures',
  {
    documentId: text('document_id')
      .notNull()
      .references(() => documents.id, { onDelete: 'cascade' }),
    filename: text('filename').notNull(),
    data: blob('data', { mode: 'buffer' }).notNull(),
    contentType: text('content_type').notNull(),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.documentId, table.filename] }),
  ],
);

/**
 * Library catalog — the canonical subjects/terms/materials delivered to the app
 * as one snapshot (`GET /api/catalog`). Read-only delivery: the app surfaces it
 * as Available Materials and imports individual materials into Dexie on user
 * action. No write path from the browser.
 *
 * `createdAt`/`updatedAt` are ISO-8601 text strings stamped server-side on
 * ingest, matching the domain types the app persists into Dexie.
 */
export const subjects = sqliteTable('subjects', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  description: text('description'),
  order: integer('order'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const terms = sqliteTable('terms', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const subjectTerms = sqliteTable(
  'subject_terms',
  {
    subjectId: text('subject_id')
      .notNull()
      .references(() => subjects.id, { onDelete: 'cascade' }),
    termId: text('term_id')
      .notNull()
      .references(() => terms.id, { onDelete: 'cascade' }),
    order: integer('order').notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.subjectId, table.termId] }),
  ],
);

export const materials = sqliteTable('materials', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  description: text('description'),
  documentId: text('document_id').notNull(),
  subjectId: text('subject_id').references(() => subjects.id, { onDelete: 'set null' }),
  termId: text('term_id').references(() => terms.id, { onDelete: 'set null' }),
  order: integer('order'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

/**
 * Quiz content — the starter question bank and quizzes. Same read-only snapshot
 * delivery as the catalog: `GET /api/quiz` returns assembled `{ questions, quizzes }`
 * where each quiz carries `questionIds` + `items` (the `quiz_questions` junction is
 * an internal detail). Timestamps are ISO-8601 text, server-stamped on ingest.
 */
export const questions = sqliteTable('questions', {
  id: text('id').primaryKey(),
  materialId: text('material_id')
    .notNull()
    .references(() => materials.id, { onDelete: 'cascade' }),
  type: text('type').notNull(),
  prompt: text('prompt').notNull(),
  payload: text('payload', { mode: 'json' }).notNull(),
  difficulty: text('difficulty').notNull(),
  points: integer('points').notNull(),
  explanation: text('explanation'),
  tags: text('tags', { mode: 'json' }),
  status: text('status').notNull(),
  version: integer('version').notNull(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const quizzes = sqliteTable('quizzes', {
  id: text('id').primaryKey(),
  materialId: text('material_id')
    .notNull()
    .references(() => materials.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  description: text('description'),
  status: text('status').notNull(),
  timeLimitSeconds: integer('time_limit_seconds'),
  passingPercentage: integer('passing_percentage'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const quizQuestions = sqliteTable(
  'quiz_questions',
  {
    quizId: text('quiz_id')
      .notNull()
      .references(() => quizzes.id, { onDelete: 'cascade' }),
    questionId: text('question_id')
      .notNull()
      .references(() => questions.id, { onDelete: 'cascade' }),
    questionVersion: integer('question_version').notNull(),
    order: integer('order').notNull(),
    points: integer('points'),
  },
  (table) => [
    primaryKey({ columns: [table.quizId, table.questionId] }),
  ],
);

/**
 * Cloud Sync Tables — Phase 10
 *
 * 4 tables supporting bidirectional local-first synchronization between Dexie and D1:
 * - `userDocuments`: user documents with LWW versioning
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

export const syncIdempotency = sqliteTable('sync_idempotency', {
  clientMutationId: text('client_mutation_id').primaryKey(),
  userId: text('user_id').notNull(),
  deviceId: text('device_id').notNull(),
  entityType: text('entity_type').notNull(),
  entityId: text('entity_id').notNull(),
  processedAt: text('processed_at').notNull(),
});

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

