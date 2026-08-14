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
  integer,
  primaryKey,
  sqliteTable,
  text,
} from 'drizzle-orm/sqlite-core';

export const documents = sqliteTable('documents', {
  sourceId: text('source_id').primaryKey(),
  title: text('title').notNull(),
  content: text('content').notNull(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const figures = sqliteTable(
  'figures',
  {
    sourceId: text('source_id')
      .notNull()
      .references(() => documents.sourceId, { onDelete: 'cascade' }),
    filename: text('filename').notNull(),
    data: blob('data', { mode: 'buffer' }).notNull(),
    contentType: text('content_type').notNull(),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.sourceId, table.filename] }),
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
  sourceType: text('source_type').notNull(),
  sourceId: text('source_id').notNull(),
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
