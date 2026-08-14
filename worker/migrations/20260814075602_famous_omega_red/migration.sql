CREATE TABLE `questions` (
	`id` text PRIMARY KEY,
	`material_id` text NOT NULL,
	`type` text NOT NULL,
	`prompt` text NOT NULL,
	`payload` text NOT NULL,
	`difficulty` text NOT NULL,
	`points` integer NOT NULL,
	`explanation` text,
	`tags` text,
	`status` text NOT NULL,
	`version` integer NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	CONSTRAINT `fk_questions_material_id_materials_id_fk` FOREIGN KEY (`material_id`) REFERENCES `materials`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `quiz_questions` (
	`quiz_id` text NOT NULL,
	`question_id` text NOT NULL,
	`question_version` integer NOT NULL,
	`order` integer NOT NULL,
	`points` integer,
	CONSTRAINT `quiz_questions_pk` PRIMARY KEY(`quiz_id`, `question_id`),
	CONSTRAINT `fk_quiz_questions_quiz_id_quizzes_id_fk` FOREIGN KEY (`quiz_id`) REFERENCES `quizzes`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_quiz_questions_question_id_questions_id_fk` FOREIGN KEY (`question_id`) REFERENCES `questions`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `quizzes` (
	`id` text PRIMARY KEY,
	`material_id` text NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`status` text NOT NULL,
	`time_limit_seconds` integer,
	`passing_percentage` integer,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	CONSTRAINT `fk_quizzes_material_id_materials_id_fk` FOREIGN KEY (`material_id`) REFERENCES `materials`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
ALTER TABLE `documents` ADD `created_at` integer NOT NULL DEFAULT 0;--> statement-breakpoint
ALTER TABLE `figures` ADD `created_at` integer NOT NULL DEFAULT 0;--> statement-breakpoint
UPDATE `documents` SET `created_at` = `updated_at`;--> statement-breakpoint
UPDATE `figures` SET `created_at` = `updated_at`;