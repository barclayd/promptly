import { data, redirect } from 'react-router';
import { z } from 'zod';
import { orgContext } from '~/context';
import { getAuth } from '~/lib/auth.server';
import { cancelInvitationSchema } from '~/lib/validations/team';
import type { Route } from './+types/team.cancel-invite';

export const action = async ({ request, context }: Route.ActionArgs) => {
  const formData = await request.formData();

  const rawData = {
    invitationId: formData.get('invitationId'),
  };

  const result = cancelInvitationSchema.safeParse(rawData);

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
    return data(
      { errors: { _form: ['Not authenticated'] } },
      { status: 401 },
    );
  }

  const org = context.get(orgContext);

  if (!org) {
    return data(
      { errors: { _form: ['No organization found'] } },
      { status: 400 },
    );
  }

  try {
    // Use BetterAuth's cancelInvitation API
    const cancelResponse = await auth.api.cancelInvitation({
      body: {
        invitationId: result.data.invitationId,
      },
      headers: request.headers,
      asResponse: true,
    });

    if (!cancelResponse.ok) {
      const errorBody = await cancelResponse.json().catch(() => ({}));
      const errorMessage =
        (errorBody as { message?: string })?.message ||
        'Failed to cancel invitation';

      return data(
        { errors: { _form: [errorMessage] } },
        { status: cancelResponse.status },
      );
    }

    // Redirect back to team page on success
    return redirect('/team');
  } catch (error) {
    console.error('Failed to cancel invitation:', error);
    return data(
      { errors: { _form: ['An unexpected error occurred'] } },
      { status: 500 },
    );
  }
};
