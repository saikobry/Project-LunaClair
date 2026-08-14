CREATE TABLE `materials` (
	`id` text PRIMARY KEY,
	`title` text NOT NULL,
	`description` text,
	`source_type` text NOT NULL,
	`source_id` text NOT NULL,
	`subject_id` text,
	`term_id` text,
	`order` integer,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	CONSTRAINT `fk_materials_subject_id_subjects_id_fk` FOREIGN KEY (`subject_id`) REFERENCES `subjects`(`id`) ON DELETE SET NULL,
	CONSTRAINT `fk_materials_term_id_terms_id_fk` FOREIGN KEY (`term_id`) REFERENCES `terms`(`id`) ON DELETE SET NULL
);
--> statement-breakpoint
CREATE TABLE `subject_terms` (
	`subject_id` text NOT NULL,
	`term_id` text NOT NULL,
	`order` integer NOT NULL,
	CONSTRAINT `subject_terms_pk` PRIMARY KEY(`subject_id`, `term_id`),
	CONSTRAINT `fk_subject_terms_subject_id_subjects_id_fk` FOREIGN KEY (`subject_id`) REFERENCES `subjects`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_subject_terms_term_id_terms_id_fk` FOREIGN KEY (`term_id`) REFERENCES `terms`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `subjects` (
	`id` text PRIMARY KEY,
	`title` text NOT NULL,
	`description` text,
	`order` integer,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `terms` (
	`id` text PRIMARY KEY,
	`title` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
