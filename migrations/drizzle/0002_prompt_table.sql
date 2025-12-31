CREATE TABLE `prompt_folder` (
                                 `id` text PRIMARY KEY NOT NULL,
                                 `name` text NOT NULL,
                                 `organization_id` text NOT NULL,
                                 `created_by` text NOT NULL,
                                 `created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
                                 `updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
                                 FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade,
                                 FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `prompt_folder_organizationId_idx` ON `prompt_folder` (`organization_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `prompt_folder_org_name_uidx` ON `prompt_folder` (`organization_id`, `name`);
--> statement-breakpoint
CREATE TABLE `prompt` (
                          `id` text PRIMARY KEY NOT NULL,
                          `name` text NOT NULL,
                          `description` text DEFAULT '' NOT NULL,
                          `folder_id` text,
                          `organization_id` text NOT NULL,
                          `created_by` text NOT NULL,
                          `created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
                          `updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
                          `deleted_at` integer,
                          FOREIGN KEY (`folder_id`) REFERENCES `prompt_folder`(`id`) ON UPDATE no action ON DELETE set null,
                          FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade,
                          FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `prompt_organizationId_idx` ON `prompt` (`organization_id`);
--> statement-breakpoint
CREATE INDEX `prompt_folderId_idx` ON `prompt` (`folder_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `prompt_org_name_uidx` ON `prompt` (`organization_id`, `name`) WHERE `deleted_at` IS NULL;
--> statement-breakpoint
CREATE TABLE `prompt_version` (
                                  `id` text PRIMARY KEY NOT NULL,
                                  `prompt_id` text NOT NULL,
                                  `version` integer NOT NULL,
                                  `system_message` text,
                                  `user_message` text,
                                  `config` text DEFAULT '{}' NOT NULL,
                                  `labels` text,
                                  `created_by` text NOT NULL,
                                  `created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
                                  FOREIGN KEY (`prompt_id`) REFERENCES `prompt`(`id`) ON UPDATE no action ON DELETE cascade,
                                  FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `prompt_version_promptId_idx` ON `prompt_version` (`prompt_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `prompt_version_prompt_version_uidx` ON `prompt_version` (`prompt_id`, `version`);