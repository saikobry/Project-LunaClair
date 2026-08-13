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
