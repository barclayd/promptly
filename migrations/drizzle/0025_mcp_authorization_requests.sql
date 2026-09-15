CREATE TABLE mcp_authorization_request (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  session_id TEXT NOT NULL REFERENCES session(id) ON DELETE CASCADE,
  request_url TEXT NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX mcp_authorization_request_expiry_idx ON mcp_authorization_request(expires_at);

CREATE TABLE mcp_rate_limit (
  key TEXT PRIMARY KEY NOT NULL,
  window_start INTEGER NOT NULL,
  request_count INTEGER NOT NULL
);

CREATE TABLE mcp_usage (
  organization_id TEXT NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
  period TEXT NOT NULL,
  tool_name TEXT NOT NULL,
  request_count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (organization_id, period, tool_name)
);
