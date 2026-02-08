import { IconCheck, IconX } from '@tabler/icons-react';
import { data, Form, redirect, useNavigation } from 'react-router';
import { Button } from '~/components/ui/button';
import { getAuth } from '~/lib/auth.server';
import { roleLabels } from '~/lib/validations/team';
import type { Route } from './+types/team.accept-invitation.$id';

type Invitation = {
  id: string;
  email: string;
  role: string | null;
  status: string;
  expiresAt: Date;
  organizationId: string;
  organization?: {
    id: string;
    name: string;
    slug: string;
    logo?: string | null;
  };
  inviter?: {
    user: {
      name: string;
      email: string;
      image?: string | null;
    };
  };
};

// biome-ignore lint/correctness/noEmptyPattern: react router default
export const meta = ({}: Route.MetaArgs) => [
  { title: 'Accept Invitation | Promptly' },
  {
    name: 'description',
    content: 'Accept your team invitation',
  },
];

export const loader = async ({
  params,
  request,
  context,
}: Route.LoaderArgs) => {
  const { id } = params;

  if (!id) {
    throw new Response('Invitation not found', { status: 404 });
  }

  const auth = getAuth(context);

  // Check if user is logged in
  const session = await auth.api.getSession({
    headers: request.headers,
  });

  // Get invitation details
  const invitationResponse = await auth.api.getInvitation({
    query: {
      id,
    },
    headers: request.headers,
    asResponse: true,
  });

  if (!invitationResponse.ok) {
    throw new Response('Invitation not found or expired', { status: 404 });
  }

  const invitation = (await invitationResponse.json()) as Invitation;

  // Check if invitation is still valid
  if (invitation.status !== 'pending') {
    throw new Response('This invitation has already been used', {
      status: 400,
    });
  }

  if (new Date(invitation.expiresAt) < new Date()) {
    throw new Response('This invitation has expired', { status: 400 });
  }

  return {
    invitation,
    isLoggedIn: !!session?.user,
    userEmail: session?.user?.email,
  };
};

export const action = async ({
  params,
  request,
  context,
}: Route.ActionArgs) => {
  const { id } = params;
  const formData = await request.formData();
  const intent = formData.get('intent');

  if (!id) {
    return data({ error: 'Invitation not found' }, { status: 404 });
  }

  const auth = getAuth(context);

  const session = await auth.api.getSession({
    headers: request.headers,
  });

  if (!session?.user) {
    // Redirect to login with return URL
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', `/team/accept-invitation/${id}`);
    return redirect(loginUrl.toString());
  }

  try {
    if (intent === 'accept') {
      const acceptResponse = await auth.api.acceptInvitation({
        body: {
          invitationId: id,
        },
        headers: request.headers,
        asResponse: true,
      });

      if (!acceptResponse.ok) {
        const errorBody = await acceptResponse.json().catch(() => ({}));
        const errorMessage =
          (errorBody as { message?: string })?.message ||
          'Failed to accept invitation';
        return data({ error: errorMessage }, { status: acceptResponse.status });
      }

      return redirect('/team');
    }

    if (intent === 'reject') {
      const rejectResponse = await auth.api.rejectInvitation({
        body: {
          invitationId: id,
        },
        headers: request.headers,
        asResponse: true,
      });

      if (!rejectResponse.ok) {
        const errorBody = await rejectResponse.json().catch(() => ({}));
        const errorMessage =
          (errorBody as { message?: string })?.message ||
          'Failed to reject invitation';
        return data({ error: errorMessage }, { status: rejectResponse.status });
      }

      return redirect('/dashboard');
    }

    return data({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Failed to process invitation:', error);
    return data({ error: 'An unexpected error occurred' }, { status: 500 });
  }
};

const AcceptInvitation = ({ loaderData, actionData }: Route.ComponentProps) => {
  const { invitation, isLoggedIn, userEmail } = loaderData;
  const navigation = useNavigation();
  const isSubmitting = navigation.state === 'submitting';
  const error = actionData?.error;

  const orgName = invitation.organization?.name || 'the organization';
  const inviterName = invitation.inviter?.user?.name || 'A team member';
  const role = roleLabels[invitation.role || 'member'] || invitation.role;

  return (
    <div className="min-h-screen bg-gradient-to-br from-muted to-muted/50 dark:from-background dark:to-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <div className="flex items-center gap-2 text-foreground">
            <img
              src="https://images.keepfre.sh/app/icons/promptly/promptly-light.webp"
              alt=""
              className="size-8 dark:hidden"
            />
            <img
              src="https://images.keepfre.sh/app/icons/promptly/promptly.webp"
              alt=""
              className="size-8 hidden dark:block"
            />
            <span className="text-xl font-semibold">Promptly</span>
          </div>
        </div>

        {/* Card */}
        <div className="bg-card rounded-2xl shadow-xl shadow-black/5 dark:shadow-black/20 border border-border overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-br from-primary to-primary/80 px-6 py-8 text-center">
            <div className="inline-flex items-center justify-center size-16 rounded-full bg-white/10 backdrop-blur-sm mb-4">
              <span className="text-2xl font-bold text-primary-foreground">
                {orgName.charAt(0).toUpperCase()}
              </span>
            </div>
            <h1 className="text-xl font-semibold text-primary-foreground mb-1">
              Join {orgName}
            </h1>
            <p className="text-primary-foreground/70 text-sm">
              {inviterName} invited you to join as {role}
            </p>
          </div>

          {/* Content */}
          <div className="p-6">
            {error && (
              <div className="mb-4 rounded-lg bg-destructive/10 border border-destructive/20 p-3">
                <p className="text-destructive text-sm">{error}</p>
              </div>
            )}

            {!isLoggedIn ? (
              <div className="space-y-4">
                <p className="text-muted-foreground text-sm text-center">
                  Please sign in to accept this invitation.
                </p>
                <Form method="post">
                  <input type="hidden" name="intent" value="accept" />
                  <Button type="submit" className="w-full">
                    Sign in to Accept
                  </Button>
                </Form>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="bg-muted rounded-lg p-4 text-sm">
                  <p className="text-muted-foreground">
                    Signed in as{' '}
                    <span className="font-medium text-foreground">
                      {userEmail}
                    </span>
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <Form method="post">
                    <input type="hidden" name="intent" value="reject" />
                    <Button
                      type="submit"
                      variant="outline"
                      className="w-full gap-2"
                      disabled={isSubmitting}
                    >
                      <IconX className="size-4" />
                      Decline
                    </Button>
                  </Form>
                  <Form method="post">
                    <input type="hidden" name="intent" value="accept" />
                    <Button
                      type="submit"
                      className="w-full gap-2"
                      disabled={isSubmitting}
                    >
                      {isSubmitting ? (
                        <span className="size-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      ) : (
                        <IconCheck className="size-4" />
                      )}
                      Accept
                    </Button>
                  </Form>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 bg-muted border-t border-border">
            <p className="text-xs text-muted-foreground text-center">
              This invitation expires on{' '}
              {new Date(invitation.expiresAt).toLocaleDateString('en-GB', {
                dateStyle: 'long',
              })}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AcceptInvitation;
