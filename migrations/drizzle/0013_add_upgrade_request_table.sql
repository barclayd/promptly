CREATE TABLE IF NOT EXISTS upgrade_request (
    id TEXT PRIMARY KEY NOT NULL,
    organization_id TEXT NOT NULL,
    requester_user_id TEXT NOT NULL,
    admin_user_id TEXT NOT NULL,
    context TEXT NOT NULL DEFAULT 'general',
    personal_note TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    checkout_url TEXT,
    sent_at INTEGER,
    fulfilled_at INTEGER,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_upgrade_request_org_status ON upgrade_request(organization_id, status);
