-- Backfill: un-pin auto-update composer prompt refs that were frozen by the old
-- pin-on-publish behavior. Previously, publishing a composer resolved every NULL
-- prompt_version_id (which is set in lockstep with auto_update = 1) to the latest
-- published prompt version and wrote it back, freezing the composer. Setting
-- prompt_version_id back to NULL lets the API resolve the latest published prompt
-- version at request time, restoring auto-update for already-published composers.
-- Explicit pins (auto_update = 0) carry their own prompt_version_id and are untouched.
UPDATE composer_version_prompt SET prompt_version_id = NULL WHERE auto_update = 1 AND prompt_version_id IS NOT NULL;
