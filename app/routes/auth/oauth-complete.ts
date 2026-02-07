import { redirect } from 'react-router';
import { getAuth } from '~/lib/auth.server';
import type { Route } from './+types/oauth-complete';

export const loader = async ({ request, context }: Route.LoaderArgs) => {
  const auth = getAuth(context);

  const session = await auth.api.getSession({
    headers: request.headers,
  });

  if (!session?.user) {
    return redirect('/login');
  }

  const orgsResponse = await auth.api.listOrganizations({
    headers: request.headers,
  });

  if (orgsResponse && orgsResponse.length > 0) {
    await auth.api.setActiveOrganization({
      body: { organizationId: orgsResponse[0].id },
      headers: request.headers,
    });

    // Backfill organization_id on subscription if missing (OAuth users)
    const db = context.cloudflare.env.promptly;
    await db
      .prepare(
        'UPDATE subscription SET organization_id = ? WHERE user_id = ? AND organization_id IS NULL',
      )
      .bind(orgsResponse[0].id, session.user.id)
      .run();
  }

  return redirect('/dashboard');
};

const OAuthComplete = () => null;
export default OAuthComplete;
