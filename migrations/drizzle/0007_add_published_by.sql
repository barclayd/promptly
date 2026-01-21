ALTER TABLE `prompt_version` ADD COLUMN `published_by` text REFERENCES `user`(`id`) ON DELETE SET NULL;
