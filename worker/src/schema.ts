/**
 * Drizzle schema for Cloudflare D1 — the cloud sync layer for LunaClair.
 *
 * Define tables here (flashcard reviews, quiz data, …) and run
 * `npm run db:generate` to emit a migration into worker/migrations/,
 * then `npm run db:apply:local` / `npm run db:apply:remote`.
 *
 * Example:
 *   import { sqliteTable, integer, text } from 'drizzle-orm/sqlite-core';
 *   export const reviews = sqliteTable('reviews', {
 *     id: integer('id').primaryKey({ autoIncrement: true }),
 *     cardId: text('card_id').notNull(),
 *     ease: integer('ease').notNull(),
 *   });
 */
