import { data, redirect } from 'react-router';
import { z } from 'zod';
import { orgContext } from '~/context';
import { getAuth } from '~/lib/auth.server';
import { getSubscriptionStatus } from '~/lib/subscription.server';
import { inviteMemberSchema } from '~/lib/validations/team';
import type { Route } from './+types/team.invite';

export const action = async ({ request, context }: Route.ActionArgs) => {
  const formData = await request.formData();

  const rawData = {
    email: formData.get('email'),
    role: formData.get('role'),
  };

  const result = inviteMemberSchema.safeParse(rawData);

  if (!result.success) {
    return data(
      { errors: z.flattenError(result.error).fieldErrors },
      { status: 400 },
    );
  }

  const auth = getAuth(context);

  const session = await auth.api.getSession({
    headers: request.headers,
  });

  if (!session?.user) {
    return data({ errors: { _form: ['Not authenticated'] } }, { status: 401 });
  }

  const org = context.get(orgContext);

  if (!org) {
    return data(
      { errors: { _form: ['No organization found'] } },
      { status: 400 },
    );
  }

  // Check team member limit
  const db = context.cloudflare.env.promptly;
  const subscription = await getSubscriptionStatus(db, org.organizationId);
  if (subscription.limits.teamMembers !== -1) {
    const countResult = await db
      .prepare('SELECT COUNT(*) as count FROM member WHERE organization_id = ?')
      .bind(org.organizationId)
      .first<{ count: number }>();
    const currentCount = countResult?.count ?? 0;
    if (currentCount >= subscription.limits.teamMembers) {
      return data(
        {
          limitExceeded: true,
          resource: 'team' as const,
          current: currentCount,
          limit: subscription.limits.teamMembers,
        },
        { status: 403 },
      );
    }
  }

  try {
    // Use BetterAuth's createInvitation API
    const inviteResponse = await auth.api.createInvitation({
      body: {
        email: result.data.email,
        role: result.data.role,
        organizationId: org.organizationId,
      },
      headers: request.headers,
      asResponse: true,
    });

    if (!inviteResponse.ok) {
      const errorBody = await inviteResponse.json().catch(() => ({}));
      const errorMessage =
        (errorBody as { message?: string })?.message ||
        'Failed to send invitation';

      // Handle specific error cases
      if (inviteResponse.status === 400) {
        return data({ errors: { email: [errorMessage] } }, { status: 400 });
      }

      return data(
        { errors: { _form: [errorMessage] } },
        { status: inviteResponse.status },
      );
    }

    // Redirect back to team page on success
    return redirect('/team');
  } catch (error) {
    console.error('Failed to create invitation:', error);
    return data(
      { errors: { _form: ['An unexpected error occurred'] } },
      { status: 500 },
    );
  }
};
