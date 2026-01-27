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
  }

  return redirect('/');
};

const OAuthComplete = () => null;
export default OAuthComplete;
