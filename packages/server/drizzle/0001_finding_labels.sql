CREATE TABLE `finding_labels` (
	`run_key` text NOT NULL,
	`finding_id` text NOT NULL,
	`input_hash` text NOT NULL,
	`list_version` integer NOT NULL,
	`model` text NOT NULL,
	`category` text NOT NULL,
	`relevance` text NOT NULL,
	`reason` text NOT NULL,
	`labelled_at` integer NOT NULL,
	PRIMARY KEY(`run_key`, `finding_id`, `input_hash`, `list_version`, `model`)
);
--> statement-breakpoint
CREATE TABLE `label_batches` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`at` integer NOT NULL,
	`input_tokens` integer NOT NULL,
	`output_tokens` integer NOT NULL
);
