-- Make user_id nullable in apikey table.
-- Better Auth @better-auth/api-key v1.5.4 no longer writes user_id,
-- using reference_id instead. The NOT NULL constraint causes INSERT failures.
-- SQLite doesn't support ALTER COLUMN, so we recreate the table.

CREATE TABLE apikey_new (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT,
    start TEXT,
    prefix TEXT,
    key TEXT NOT NULL,
    user_id TEXT,
    refill_interval INTEGER,
    refill_amount INTEGER,
    last_refill_at INTEGER,
    enabled INTEGER DEFAULT 1,
    rate_limit_enabled INTEGER DEFAULT 1,
    rate_limit_time_window INTEGER,
    rate_limit_max INTEGER,
    request_count INTEGER DEFAULT 0,
    remaining INTEGER,
    last_request INTEGER,
    expires_at INTEGER,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    permissions TEXT,
    metadata TEXT,
    reference_id TEXT NOT NULL DEFAULT '',
    config_id TEXT NOT NULL DEFAULT 'default',
    FOREIGN KEY (user_id) REFERENCES user(id) ON DELETE CASCADE
);

-- Copy all existing data
INSERT INTO apikey_new SELECT * FROM apikey;

-- Drop old table and rename
DROP TABLE apikey;
ALTER TABLE apikey_new RENAME TO apikey;

-- Recreate indexes
CREATE INDEX IF NOT EXISTS idx_apikey_user_id ON apikey(user_id);
CREATE INDEX IF NOT EXISTS idx_apikey_key ON apikey(key);
CREATE INDEX IF NOT EXISTS idx_apikey_reference_id ON apikey(reference_id);
CREATE INDEX IF NOT EXISTS idx_apikey_config_id ON apikey(config_id);
