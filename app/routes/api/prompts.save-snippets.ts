import { nanoid } from 'nanoid';
import { data } from 'react-router';
import { orgContext, sessionContext } from '~/context';
import { syncPromptSnippetRefs } from '~/lib/prompt-snippet-sync.server';
import type { Route } from './+types/prompts.save-snippets';

export const action = async ({ request, context }: Route.ActionArgs) => {
  const session = context.get(sessionContext);
  if (!session?.user) {
    return data({ error: 'Not authenticated' }, { status: 401 });
  }

  const org = context.get(orgContext);
  if (!org) {
    return data({ error: 'Unauthorized' }, { status: 403 });
  }

  const formData = await request.formData();
  const promptId = formData.get('promptId') as string;
  const snippetsJson = formData.get('snippets') as string;

  if (!promptId) {
    return data({ error: 'Missing promptId' }, { status: 400 });
  }

  const db = context.cloudflare.env.promptly;

  const promptOwnership = await db
    .prepare('SELECT id FROM prompt WHERE id = ? AND organization_id = ?')
    .bind(promptId, org.organizationId)
    .first();

  if (!promptOwnership) {
    return data({ error: 'Prompt not found' }, { status: 404 });
  }

  let snippets: Array<{
    snippetId: string;
    snippetVersionId: string | null;
    sortOrder: number;
  }> = [];

  try {
    snippets = JSON.parse(snippetsJson || '[]');
  } catch {
    return data({ error: 'Invalid snippets JSON' }, { status: 400 });
  }

  const currentVersion = await db
    .prepare(
      'SELECT id, published_at, system_message, user_message, config FROM prompt_version WHERE prompt_id = ? ORDER BY (published_at IS NULL) DESC, created_at DESC LIMIT 1',
    )
    .bind(promptId)
    .first<{
      id: string;
      published_at: number | null;
      system_message: string | null;
      user_message: string | null;
      config: string | null;
    }>();

  if (!currentVersion) {
    return data({ error: 'No version found' }, { status: 404 });
  }

  let targetVersionId = currentVersion.id;

  if (currentVersion.published_at !== null) {
    const newDraftId = nanoid();
    await db
      .prepare(
        'INSERT INTO prompt_version (id, prompt_id, system_message, user_message, config, created_by, updated_at, updated_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      )
      .bind(
        newDraftId,
        promptId,
        currentVersion.system_message,
        currentVersion.user_message,
        currentVersion.config,
        session.user.id,
        Date.now(),
        session.user.id,
      )
      .run();

    const existingRefs = await db
      .prepare(
        'SELECT snippet_id, snippet_version_id, sort_order FROM prompt_version_snippet WHERE prompt_version_id = ?',
      )
      .bind(currentVersion.id)
      .all<{
        snippet_id: string;
        snippet_version_id: string | null;
        sort_order: number;
      }>();

    for (const ref of existingRefs.results) {
      await db
        .prepare(
          'INSERT INTO prompt_version_snippet (id, prompt_version_id, snippet_id, snippet_version_id, sort_order) VALUES (?, ?, ?, ?, ?)',
        )
        .bind(
          nanoid(),
          newDraftId,
          ref.snippet_id,
          ref.snippet_version_id,
          ref.sort_order,
        )
        .run();
    }

    targetVersionId = newDraftId;
  }

  await syncPromptSnippetRefs(db, targetVersionId, snippets);

  return { success: true };
};
