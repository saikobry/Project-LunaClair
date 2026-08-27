CREATE TABLE `shares` (
	`id` text PRIMARY KEY,
	`format` text DEFAULT 'lcpack' NOT NULL,
	`schema_version` integer DEFAULT 1 NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`author` text,
	`access_type` text DEFAULT 'public' NOT NULL,
	`passcode_hash` text,
	`package_payload` text NOT NULL,
	`user_id` text,
	`view_count` integer DEFAULT 0 NOT NULL,
	`download_count` integer DEFAULT 0 NOT NULL,
	`expires_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
