import {
  IconBrandGoogle,
  IconCheck,
  IconInnerShadowTop,
  IconLock,
} from '@tabler/icons-react';
import { data, redirect, useFetcher } from 'react-router';
import { NavLink } from 'react-router';
import { z } from 'zod';
import { Button } from '~/components/ui/button';
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldSeparator,
} from '~/components/ui/field';
import { Input } from '~/components/ui/input';
import { getAuth } from '~/lib/auth.server';
import { roleLabels } from '~/lib/validations/team';
import type { Route } from './+types/invite.$id';

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

  if (new Date(invitation.expiresAt) < new Date()) {
    throw new Response('This invitation has expired', { status: 400 });
  }

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

  const invitationResponse = await auth.api.getInvitation({
    query: { id },
    headers: request.headers,
    asResponse: true,
  });

  if (!invitationResponse.ok) {
    return data(
      { errors: { form: ['Invitation not found or expired'] } },
      { status: 404 },
    );
  }

  const invitation = (await invitationResponse.json()) as Invitation;

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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="flex justify-center mb-8">
          <div className="flex items-center gap-2 text-white">
            <IconInnerShadowTop className="size-8" />
            <span className="text-xl font-semibold">Promptly</span>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl shadow-black/20 border border-slate-200/50 overflow-hidden">
          <div className="bg-gradient-to-br from-slate-700 to-slate-900 px-6 py-8 text-center">
            <div className="inline-flex items-center justify-center size-16 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 mb-4 shadow-lg shadow-indigo-500/30">
              <span className="text-2xl font-bold text-white">
                {orgName.charAt(0).toUpperCase()}
              </span>
            </div>
            <h1 className="text-xl font-semibold text-white mb-1">
              Join {orgName}
            </h1>
            <p className="text-slate-300 text-sm">
              {inviterName} invited you to join as {role}
            </p>
          </div>

          <div className="p-6">
            {errors?.form && (
              <div className="mb-4 rounded-lg bg-destructive/10 border border-destructive/20 p-3">
                <p className="text-destructive text-sm">{errors.form[0]}</p>
              </div>
            )}

            {isLoggedIn ? (
              <div className="space-y-4">
                <div className="bg-slate-50 rounded-lg p-4 text-sm">
                  <p className="text-slate-600">
                    Signed in as{' '}
                    <span className="font-medium text-slate-900">{userEmail}</span>
                  </p>
                </div>

                {userEmail !== invitation.email && (
                  <div className="bg-amber-50 rounded-lg p-4 text-sm border border-amber-200">
                    <p className="text-amber-800">
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
              </div>
            ) : (
              <fetcher.Form method="post">
                <FieldGroup>
                  <Field>
                    <FieldLabel htmlFor="name">Full Name</FieldLabel>
                    <Input
                      id="name"
                      name="name"
                      type="text"
                      placeholder="Johnny Appleseed"
                      required
                    />
                    {errors?.name && (
                      <p className="text-destructive text-sm">{errors.name[0]}</p>
                    )}
                  </Field>

                  <Field>
                    <FieldLabel htmlFor="email">Email</FieldLabel>
                    <div className="relative">
                      <Input
                        id="email"
                        name="email"
                        type="email"
                        value={invitation.email}
                        readOnly
                        className="bg-slate-50 text-slate-500 pr-10 cursor-not-allowed"
                      />
                      <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                        <IconLock className="size-4 text-slate-400" />
                      </div>
                    </div>
                    <FieldDescription>
                      Your account will be created with this email address
                    </FieldDescription>
                  </Field>

                  <Field>
                    <div className="grid grid-cols-2 gap-4">
                      <Field>
                        <FieldLabel htmlFor="password">Password</FieldLabel>
                        <Input
                          id="password"
                          name="password"
                          type="password"
                          required
                        />
                        {errors?.password && (
                          <p className="text-destructive text-sm">
                            {errors.password[0]}
                          </p>
                        )}
                      </Field>
                      <Field>
                        <FieldLabel htmlFor="confirmPassword">Confirm</FieldLabel>
                        <Input
                          id="confirmPassword"
                          name="confirmPassword"
                          type="password"
                          required
                        />
                        {errors?.confirmPassword && (
                          <p className="text-destructive text-sm">
                            {errors.confirmPassword[0]}
                          </p>
                        )}
                      </Field>
                    </div>
                    <FieldDescription>
                      Must be at least 8 characters long
                    </FieldDescription>
                  </Field>

                  <Field>
                    <Button
                      type="submit"
                      name="intent"
                      value="signup"
                      className="w-full"
                      disabled={isSubmitting}
                    >
                      {isSubmitting && submittingIntent === 'signup'
                        ? 'Creating Account...'
                        : 'Create Account & Join'}
                    </Button>
                  </Field>

                  <FieldSeparator>or continue with</FieldSeparator>

                  <Field>
                    <Button
                      type="submit"
                      name="intent"
                      value="google"
                      variant="outline"
                      className="w-full gap-2"
                      disabled={isSubmitting}
                    >
                      {isSubmitting && submittingIntent === 'google' ? (
                        <span className="size-4 border-2 border-slate-400/30 border-t-slate-400 rounded-full animate-spin" />
                      ) : (
                        <IconBrandGoogle className="size-4" />
                      )}
                      Continue with Google
                    </Button>
                  </Field>

                  <FieldDescription className="text-center">
                    Already have an account?{' '}
                    <NavLink to={`/login?redirect=/invite/${invitation.id}`} className="underline">
                      Sign in
                    </NavLink>
                  </FieldDescription>
                </FieldGroup>
              </fetcher.Form>
            )}
          </div>

          <div className="px-6 py-4 bg-slate-50 border-t border-slate-100">
            <p className="text-xs text-slate-500 text-center">
              This invitation expires on{' '}
              {new Date(invitation.expiresAt).toLocaleDateString('en-GB', {
                dateStyle: 'long',
              })}
            </p>
          </div>
        </div>

        <p className="text-xs text-slate-400 text-center mt-6">
          By joining, you agree to our{' '}
          <NavLink to="/terms-and-conditions" className="underline hover:text-slate-300">
            Terms of Service
          </NavLink>{' '}
          and{' '}
          <NavLink to="/privacy-policy" className="underline hover:text-slate-300">
            Privacy Policy
          </NavLink>
        </p>
      </div>
    </div>
  );
};

export default InvitePage;
