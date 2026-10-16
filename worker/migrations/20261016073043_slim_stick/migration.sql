DROP INDEX IF EXISTS `idx_sync_changes_user_seq`;--> statement-breakpoint
DROP INDEX IF EXISTS `idx_sync_idempotency_processed_at`;--> statement-breakpoint
DROP TABLE `sync_changes`;--> statement-breakpoint
DROP TABLE `sync_idempotency`;--> statement-breakpoint
DROP TABLE `user_documents`;--> statement-breakpoint
DROP TABLE `user_entities`;