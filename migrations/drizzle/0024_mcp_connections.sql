CREATE TABLE mcp_connection (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL,
  organization_id TEXT NOT NULL,
  membership_id TEXT NOT NULL,
  client_id TEXT NOT NULL,
  client_name TEXT NOT NULL,
  scopes TEXT NOT NULL CHECK (json_valid(scopes) AND json_type(scopes) = 'array'),
  grant_id TEXT,
  created_at INTEGER NOT NULL,
  last_used_at INTEGER,
  revoked_at INTEGER,
  FOREIGN KEY (user_id) REFERENCES user(id) ON DELETE CASCADE,
  FOREIGN KEY (organization_id) REFERENCES organization(id) ON DELETE CASCADE,
  FOREIGN KEY (membership_id) REFERENCES member(id) ON DELETE CASCADE
);

CREATE INDEX idx_mcp_connection_organization_created
  ON mcp_connection(organization_id, created_at DESC);
CREATE INDEX idx_mcp_connection_user_created
  ON mcp_connection(user_id, created_at DESC);
CREATE INDEX idx_mcp_connection_membership
  ON mcp_connection(membership_id);
CREATE UNIQUE INDEX idx_mcp_connection_grant
  ON mcp_connection(grant_id) WHERE grant_id IS NOT NULL;
