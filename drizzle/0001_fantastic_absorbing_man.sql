CREATE TABLE `study_progress` (
	`user_id` text NOT NULL,
	`word_key` text NOT NULL,
	`level` integer DEFAULT 0 NOT NULL,
	`updated_at` integer NOT NULL,
	PRIMARY KEY(`user_id`, `word_key`)
);
