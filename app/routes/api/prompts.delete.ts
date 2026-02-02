import { data } from 'react-router';
import { orgContext } from '~/context';
import { getAuth } from '~/lib/auth.server';
import { invalidatePromptCache } from '~/lib/cache-invalidation.server';
import { deletePromptSchema } from '~/lib/validations/prompt';
import type { Route } from './+types/prompts.delete';

type Member = {
  userId: string;
  role: 'member' | 'admin' | 'owner';
};

type FullOrganization = {
  members?: Member[];
};

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

  // Check if user is owner
  const orgResponse = await auth.api.getFullOrganization({
    query: { organizationId: org.organizationId },
    headers: request.headers,
    asResponse: true,
  });
  const fullOrg = (await orgResponse.json()) as FullOrganization | null;
  const currentUserMember = fullOrg?.members?.find(
    (m) => m.userId === session.user.id,
  );

  if (currentUserMember?.role !== 'owner') {
    return data(
      { error: 'Only workspace owners can delete prompts' },
      { status: 403 },
    );
  }

  const formData = await request.formData();
  const result = deletePromptSchema.safeParse({
    promptId: formData.get('promptId'),
  });

  if (!result.success) {
    const fieldErrors = result.error.flatten().fieldErrors;
    const firstError = fieldErrors.promptId?.[0] || 'Invalid input';
    return data({ error: firstError }, { status: 400 });
  }

  const { promptId } = result.data;
  const db = context.cloudflare.env.promptly;

  // Verify prompt ownership
  const promptOwnership = await db
    .prepare('SELECT id FROM prompt WHERE id = ? AND organization_id = ?')
    .bind(promptId, org.organizationId)
    .first();

  if (!promptOwnership) {
    return data({ error: 'Prompt not found' }, { status: 404 });
  }

  // Soft delete the prompt
  await db
    .prepare('UPDATE prompt SET deleted_at = ? WHERE id = ?')
    .bind(Date.now(), promptId)
    .run();

  // Invalidate API cache
  const cache = context.cloudflare.env.PROMPTS_CACHE;
  if (cache) {
    context.cloudflare.ctx.waitUntil(invalidatePromptCache(cache, promptId));
  }

  return { success: true };
};
