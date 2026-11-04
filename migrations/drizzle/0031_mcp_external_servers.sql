CREATE TABLE mcp_external_server (
  id TEXT PRIMARY KEY NOT NULL,
  organization_id TEXT NOT NULL,
  name TEXT NOT NULL,
  resource TEXT NOT NULL UNIQUE,
  key_hash TEXT NOT NULL,
  key_start TEXT NOT NULL,
  created_by TEXT,
  created_at INTEGER NOT NULL,
  key_created_at INTEGER NOT NULL,
  FOREIGN KEY (organization_id) REFERENCES organization(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES user(id) ON DELETE SET NULL
);

CREATE INDEX idx_mcp_external_server_organization
  ON mcp_external_server(organization_id, created_at DESC);
