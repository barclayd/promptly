-- Replace version INTEGER with major, minor, patch columns for full semantic versioning
CREATE TABLE `prompt_version_new` (
    `id` text PRIMARY KEY NOT NULL,
    `prompt_id` text NOT NULL,
    `major` integer,
    `minor` integer,
    `patch` integer,
    `system_message` text,
    `user_message` text,
    `config` text DEFAULT '{}' NOT NULL,
    `labels` text,
    `created_by` text NOT NULL,
    `created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
    `published_at` integer,
    FOREIGN KEY (`prompt_id`) REFERENCES `prompt`(`id`) ON UPDATE no action ON DELETE cascade,
    FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
-- Copy data, converting existing version to major.0.0 format
INSERT INTO `prompt_version_new` (`id`, `prompt_id`, `major`, `minor`, `patch`, `system_message`, `user_message`, `config`, `labels`, `created_by`, `created_at`, `published_at`)
SELECT `id`, `prompt_id`, `version`, 0, 0, `system_message`, `user_message`, `config`, `labels`, `created_by`, `created_at`, `published_at`
FROM `prompt_version`;
--> statement-breakpoint
-- Drop old table
DROP TABLE `prompt_version`;
--> statement-breakpoint
-- Rename new table
ALTER TABLE `prompt_version_new` RENAME TO `prompt_version`;
--> statement-breakpoint
-- Recreate indexes
CREATE INDEX `prompt_version_promptId_idx` ON `prompt_version` (`prompt_id`);
--> statement-breakpoint
-- Unique constraint on semver for published versions only (NULL semver allowed for drafts)
CREATE UNIQUE INDEX `prompt_version_prompt_semver_uidx` ON `prompt_version` (`prompt_id`, `major`, `minor`, `patch`) WHERE `major` IS NOT NULL;
