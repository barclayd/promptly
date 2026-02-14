CREATE TABLE IF NOT EXISTS api_usage (
  organization_id TEXT NOT NULL,
  period TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  PRIMARY KEY (organization_id, period)
);

CREATE INDEX idx_api_usage_period ON api_usage(period);
