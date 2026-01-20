import { redirect } from 'react-router';
import { getAuth } from '~/lib/auth.server';
import type { Route } from './+types/invite.$id.callback';

type Invitation = {
  id: string;
  email: string;
  role: string | null;
  status: string;
  expiresAt: Date;
  organizationId: string;
};

export const loader = async ({ params, request, context }: Route.LoaderArgs) => {
  const { id } = params;

  if (!id) {
    throw new Response('Invitation not found', { status: 404 });
  }

  const auth = getAuth(context);

  const session = await auth.api.getSession({
    headers: request.headers,
  });

  if (!session?.user) {
    return redirect(`/invite/${id}`);
  }

  const invitationResponse = await auth.api.getInvitation({
    query: { id },
    headers: request.headers,
    asResponse: true,
  });

  if (!invitationResponse.ok) {
    throw new Response('Invitation not found or expired', { status: 404 });
  }

  const invitation = (await invitationResponse.json()) as Invitation;

  if (invitation.status !== 'pending') {
    throw new Response('This invitation has already been used', { status: 400 });
  }

  if (invitation.email !== session.user.email) {
    return redirect(`/invite/${id}?error=email_mismatch`);
  }

  try {
    const acceptResponse = await auth.api.acceptInvitation({
      body: { invitationId: id },
      headers: request.headers,
      asResponse: true,
    });

    if (!acceptResponse.ok) {
      return redirect(`/invite/${id}?error=accept_failed`);
    }

    return redirect('/?joined=true');
  } catch {
    return redirect(`/invite/${id}?error=accept_failed`);
  }
};

const InviteCallback = () => {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin size-8 border-4 border-slate-200 border-t-slate-600 rounded-full" />
    </div>
  );
};

export default InviteCallback;
