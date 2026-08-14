-- Convert `documents`/`figures` timestamps from epoch ms (integer) to ISO-8601 text,
-- matching the rest of the schema (catalog + quiz tables).
--
-- D1 runs migrations inside a transaction, where `PRAGMA foreign_keys=OFF` is a no-op,
-- so a naive rebuild (create new → copy → DROP parent) would cascade-delete `figures`
-- via the ON DELETE CASCADE FK when `documents` is dropped. Order matters:
--   1. stage figures data into a no-FK temp table (with conversion)
--   2. drop the child `figures` FIRST (nothing references it → safe)
--   3. rebuild `documents` (no live child FK remains → no cascade)
--   4. rebuild `figures` from the staged copy with the FK re-established
--> statement-breakpoint
CREATE TABLE `_figures_stage` (
	`source_id` text NOT NULL,
	`filename` text NOT NULL,
	`data` blob NOT NULL,
	`content_type` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
INSERT INTO `_figures_stage`(`source_id`, `filename`, `data`, `content_type`, `created_at`, `updated_at`)
SELECT `source_id`, `filename`, `data`, `content_type`,
	strftime('%Y-%m-%dT%H:%M:%fZ', `created_at`/1000.0, 'unixepoch'),
	strftime('%Y-%m-%dT%H:%M:%fZ', `updated_at`/1000.0, 'unixepoch')
FROM `figures`;
--> statement-breakpoint
DROP TABLE `figures`;
--> statement-breakpoint
CREATE TABLE `__new_documents` (
	`source_id` text PRIMARY KEY,
	`title` text NOT NULL,
	`content` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_documents`(`source_id`, `title`, `content`, `created_at`, `updated_at`)
SELECT `source_id`, `title`, `content`,
	strftime('%Y-%m-%dT%H:%M:%fZ', `created_at`/1000.0, 'unixepoch'),
	strftime('%Y-%m-%dT%H:%M:%fZ', `updated_at`/1000.0, 'unixepoch')
FROM `documents`;
--> statement-breakpoint
DROP TABLE `documents`;
--> statement-breakpoint
ALTER TABLE `__new_documents` RENAME TO `documents`;
--> statement-breakpoint
CREATE TABLE `__new_figures` (
	`source_id` text NOT NULL,
	`filename` text NOT NULL,
	`data` blob NOT NULL,
	`content_type` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	CONSTRAINT `figures_pk` PRIMARY KEY(`source_id`, `filename`),
	CONSTRAINT `fk_figures_source_id_documents_source_id_fk` FOREIGN KEY (`source_id`) REFERENCES `documents`(`source_id`) ON DELETE CASCADE
);
--> statement-breakpoint
INSERT INTO `__new_figures`(`source_id`, `filename`, `data`, `content_type`, `created_at`, `updated_at`)
SELECT `source_id`, `filename`, `data`, `content_type`, `created_at`, `updated_at`
FROM `_figures_stage`;
--> statement-breakpoint
DROP TABLE `_figures_stage`;
--> statement-breakpoint
ALTER TABLE `__new_figures` RENAME TO `figures`;
