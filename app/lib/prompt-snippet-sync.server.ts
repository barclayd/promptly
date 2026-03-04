import { nanoid } from 'nanoid';

export const syncPromptSnippetRefs = async (
  db: D1Database,
  promptVersionId: string,
  snippets: Array<{
    snippetId: string;
    snippetVersionId: string | null;
    sortOrder: number;
  }>,
): Promise<void> => {
  const existing = await db
    .prepare(
      'SELECT id, snippet_id, snippet_version_id, sort_order FROM prompt_version_snippet WHERE prompt_version_id = ?',
    )
    .bind(promptVersionId)
    .all<{
      id: string;
      snippet_id: string;
      snippet_version_id: string | null;
      sort_order: number;
    }>();

  const existingRows = existing.results ?? [];
  const existingBySnippetId = new Map(
    existingRows.map((r) => [r.snippet_id, r]),
  );
  const desiredSnippetIds = new Set(snippets.map((s) => s.snippetId));

  const toInsert = snippets.filter(
    (s) => !existingBySnippetId.has(s.snippetId),
  );
  for (const snippet of toInsert) {
    await db
      .prepare(
        `INSERT INTO prompt_version_snippet (id, prompt_version_id, snippet_id, snippet_version_id, sort_order)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .bind(
        nanoid(),
        promptVersionId,
        snippet.snippetId,
        snippet.snippetVersionId,
        snippet.sortOrder,
      )
      .run();
  }

  for (const row of existingRows) {
    if (!desiredSnippetIds.has(row.snippet_id)) continue;

    const desired = snippets.find((s) => s.snippetId === row.snippet_id);
    if (!desired) continue;

    const versionChanged = desired.snippetVersionId !== row.snippet_version_id;
    const sortOrderChanged = desired.sortOrder !== row.sort_order;

    if (versionChanged || sortOrderChanged) {
      await db
        .prepare(
          'UPDATE prompt_version_snippet SET snippet_version_id = ?, sort_order = ? WHERE id = ?',
        )
        .bind(desired.snippetVersionId, desired.sortOrder, row.id)
        .run();
    }
  }

  const toDelete = existingRows.filter(
    (r) => !desiredSnippetIds.has(r.snippet_id),
  );
  for (const row of toDelete) {
    await db
      .prepare('DELETE FROM prompt_version_snippet WHERE id = ?')
      .bind(row.id)
      .run();
  }
};
