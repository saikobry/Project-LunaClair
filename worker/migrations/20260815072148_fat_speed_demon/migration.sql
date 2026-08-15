ALTER TABLE `documents` RENAME COLUMN `source_id` TO `id`;--> statement-breakpoint
ALTER TABLE `figures` RENAME COLUMN `source_id` TO `document_id`;--> statement-breakpoint
ALTER TABLE `materials` RENAME COLUMN `source_id` TO `document_id`;