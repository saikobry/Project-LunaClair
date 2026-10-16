DROP INDEX IF EXISTS `idx_sync_changes_user_seq`;--> statement-breakpoint
DROP INDEX IF EXISTS `idx_sync_idempotency_processed_at`;--> statement-breakpoint
DROP TABLE IF EXISTS `sync_changes`;--> statement-breakpoint
DROP TABLE IF EXISTS `sync_idempotency`;--> statement-breakpoint
DROP TABLE IF EXISTS `user_documents`;--> statement-breakpoint
DROP TABLE IF EXISTS `user_entities`;