-- Add columns to store input token counts from last test run (split by prompt type)
ALTER TABLE `prompt_version` ADD COLUMN `last_system_input_tokens` INTEGER;
ALTER TABLE `prompt_version` ADD COLUMN `last_user_input_tokens` INTEGER;
