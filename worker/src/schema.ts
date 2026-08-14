/**
 * Drizzle schema for Cloudflare D1 — the cloud sync/content layer for LunaClair.
 *
 * `documents` + `figures` hold the study material content (markdown + figure
 * images) that used to ship inside the PWA bundle. Content is ingested via the
 * Worker's PUT endpoints (seed script) and served publicly via GET.
 *
 * Timestamps are always set by the Worker (server time) — clients never send
 * `updatedAt`.
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
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
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
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.sourceId, table.filename] }),
  ],
);

/**
 * Library catalog — the starter subjects/terms/materials delivered to the app
 * as one snapshot (`GET /api/catalog`). Read-only delivery: the app hydrates
 * Dexie from this and owns the local working copy. No write path from the browser.
 *
 * `createdAt`/`updatedAt` are ISO-8601 text strings stamped server-side on
 * ingest, matching the domain types the app hydrates into Dexie.
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
