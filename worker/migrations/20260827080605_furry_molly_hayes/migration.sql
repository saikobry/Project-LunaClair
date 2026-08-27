CREATE TABLE `sync_changes` (
	`sequence` integer PRIMARY KEY AUTOINCREMENT,
	`user_id` text NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text NOT NULL,
	`operation` text NOT NULL,
	`version` integer,
	`changed_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `sync_idempotency` (
	`client_mutation_id` text PRIMARY KEY,
	`user_id` text NOT NULL,
	`device_id` text NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text NOT NULL,
	`processed_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `user_documents` (
	`user_id` text NOT NULL,
	`document_id` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`title` text NOT NULL,
	`content` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text,
	CONSTRAINT `user_documents_pk` PRIMARY KEY(`user_id`, `document_id`)
);
--> statement-breakpoint
CREATE TABLE `user_entities` (
	`user_id` text NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text NOT NULL,
	`payload` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text,
	CONSTRAINT `user_entities_pk` PRIMARY KEY(`user_id`, `entity_type`, `entity_id`)
);
--> statement-breakpoint
CREATE INDEX `idx_sync_changes_user_seq` ON `sync_changes` (`user_id`,`sequence`);