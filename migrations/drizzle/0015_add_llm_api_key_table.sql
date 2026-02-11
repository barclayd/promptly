CREATE TABLE IF NOT EXISTS llm_api_key (
    id TEXT PRIMARY KEY NOT NULL,
    organization_id TEXT NOT NULL,
    name TEXT NOT NULL,
    provider TEXT NOT NULL,
    encrypted_key TEXT NOT NULL,
    key_hint TEXT NOT NULL,
    enabled_models TEXT NOT NULL DEFAULT '[]',
    created_by TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (organization_id) REFERENCES organization(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES user(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_llm_api_key_org ON llm_api_key(organization_id);
CREATE INDEX IF NOT EXISTS idx_llm_api_key_org_provider ON llm_api_key(organization_id, provider);
