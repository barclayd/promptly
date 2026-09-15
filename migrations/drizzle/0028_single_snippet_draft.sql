CREATE UNIQUE INDEX snippet_version_single_draft_uidx
  ON snippet_version (snippet_id)
  WHERE published_at IS NULL;
