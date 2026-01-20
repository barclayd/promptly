import { IconCheck } from '@tabler/icons-react';
import { CamelCasePlugin, Kysely } from 'kysely';
import { D1Dialect } from 'kysely-d1';
import { data, redirect, useFetcher } from 'react-router';
import { NavLink } from 'react-router';
import { z } from 'zod';
import { SignUpForm } from '~/components/sign-up-form';
import { Button } from '~/components/ui/button';
import { Card, CardContent } from '~/components/ui/card';
import { FieldDescription } from '~/components/ui/field';
import {
  Item,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from '~/components/ui/item';
import { getAuth } from '~/lib/auth.server';
import { roleLabels } from '~/lib/validations/team';
import type { Route } from './+types/invite.$id';

type InvitationDatabase = {
  invitation: {
    id: string;
    email: string;
    role: string | null;
    status: string;
    expires_at: number;
    organization_id: string;
    inviter_id: string;
  };
  organization: {
    id: string;
    name: string;
    slug: string;
    logo: string | null;
  };
  user: {
    id: string;
    name: string;
    email: string;
    image: string | null;
  };
};

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

const inviteSignUpSchema = z
  .object({
    name: z.string().min(1, 'Name is required'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

// biome-ignore lint/correctness/noEmptyPattern: react router default
export const meta = ({}: Route.MetaArgs) => [
  { title: 'Join Team | Promptly' },
  {
    name: 'description',
    content: 'Accept your team invitation and join Promptly',
  },
];

export const loader = async ({ params, request, context }: Route.LoaderArgs) => {
  const { id } = params;

  if (!id) {
    throw new Response('Invitation not found', { status: 404 });
  }

  const auth = getAuth(context);

  const session = await auth.api.getSession({
    headers: request.headers,
  });

  // Query invitation directly from database (no auth required)
  // This is needed because auth.api.getInvitation requires an authenticated session
  const db = new Kysely<InvitationDatabase>({
    dialect: new D1Dialect({ database: context.cloudflare.env.promptly }),
    plugins: [new CamelCasePlugin()],
  });

  const invitationRow = await db
    .selectFrom('invitation')
    .innerJoin('organization', 'organization.id', 'invitation.organizationId')
    .innerJoin('user as inviter', 'inviter.id', 'invitation.inviterId')
    .select([
      'invitation.id',
      'invitation.email',
      'invitation.role',
      'invitation.status',
      'invitation.expiresAt',
      'invitation.organizationId',
      'organization.id as orgId',
      'organization.name as orgName',
      'organization.slug as orgSlug',
      'organization.logo as orgLogo',
      'inviter.name as inviterName',
      'inviter.email as inviterEmail',
      'inviter.image as inviterImage',
    ])
    .where('invitation.id', '=', id)
    .executeTakeFirst();

  if (!invitationRow) {
    throw new Response('Invitation not found or expired', { status: 404 });
  }

  if (invitationRow.status !== 'pending') {
    throw new Response('This invitation has already been used', { status: 400 });
  }

  if (new Date(invitationRow.expiresAt) < new Date()) {
    throw new Response('This invitation has expired', { status: 400 });
  }

  const invitation: Invitation = {
    id: invitationRow.id,
    email: invitationRow.email,
    role: invitationRow.role,
    status: invitationRow.status,
    expiresAt: new Date(invitationRow.expiresAt),
    organizationId: invitationRow.organizationId,
    organization: {
      id: invitationRow.orgId,
      name: invitationRow.orgName,
      slug: invitationRow.orgSlug,
      logo: invitationRow.orgLogo,
    },
    inviter: {
      user: {
        name: invitationRow.inviterName,
        email: invitationRow.inviterEmail,
        image: invitationRow.inviterImage,
      },
    },
  };

  return {
    invitation,
    isLoggedIn: !!session?.user,
    userEmail: session?.user?.email,
  };
};

export const action = async ({ params, request, context }: Route.ActionArgs) => {
  const { id } = params;
  const formData = await request.formData();
  const intent = formData.get('intent');

  if (!id) {
    return data({ errors: { form: ['Invitation not found'] } }, { status: 404 });
  }

  const auth = getAuth(context);

  // Query invitation directly from database (no auth required)
  const db = new Kysely<InvitationDatabase>({
    dialect: new D1Dialect({ database: context.cloudflare.env.promptly }),
    plugins: [new CamelCasePlugin()],
  });

  const invitationRow = await db
    .selectFrom('invitation')
    .select(['id', 'email', 'role', 'status', 'expiresAt', 'organizationId'])
    .where('id', '=', id)
    .executeTakeFirst();

  if (!invitationRow) {
    return data(
      { errors: { form: ['Invitation not found or expired'] } },
      { status: 404 },
    );
  }

  const invitation = {
    id: invitationRow.id,
    email: invitationRow.email,
    role: invitationRow.role,
    status: invitationRow.status,
    expiresAt: new Date(invitationRow.expiresAt),
    organizationId: invitationRow.organizationId,
  };

  if (intent === 'signup') {
    const rawData = {
      name: formData.get('name'),
      password: formData.get('password'),
      confirmPassword: formData.get('confirmPassword'),
    };

    const result = inviteSignUpSchema.safeParse(rawData);

    if (!result.success) {
      return data(
        { errors: z.flattenError(result.error).fieldErrors },
        { status: 400 },
      );
    }

    try {
      const signUpResponse = await auth.api.signUpEmail({
        body: {
          name: result.data.name,
          email: invitation.email,
          password: result.data.password,
        },
        asResponse: true,
      });

      if (!signUpResponse.ok) {
        const errorBody = await signUpResponse.json().catch(() => ({}));
        const errorMessage =
          (errorBody as { message?: string })?.message || 'Failed to create account';
        return data({ errors: { form: [errorMessage] } }, { status: 400 });
      }

      const setCookie = signUpResponse.headers.get('set-cookie');

      const acceptResponse = await auth.api.acceptInvitation({
        body: { invitationId: id },
        headers: setCookie ? { Cookie: setCookie } : {},
        asResponse: true,
      });

      if (!acceptResponse.ok) {
        const errorBody = await acceptResponse.json().catch(() => ({}));
        const errorMessage =
          (errorBody as { message?: string })?.message ||
          'Account created but failed to accept invitation';
        return data({ errors: { form: [errorMessage] } }, { status: 400 });
      }

      // Set the joined organization as active
      await auth.api.setActiveOrganization({
        body: { organizationId: invitation.organizationId },
        headers: setCookie ? { Cookie: setCookie } : {},
      });

      return redirect('/', {
        headers: setCookie ? { 'Set-Cookie': setCookie } : {},
      });
    } catch (error) {
      console.error('Invite signup error:', error);
      const message =
        error instanceof Error ? error.message : 'Registration failed';
      return data({ errors: { form: [message] } }, { status: 400 });
    }
  }

  if (intent === 'accept') {
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session?.user) {
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('redirect', `/invite/${id}`);
      return redirect(loginUrl.toString());
    }

    try {
      const acceptResponse = await auth.api.acceptInvitation({
        body: { invitationId: id },
        headers: request.headers,
        asResponse: true,
      });

      if (!acceptResponse.ok) {
        const errorBody = await acceptResponse.json().catch(() => ({}));
        const errorMessage =
          (errorBody as { message?: string })?.message ||
          'Failed to accept invitation';
        return data({ errors: { form: [errorMessage] } }, { status: 400 });
      }

      // Set the joined organization as active
      await auth.api.setActiveOrganization({
        body: { organizationId: invitation.organizationId },
        headers: request.headers,
      });

      return redirect('/team');
    } catch (error) {
      console.error('Accept invitation error:', error);
      return data(
        { errors: { form: ['An unexpected error occurred'] } },
        { status: 500 },
      );
    }
  }

  if (intent === 'google') {
    const response = await auth.api.signInSocial({
      body: {
        provider: 'google',
        callbackURL: `/invite/${id}/callback`,
      },
      asResponse: true,
    });

    const responseData = (await response.json()) as { url?: string };

    if (!responseData.url) {
      return data(
        { errors: { form: ['Failed to start Google sign-in'] } },
        { status: 500 },
      );
    }

    const setCookie = response.headers.get('set-cookie');

    return redirect(responseData.url, {
      headers: setCookie ? { 'Set-Cookie': setCookie } : {},
    });
  }

  return data({ errors: { form: ['Invalid action'] } }, { status: 400 });
};

type ActionData = {
  errors?: {
    name?: string[];
    password?: string[];
    confirmPassword?: string[];
    form?: string[];
  };
};

const InvitePage = ({ loaderData, actionData }: Route.ComponentProps) => {
  const { invitation, isLoggedIn, userEmail } = loaderData;
  const fetcher = useFetcher<ActionData>();

  const errors = fetcher.data?.errors ?? (actionData as ActionData)?.errors;
  const isSubmitting = fetcher.state === 'submitting';
  const submittingIntent = fetcher.formData?.get('intent');

  const orgName = invitation.organization?.name || 'the organization';
  const inviterName = invitation.inviter?.user?.name || 'A team member';
  const role = roleLabels[invitation.role || 'member'] || invitation.role;

  // For logged-in users, show accept invitation UI
  if (isLoggedIn) {
    return (
      <div className="bg-muted flex min-h-svh flex-col items-center justify-center p-6 md:p-10">
        <div className="w-full max-w-md flex flex-col gap-6">
          {/* Organization context */}
          <Item variant="outline" className="bg-card">
            <ItemMedia variant="icon" className="bg-primary/10 border-primary/20">
              {invitation.organization?.logo ? (
                <img
                  src={invitation.organization.logo}
                  alt={orgName}
                  className="size-full object-cover"
                />
              ) : (
                <span className="text-primary text-lg font-semibold">
                  {orgName.charAt(0).toUpperCase()}
                </span>
              )}
            </ItemMedia>
            <ItemContent>
              <ItemTitle>Join {orgName}</ItemTitle>
              <ItemDescription>
                {inviterName} invited you as {role}
              </ItemDescription>
            </ItemContent>
          </Item>

          <Card className="overflow-hidden">
            <CardContent className="p-6 space-y-4">
              {errors?.form && (
                <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-3">
                  <p className="text-destructive text-sm">{errors.form[0]}</p>
                </div>
              )}

              <div className="bg-muted rounded-lg p-4 text-sm">
                <p className="text-muted-foreground">
                  Signed in as{' '}
                  <span className="font-medium text-foreground">{userEmail}</span>
                </p>
              </div>

              {userEmail !== invitation.email && (
                <div className="bg-amber-50 dark:bg-amber-950/20 rounded-lg p-4 text-sm border border-amber-200 dark:border-amber-800">
                  <p className="text-amber-800 dark:text-amber-200">
                    This invitation was sent to{' '}
                    <span className="font-medium">{invitation.email}</span>. You
                    are signed in with a different email address.
                  </p>
                </div>
              )}

              <fetcher.Form method="post">
                <input type="hidden" name="intent" value="accept" />
                <Button
                  type="submit"
                  className="w-full gap-2"
                  disabled={isSubmitting}
                >
                  {isSubmitting && submittingIntent === 'accept' ? (
                    <span className="size-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <IconCheck className="size-4" />
                  )}
                  Accept Invitation
                </Button>
              </fetcher.Form>

              <FieldDescription className="text-center">
                <NavLink to="/logout" className="underline">
                  Sign out
                </NavLink>{' '}
                to create a new account instead
              </FieldDescription>
            </CardContent>
          </Card>

          <FieldDescription className="px-6 text-center">
            This invitation expires on{' '}
            {new Date(invitation.expiresAt).toLocaleDateString('en-GB', {
              dateStyle: 'long',
            })}
          </FieldDescription>
        </div>
      </div>
    );
  }

  // For new users, show the sign-up form with invitation context
  return (
    <div className="bg-muted flex min-h-svh flex-col items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm md:max-w-4xl">
        <SignUpForm
          fetcher={fetcher}
          invitation={{
            id: invitation.id,
            email: invitation.email,
            organization: {
              name: orgName,
              logo: invitation.organization?.logo,
            },
            inviter: {
              name: inviterName,
            },
            role,
          }}
        />
      </div>
    </div>
  );
};

export default InvitePage;
