import { data } from 'react-router';
import { authContext, orgContext, sessionContext } from '~/context';
import { deleteComposerSchema } from '~/lib/validations/composer';
import type { Route } from './+types/composers.delete';

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

  const auth = context.get(authContext);
  const session = context.get(sessionContext);

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
      { error: 'Only workspace owners can delete composers' },
      { status: 403 },
    );
  }

  const formData = await request.formData();
  const result = deleteComposerSchema.safeParse({
    composerId: formData.get('composerId'),
  });

  if (!result.success) {
    const fieldErrors = result.error.flatten().fieldErrors;
    const firstError = fieldErrors.composerId?.[0] || 'Invalid input';
    return data({ error: firstError }, { status: 400 });
  }

  const { composerId } = result.data;
  const db = context.cloudflare.env.promptly;

  // Verify composer ownership
  const composerOwnership = await db
    .prepare('SELECT id FROM composer WHERE id = ? AND organization_id = ?')
    .bind(composerId, org.organizationId)
    .first();

  if (!composerOwnership) {
    return data({ error: 'Composer not found' }, { status: 404 });
  }

  // Soft delete the composer
  await db
    .prepare('UPDATE composer SET deleted_at = ? WHERE id = ?')
    .bind(Date.now(), composerId)
    .run();

  return { success: true };
};
