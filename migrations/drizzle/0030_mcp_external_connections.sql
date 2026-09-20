ALTER TABLE mcp_connection ADD COLUMN external_server_id TEXT;
ALTER TABLE mcp_connection ADD COLUMN external_resource TEXT;

CREATE INDEX idx_mcp_connection_external
  ON mcp_connection(external_server_id, organization_id)
  WHERE external_server_id IS NOT NULL;
