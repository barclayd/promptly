import { data } from 'react-router';
import { orgContext } from '~/context';
import { getAuth } from '~/lib/auth.server';
import { invalidatePromptCache } from '~/lib/cache-invalidation.server';
import { updatePromptSchema } from '~/lib/validations/prompt';
import type { Route } from './+types/prompts.update';

export const action = async ({ request, context }: Route.ActionArgs) => {
  const org = context.get(orgContext);
  if (!org) {
    return data({ error: 'Unauthorized' }, { status: 403 });
  }

  const auth = getAuth(context);
  const session = await auth.api.getSession({
    headers: request.headers,
  });

  if (!session?.user) {
    return data({ error: 'Not authenticated' }, { status: 401 });
  }

  const formData = await request.formData();
  const result = updatePromptSchema.safeParse({
    promptId: formData.get('promptId'),
    name: formData.get('name'),
    description: formData.get('description') || undefined,
  });

  if (!result.success) {
    const fieldErrors = result.error.flatten().fieldErrors;
    const firstError =
      fieldErrors.name?.[0] || fieldErrors.promptId?.[0] || 'Invalid input';
    return data({ error: firstError }, { status: 400 });
  }

  const { promptId, name, description } = result.data;
  const db = context.cloudflare.env.promptly;

  // Verify prompt ownership
  const promptOwnership = await db
    .prepare('SELECT id FROM prompt WHERE id = ? AND organization_id = ?')
    .bind(promptId, org.organizationId)
    .first();

  if (!promptOwnership) {
    return data({ error: 'Prompt not found' }, { status: 404 });
  }

  // Update prompt
  await db
    .prepare(
      'UPDATE prompt SET name = ?, description = ?, updated_at = ? WHERE id = ?',
    )
    .bind(name, description || '', Date.now(), promptId)
    .run();

  // Invalidate API cache
  const cache = context.cloudflare.env.PROMPTS_CACHE;
  if (cache) {
    context.cloudflare.ctx.waitUntil(invalidatePromptCache(cache, promptId));
  }

  return { success: true };
};
