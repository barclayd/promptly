import { nanoid } from 'nanoid';

export const syncComposerPromptRefs = async (
  db: D1Database,
  composerVersionId: string,
  promptIds: string[],
): Promise<void> => {
  // Fetch existing junction rows for this version
  const existing = await db
    .prepare(
      'SELECT id, prompt_id FROM composer_version_prompt WHERE composer_version_id = ?',
    )
    .bind(composerVersionId)
    .all<{ id: string; prompt_id: string }>();

  const existingRows = existing.results ?? [];
  const existingPromptIds = new Set(existingRows.map((r) => r.prompt_id));
  const desiredPromptIds = new Set(promptIds);

  // INSERT new refs (not already in junction)
  const toInsert = promptIds.filter((id) => !existingPromptIds.has(id));
  for (const promptId of toInsert) {
    await db
      .prepare(
        `INSERT INTO composer_version_prompt (id, composer_version_id, prompt_id, auto_update)
         VALUES (?, ?, ?, 1)`,
      )
      .bind(nanoid(), composerVersionId, promptId)
      .run();
  }

  // DELETE stale refs no longer in content
  const toDelete = existingRows.filter(
    (r) => !desiredPromptIds.has(r.prompt_id),
  );
  for (const row of toDelete) {
    await db
      .prepare('DELETE FROM composer_version_prompt WHERE id = ?')
      .bind(row.id)
      .run();
  }
};
