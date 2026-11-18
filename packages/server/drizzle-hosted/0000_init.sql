CREATE TABLE `accounts` (
	`id` integer PRIMARY KEY NOT NULL,
	`login` text NOT NULL,
	`created_at` integer NOT NULL,
	`last_collect_at` integer
);
--> statement-breakpoint
CREATE TABLE `collector_tokens` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`hash` text NOT NULL,
	`account_id` integer NOT NULL,
	`created_at` integer NOT NULL,
	`last_used_at` integer,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `collector_tokens_hash_unique` ON `collector_tokens` (`hash`);--> statement-breakpoint
CREATE TABLE `invites` (
	`login` text PRIMARY KEY NOT NULL,
	`added_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`id_hash` text PRIMARY KEY NOT NULL,
	`account_id` integer NOT NULL,
	`expires_at` integer NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE cascade
);
