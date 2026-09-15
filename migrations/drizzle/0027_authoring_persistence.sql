ALTER TABLE prompt ADD COLUMN revision TEXT NOT NULL DEFAULT '';
--> statement-breakpoint
ALTER TABLE composer ADD COLUMN revision TEXT NOT NULL DEFAULT '';
--> statement-breakpoint
UPDATE prompt SET revision = lower(hex(randomblob(16))) WHERE revision = '';
--> statement-breakpoint
UPDATE composer SET revision = lower(hex(randomblob(16))) WHERE revision = '';
--> statement-breakpoint
CREATE TRIGGER prompt_initial_revision AFTER INSERT ON prompt
WHEN NEW.revision = ''
BEGIN
  UPDATE prompt SET revision = lower(hex(randomblob(16))) WHERE id = NEW.id;
END;
--> statement-breakpoint
CREATE TRIGGER composer_initial_revision AFTER INSERT ON composer
WHEN NEW.revision = ''
BEGIN
  UPDATE composer SET revision = lower(hex(randomblob(16))) WHERE id = NEW.id;
END;
--> statement-breakpoint
CREATE UNIQUE INDEX prompt_one_draft ON prompt_version(prompt_id)
  WHERE published_at IS NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX composer_one_draft ON composer_version(composer_id)
  WHERE published_at IS NULL;
--> statement-breakpoint
CREATE TABLE authoring_request (
  id TEXT PRIMARY KEY NOT NULL,
  organization_id TEXT NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
  actor_scope TEXT NOT NULL,
  operation TEXT NOT NULL,
  request_key TEXT NOT NULL,
  request_hash TEXT NOT NULL,
  commit_state TEXT NOT NULL CHECK (commit_state IN ('pending', 'complete')),
  result_json TEXT NOT NULL CHECK (json_valid(result_json)),
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  UNIQUE (organization_id, actor_scope, operation, request_key)
);
--> statement-breakpoint
CREATE INDEX authoring_request_expiry ON authoring_request(expires_at);
--> statement-breakpoint
CREATE TABLE authoring_change (
  id TEXT PRIMARY KEY NOT NULL,
  organization_id TEXT NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
  prompt_id TEXT REFERENCES prompt(id) ON DELETE CASCADE,
  composer_id TEXT REFERENCES composer(id) ON DELETE CASCADE,
  actor_user_id TEXT REFERENCES user(id) ON DELETE SET NULL,
  actor_name TEXT NOT NULL,
  actor_scope TEXT NOT NULL,
  connection_id TEXT REFERENCES mcp_connection(id) ON DELETE SET NULL,
  client_id TEXT,
  client_name TEXT,
  operation TEXT NOT NULL,
  revision TEXT NOT NULL,
  version_id TEXT,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  CHECK ((prompt_id IS NOT NULL) != (composer_id IS NOT NULL))
);
--> statement-breakpoint
CREATE INDEX authoring_change_workspace_created
  ON authoring_change(organization_id, created_at DESC, id);
--> statement-breakpoint
CREATE INDEX authoring_change_prompt_created
  ON authoring_change(prompt_id, created_at DESC, id);
--> statement-breakpoint
CREATE INDEX authoring_change_composer_created
  ON authoring_change(composer_id, created_at DESC, id);
--> statement-breakpoint
CREATE INDEX authoring_change_expiry ON authoring_change(expires_at);
--> statement-breakpoint
CREATE INDEX authoring_change_user ON authoring_change(actor_user_id);
--> statement-breakpoint
CREATE INDEX authoring_change_connection ON authoring_change(connection_id);
--> statement-breakpoint
CREATE TABLE authoring_snapshot (
  change_id TEXT NOT NULL REFERENCES authoring_change(id) ON DELETE CASCADE,
  phase TEXT NOT NULL CHECK (phase IN ('before', 'after')),
  definition_json TEXT NOT NULL CHECK (json_valid(definition_json)),
  PRIMARY KEY (change_id, phase)
);
--> statement-breakpoint
CREATE TABLE authoring_outbox (
  id TEXT PRIMARY KEY NOT NULL,
  organization_id TEXT NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
  change_id TEXT NOT NULL,
  document_kind TEXT NOT NULL CHECK (document_kind IN ('prompt', 'composer')),
  document_id TEXT NOT NULL,
  revision TEXT NOT NULL,
  event_kind TEXT NOT NULL CHECK (event_kind IN ('invalidate_cache', 'notify_editors')),
  payload_json TEXT NOT NULL CHECK (json_valid(payload_json)),
  created_at INTEGER NOT NULL,
  available_at INTEGER NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  lease_id TEXT,
  lease_expires_at INTEGER,
  delivered_at INTEGER,
  last_error_code TEXT,
  UNIQUE (change_id, event_kind)
);
--> statement-breakpoint
CREATE INDEX authoring_outbox_pending ON authoring_outbox(available_at, id)
  WHERE delivered_at IS NULL;
--> statement-breakpoint
CREATE INDEX authoring_outbox_delivered ON authoring_outbox(delivered_at)
  WHERE delivered_at IS NOT NULL;
