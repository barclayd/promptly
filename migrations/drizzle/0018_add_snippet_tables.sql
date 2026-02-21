-- Snippet folders (mirrors prompt_folder exactly)
CREATE TABLE snippet_folder (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  organization_id TEXT NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
  created_by TEXT NOT NULL REFERENCES user(id) ON DELETE SET NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);

CREATE INDEX snippet_folder_organizationId_idx ON snippet_folder(organization_id);
CREATE UNIQUE INDEX snippet_folder_org_name_uidx ON snippet_folder(organization_id, name);

-- Snippets (mirrors prompt, adds description field)
CREATE TABLE snippet (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  folder_id TEXT REFERENCES snippet_folder(id) ON DELETE SET NULL,
  organization_id TEXT NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
  created_by TEXT NOT NULL REFERENCES user(id) ON DELETE SET NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  deleted_at INTEGER
);

CREATE INDEX snippet_organizationId_idx ON snippet(organization_id);
CREATE INDEX snippet_folderId_idx ON snippet(folder_id);
CREATE UNIQUE INDEX snippet_org_name_uidx ON snippet(organization_id, name) WHERE deleted_at IS NULL;

-- Snippet versions (mirrors prompt_version, single 'content' field instead of system_message + user_message)
CREATE TABLE snippet_version (
  id TEXT PRIMARY KEY NOT NULL,
  snippet_id TEXT NOT NULL REFERENCES snippet(id) ON DELETE CASCADE,
  major INTEGER,
  minor INTEGER,
  patch INTEGER,
  content TEXT,
  config TEXT NOT NULL DEFAULT '{}',
  labels TEXT,
  created_by TEXT NOT NULL REFERENCES user(id) ON DELETE SET NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  updated_at INTEGER,
  updated_by TEXT REFERENCES user(id) ON DELETE SET NULL,
  published_at INTEGER,
  published_by TEXT REFERENCES user(id) ON DELETE SET NULL,
  last_output_tokens INTEGER,
  last_system_input_tokens INTEGER
);

CREATE INDEX snippet_version_snippetId_idx ON snippet_version(snippet_id);
CREATE UNIQUE INDEX snippet_version_snippet_semver_uidx
  ON snippet_version(snippet_id, major, minor, patch)
  WHERE major IS NOT NULL;

-- Junction table: which snippets are attached to which prompt versions
CREATE TABLE prompt_version_snippet (
  id TEXT PRIMARY KEY NOT NULL,
  prompt_version_id TEXT NOT NULL REFERENCES prompt_version(id) ON DELETE CASCADE,
  snippet_id TEXT NOT NULL REFERENCES snippet(id) ON DELETE RESTRICT,
  snippet_version_id TEXT REFERENCES snippet_version(id) ON DELETE SET NULL,
  auto_update INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);

CREATE INDEX pvs_prompt_version_idx ON prompt_version_snippet(prompt_version_id);
CREATE INDEX pvs_snippet_idx ON prompt_version_snippet(snippet_id);
CREATE UNIQUE INDEX pvs_unique_ref ON prompt_version_snippet(prompt_version_id, snippet_id);
