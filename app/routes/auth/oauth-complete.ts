import { redirect } from 'react-router';
import { getAuth } from '~/lib/auth.server';
import { getRedirectTarget } from '~/lib/redirect';
import type { Route } from './+types/oauth-complete';

export const loader = async ({ request, context }: Route.LoaderArgs) => {
  const auth = getAuth(context);
  const url = new URL(request.url);
  const target = getRedirectTarget(url.searchParams.get('redirectTo'));

  const session = await auth.api.getSession({
    headers: request.headers,
  });

  if (!session?.user) {
    return redirect('/login');
  }

  const db = context.cloudflare.env.promptly;
  const now = Date.now();

  // Check for pending invitations matching the user's email
  const pendingInvitations = await db
    .prepare(
      `SELECT id, organization_id FROM invitation
       WHERE LOWER(email) = LOWER(?) AND status = 'pending' AND expires_at > ?`,
    )
    .bind(session.user.email, now)
    .all<{ id: string; organization_id: string }>();

  if (pendingInvitations.results?.length) {
    let joinedOrgId: string | null = null;

    for (const inv of pendingInvitations.results) {
      try {
        await auth.api.acceptInvitation({
          body: { invitationId: inv.id },
          headers: request.headers,
        });
        if (!joinedOrgId) {
          joinedOrgId = inv.organization_id;
        }
      } catch (error) {
        console.error(`Failed to auto-accept invitation ${inv.id}:`, error);
      }
    }

    if (joinedOrgId) {
      await auth.api.setActiveOrganization({
        body: { organizationId: joinedOrgId },
        headers: request.headers,
      });
      return redirect(target);
    }
  }

  // No invitations accepted — fall through to existing org logic
  const orgsResponse = await auth.api.listOrganizations({
    headers: request.headers,
  });

  if (orgsResponse && orgsResponse.length > 0) {
    await auth.api.setActiveOrganization({
      body: { organizationId: orgsResponse[0].id },
      headers: request.headers,
    });

    // Backfill organization_id on subscription if missing (OAuth users)
    await db
      .prepare(
        'UPDATE subscription SET organization_id = ? WHERE user_id = ? AND organization_id IS NULL',
      )
      .bind(orgsResponse[0].id, session.user.id)
      .run();
  }

  return redirect(target);
};

const OAuthComplete = () => null;
export default OAuthComplete;
