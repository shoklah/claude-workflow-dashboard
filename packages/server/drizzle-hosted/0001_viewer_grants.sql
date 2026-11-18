CREATE TABLE `viewer_grants` (
	`owner_id` integer NOT NULL,
	`viewer_login` text NOT NULL,
	`viewer_id` integer,
	PRIMARY KEY(`owner_id`, `viewer_login`),
	FOREIGN KEY (`owner_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`viewer_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
ALTER TABLE `sessions` ADD `viewing_id` integer;