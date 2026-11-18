CREATE TABLE `labeller_settings` (
	`account_id` integer PRIMARY KEY NOT NULL,
	`sealed_key` text,
	`model` text DEFAULT 'claude-haiku-5-5' NOT NULL,
	`daily_max` integer DEFAULT 500 NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE cascade
);
