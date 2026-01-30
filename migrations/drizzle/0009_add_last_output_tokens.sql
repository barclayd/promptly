-- Add column to store output token count from last test run
ALTER TABLE `prompt_version` ADD COLUMN `last_output_tokens` INTEGER;
