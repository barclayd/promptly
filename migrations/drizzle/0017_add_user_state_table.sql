CREATE TABLE user_state (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL,
  key TEXT NOT NULL,
  value TEXT NOT NULL DEFAULT '1',
  created_at INTEGER NOT NULL DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)),
  updated_at INTEGER NOT NULL DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)),
  FOREIGN KEY (user_id) REFERENCES user(id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX idx_user_state_user_key ON user_state(user_id, key);
