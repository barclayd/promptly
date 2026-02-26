import { data } from 'react-router';
import { orgContext, sessionContext } from '~/context';
import { updateComposerSchema } from '~/lib/validations/composer';
import type { Route } from './+types/composers.update';

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
  const result = updateComposerSchema.safeParse({
    composerId: formData.get('composerId'),
    name: formData.get('name'),
    description: formData.get('description') || undefined,
  });

  if (!result.success) {
    const fieldErrors = result.error.flatten().fieldErrors;
    const firstError =
      fieldErrors.name?.[0] || fieldErrors.composerId?.[0] || 'Invalid input';
    return data({ error: firstError }, { status: 400 });
  }

  const { composerId, name, description } = result.data;
  const db = context.cloudflare.env.promptly;

  // Verify composer ownership
  const composerOwnership = await db
    .prepare('SELECT id FROM composer WHERE id = ? AND organization_id = ?')
    .bind(composerId, org.organizationId)
    .first();

  if (!composerOwnership) {
    return data({ error: 'Composer not found' }, { status: 404 });
  }

  // Update composer
  await db
    .prepare(
      'UPDATE composer SET name = ?, description = ?, updated_at = ? WHERE id = ?',
    )
    .bind(name, description || '', Date.now(), composerId)
    .run();

  return { success: true };
};
