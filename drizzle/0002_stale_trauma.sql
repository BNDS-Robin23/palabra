CREATE TABLE `analytics_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`feature` text NOT NULL,
	`event_name` text NOT NULL,
	`metadata_json` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_analytics_events_created_at` ON `analytics_events` (`created_at`);--> statement-breakpoint
CREATE INDEX `idx_analytics_events_user_created` ON `analytics_events` (`user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_analytics_events_feature_created` ON `analytics_events` (`feature`,`created_at`);--> statement-breakpoint
CREATE TABLE `analytics_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`feature` text NOT NULL,
	`started_at` integer NOT NULL,
	`last_seen_at` integer NOT NULL,
	`active_seconds` integer DEFAULT 0 NOT NULL,
	`ended_at` integer
);
--> statement-breakpoint
CREATE INDEX `idx_analytics_sessions_user_started` ON `analytics_sessions` (`user_id`,`started_at`);--> statement-breakpoint
CREATE INDEX `idx_analytics_sessions_feature_started` ON `analytics_sessions` (`feature`,`started_at`);--> statement-breakpoint
CREATE TABLE `app_admins` (
	`user_id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
INSERT OR IGNORE INTO `app_admins` (`user_id`, `created_at`)
SELECT `id`, unixepoch() FROM `users` WHERE `username_key` = 'robin';
