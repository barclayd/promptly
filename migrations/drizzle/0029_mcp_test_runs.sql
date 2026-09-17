CREATE TABLE mcp_test_run (
  connection_id TEXT NOT NULL REFERENCES mcp_connection(id) ON DELETE CASCADE,
  request_key TEXT NOT NULL,
  request_hash TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('running', 'completed', 'failed')),
  result_json TEXT CHECK (result_json IS NULL OR json_valid(result_json)),
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  PRIMARY KEY (connection_id, request_key)
);
--> statement-breakpoint
CREATE INDEX mcp_test_run_expiry ON mcp_test_run(expires_at)
  WHERE status != 'running';
