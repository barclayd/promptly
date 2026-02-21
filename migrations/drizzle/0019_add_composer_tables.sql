-- Composer folders (mirrors snippet_folder exactly)
CREATE TABLE composer_folder (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  organization_id TEXT NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
  created_by TEXT NOT NULL REFERENCES user(id) ON DELETE SET NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);

CREATE INDEX composer_folder_organizationId_idx ON composer_folder(organization_id);
CREATE UNIQUE INDEX composer_folder_org_name_uidx ON composer_folder(organization_id, name);

-- Composers (mirrors snippet)
CREATE TABLE composer (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  folder_id TEXT REFERENCES composer_folder(id) ON DELETE SET NULL,
  organization_id TEXT NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
  created_by TEXT NOT NULL REFERENCES user(id) ON DELETE SET NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  deleted_at INTEGER
);

CREATE INDEX composer_organizationId_idx ON composer(organization_id);
CREATE INDEX composer_folderId_idx ON composer(folder_id);
CREATE UNIQUE INDEX composer_org_name_uidx ON composer(organization_id, name) WHERE deleted_at IS NULL;

-- Composer versions (mirrors snippet_version, no token count columns)
CREATE TABLE composer_version (
  id TEXT PRIMARY KEY NOT NULL,
  composer_id TEXT NOT NULL REFERENCES composer(id) ON DELETE CASCADE,
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
  published_by TEXT REFERENCES user(id) ON DELETE SET NULL
);

CREATE INDEX composer_version_composerId_idx ON composer_version(composer_id);
CREATE UNIQUE INDEX composer_version_composer_semver_uidx
  ON composer_version(composer_id, major, minor, patch)
  WHERE major IS NOT NULL;

-- Junction table: which prompts are referenced by which composer versions
CREATE TABLE composer_version_prompt (
  id TEXT PRIMARY KEY NOT NULL,
  composer_version_id TEXT NOT NULL REFERENCES composer_version(id) ON DELETE CASCADE,
  prompt_id TEXT NOT NULL REFERENCES prompt(id) ON DELETE RESTRICT,
  prompt_version_id TEXT REFERENCES prompt_version(id) ON DELETE SET NULL,
  auto_update INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);

CREATE INDEX cvp_composer_version_idx ON composer_version_prompt(composer_version_id);
CREATE INDEX cvp_prompt_idx ON composer_version_prompt(prompt_id);
CREATE UNIQUE INDEX cvp_unique_ref ON composer_version_prompt(composer_version_id, prompt_id);
