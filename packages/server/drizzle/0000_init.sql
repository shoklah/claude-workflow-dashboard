CREATE TABLE `imports` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`at` integer NOT NULL,
	`ok` integer NOT NULL,
	`error` text,
	`totals` text
);
--> statement-breakpoint
CREATE TABLE `state` (
	`name` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `unit_versions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`kind` text NOT NULL,
	`key` text NOT NULL,
	`received_at` integer NOT NULL,
	`raw` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `unit_versions_unit` ON `unit_versions` (`kind`,`key`);--> statement-breakpoint
CREATE TABLE `units` (
	`kind` text NOT NULL,
	`key` text NOT NULL,
	`first_seen_at` integer NOT NULL,
	`missing_since` integer,
	`readable` integer NOT NULL,
	`merged` text NOT NULL,
	PRIMARY KEY(`kind`, `key`)
);
--> statement-breakpoint
CREATE TABLE `warnings` (
	`kind` text NOT NULL,
	`key` text NOT NULL,
	`text` text NOT NULL,
	`first_seen_at` integer NOT NULL,
	PRIMARY KEY(`kind`, `key`, `text`)
);
