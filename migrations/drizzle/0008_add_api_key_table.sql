-- Create apikey table for Better Auth API Key plugin
CREATE TABLE IF NOT EXISTS apikey (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT,
    start TEXT,
    prefix TEXT,
    key TEXT NOT NULL,
    user_id TEXT NOT NULL,
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
    FOREIGN KEY (user_id) REFERENCES user(id) ON DELETE CASCADE
);

-- Create indexes for efficient lookups
CREATE INDEX IF NOT EXISTS idx_apikey_user_id ON apikey(user_id);
CREATE INDEX IF NOT EXISTS idx_apikey_key ON apikey(key);
