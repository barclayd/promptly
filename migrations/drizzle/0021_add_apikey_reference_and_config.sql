-- Add reference_id and config_id columns required by @better-auth/api-key@1.5.4
-- reference_id: the owner entity (userId or organizationId)
-- config_id: supports multiple API key configurations

ALTER TABLE apikey ADD COLUMN reference_id TEXT NOT NULL DEFAULT '';
ALTER TABLE apikey ADD COLUMN config_id TEXT NOT NULL DEFAULT 'default';

-- Backfill reference_id from user_id for existing keys
UPDATE apikey SET reference_id = user_id WHERE reference_id = '';

-- Create indexes for the new columns
CREATE INDEX IF NOT EXISTS idx_apikey_reference_id ON apikey(reference_id);
CREATE INDEX IF NOT EXISTS idx_apikey_config_id ON apikey(config_id);
