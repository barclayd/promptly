import { data } from 'react-router';
import { orgContext, sessionContext } from '~/context';
import { updateSnippetSchema } from '~/lib/validations/snippet';
import type { Route } from './+types/snippets.update';

export const action = async ({ request, context }: Route.ActionArgs) => {
  const org = context.get(orgContext);
  if (!org) {
    return data({ error: 'Unauthorized' }, { status: 403 });
  }

  const session = context.get(sessionContext);

  if (!session?.user) {
    return data({ error: 'Not authenticated' }, { status: 401 });
  }

  const formData = await request.formData();
  const result = updateSnippetSchema.safeParse({
    snippetId: formData.get('snippetId'),
    name: formData.get('name'),
    description: formData.get('description') || undefined,
  });

  if (!result.success) {
    const fieldErrors = result.error.flatten().fieldErrors;
    const firstError =
      fieldErrors.name?.[0] || fieldErrors.snippetId?.[0] || 'Invalid input';
    return data({ error: firstError }, { status: 400 });
  }

  const { snippetId, name, description } = result.data;
  const db = context.cloudflare.env.promptly;

  // Verify snippet ownership
  const snippetOwnership = await db
    .prepare('SELECT id FROM snippet WHERE id = ? AND organization_id = ?')
    .bind(snippetId, org.organizationId)
    .first();

  if (!snippetOwnership) {
    return data({ error: 'Snippet not found' }, { status: 404 });
  }

  // Update snippet
  await db
    .prepare(
      'UPDATE snippet SET name = ?, description = ?, updated_at = ? WHERE id = ?',
    )
    .bind(name, description || '', Date.now(), snippetId)
    .run();

  return { success: true };
};
