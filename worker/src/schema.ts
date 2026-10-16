/**
 * Drizzle schema for Cloudflare D1 — the content and sharing layer for LunaClair.
 *
 * StudyPackage sharing schema:
 * - `shares`: Published StudyPackage snapshot shares
 *
 * Timestamp convention: all persisted timestamps are ISO-8601 UTC text strings
 * (`YYYY-MM-DDTHH:mm:ss.sssZ`), matching the domain/Dexie representation.
 */
import {
  integer,
  sqliteTable,
  text,
} from 'drizzle-orm/sqlite-core';

/**
 * Published StudyPackage Shares.
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
