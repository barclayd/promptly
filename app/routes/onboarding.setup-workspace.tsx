import { nanoid } from 'nanoid';
import { redirect } from 'react-router';
import { getAuth } from '~/lib/auth.server';
import type { Route } from './+types/onboarding.setup-workspace';

export const loader = async ({ request, context }: Route.LoaderArgs) => {
  const auth = getAuth(context);

  // Check if user is authenticated
  const session = await auth.api.getSession({
    headers: request.headers,
  });

  if (!session?.user) {
    return redirect('/login');
  }

  // Check if user already has an organization
  const orgs = await auth.api.listOrganizations({
    headers: request.headers,
  });

  if (orgs && orgs.length > 0) {
    // User already has an org, redirect to home
    return redirect('/dashboard');
  }

  // Create default organization
  await auth.api.createOrganization({
    body: {
      name: `${session.user.name}'s Workspace`,
      slug: nanoid(10),
    },
    headers: request.headers,
  });

  return redirect('/dashboard');
};

// No UI needed - this is a redirect-only route
const SetupWorkspace = () => null;
export default SetupWorkspace;
