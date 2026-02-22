import { nanoid } from 'nanoid';

export const syncComposerPromptRefs = async (
  db: D1Database,
  composerVersionId: string,
  promptIds: string[],
  versionPins?: Map<string, string>,
): Promise<void> => {
  // Fetch existing junction rows for this version
  const existing = await db
    .prepare(
      'SELECT id, prompt_id, prompt_version_id, auto_update FROM composer_version_prompt WHERE composer_version_id = ?',
    )
    .bind(composerVersionId)
    .all<{
      id: string;
      prompt_id: string;
      prompt_version_id: string | null;
      auto_update: number;
    }>();

  const existingRows = existing.results ?? [];
  const existingByPromptId = new Map(existingRows.map((r) => [r.prompt_id, r]));
  const desiredPromptIds = new Set(promptIds);

  // INSERT new refs (not already in junction)
  const toInsert = promptIds.filter((id) => !existingByPromptId.has(id));
  for (const promptId of toInsert) {
    const pinnedVersionId = versionPins?.get(promptId) ?? null;
    await db
      .prepare(
        `INSERT INTO composer_version_prompt (id, composer_version_id, prompt_id, prompt_version_id, auto_update)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .bind(
        nanoid(),
        composerVersionId,
        promptId,
        pinnedVersionId,
        pinnedVersionId ? 0 : 1,
      )
      .run();
  }

  // UPDATE existing refs if pin state changed
  for (const row of existingRows) {
    if (!desiredPromptIds.has(row.prompt_id)) continue;

    const desiredVersionId = versionPins?.get(row.prompt_id) ?? null;
    const currentVersionId = row.prompt_version_id;

    if (desiredVersionId !== currentVersionId) {
      await db
        .prepare(
          'UPDATE composer_version_prompt SET prompt_version_id = ?, auto_update = ? WHERE id = ?',
        )
        .bind(desiredVersionId, desiredVersionId ? 0 : 1, row.id)
        .run();
    }
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
