-- Add updated_at and updated_by columns to track when/who last modified versions
ALTER TABLE `prompt_version` ADD COLUMN `updated_at` integer;
--> statement-breakpoint
ALTER TABLE `prompt_version` ADD COLUMN `updated_by` text REFERENCES `user`(`id`) ON DELETE SET NULL;
--> statement-breakpoint
-- Initialize existing rows: updated_at = created_at, updated_by = created_by
UPDATE `prompt_version` SET `updated_at` = `created_at`, `updated_by` = `created_by`;
