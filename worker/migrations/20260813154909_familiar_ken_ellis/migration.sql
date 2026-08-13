CREATE TABLE `documents` (
	`source_id` text PRIMARY KEY,
	`title` text NOT NULL,
	`content` text NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `figures` (
	`source_id` text NOT NULL,
	`filename` text NOT NULL,
	`data` blob NOT NULL,
	`content_type` text NOT NULL,
	`updated_at` integer NOT NULL,
	CONSTRAINT `figures_pk` PRIMARY KEY(`source_id`, `filename`),
	CONSTRAINT `fk_figures_source_id_documents_source_id_fk` FOREIGN KEY (`source_id`) REFERENCES `documents`(`source_id`) ON DELETE CASCADE
);
