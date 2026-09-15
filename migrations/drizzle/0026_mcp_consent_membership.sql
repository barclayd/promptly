DROP TABLE mcp_authorization_request;
CREATE TABLE mcp_authorization_request (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  session_id TEXT NOT NULL,
  organization_id TEXT NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
  membership_id TEXT NOT NULL REFERENCES member(id) ON DELETE CASCADE,
  request_url TEXT NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX mcp_authorization_request_expiry_idx ON mcp_authorization_request(expires_at);
