import { nanoid } from 'nanoid';
import { data, redirect, useFetcher } from 'react-router';
import { z } from 'zod';
import { SignUpForm } from '~/components/sign-up-form';
import { getAuth } from '~/lib/auth.server';
import {
  forwardAuthCookies,
  toRequestCookieHeader,
} from '~/lib/auth-cookies.server';
import { signUpSchema } from '~/lib/validations/auth';
import type { Route } from './+types/sign-up';

// biome-ignore lint/correctness/noEmptyPattern: react router default
export const meta = ({}: Route.MetaArgs) => [
  { title: 'Promptly' },
  {
    name: 'description',
    content: 'Signup | The CMS for building AI at scale',
  },
];

export const action = async ({ request, context }: Route.ActionArgs) => {
  const formData = await request.formData();
  const rawData = {
    name: formData.get('name'),
    email: formData.get('email'),
    password: formData.get('password'),
    confirmPassword: formData.get('confirmPassword'),
  };

  const result = signUpSchema.safeParse(rawData);

  if (!result.success) {
    return data(
      { errors: z.flattenError(result.error).fieldErrors },
      { status: 400 },
    );
  }

  const auth = getAuth(context);

  try {
    const response = await auth.api.signUpEmail({
      body: {
        name: result.data.name,
        email: result.data.email,
        password: result.data.password,
      },
      asResponse: true,
    });

    const cookieHeader = toRequestCookieHeader(response);

    if (cookieHeader) {
      const db = context.cloudflare.env.promptly;
      const now = Date.now();

      // Check for pending invitations matching the user's email
      const pendingInvitations = await db
        .prepare(
          `SELECT id, organization_id FROM invitation
           WHERE LOWER(email) = LOWER(?) AND status = 'pending' AND expires_at > ?`,
        )
        .bind(result.data.email, now)
        .all<{ id: string; organization_id: string }>();

      let joinedOrgId: string | null = null;

      if (pendingInvitations.results?.length) {
        // Auto-accept all pending invitations
        for (const inv of pendingInvitations.results) {
          try {
            await auth.api.acceptInvitation({
              body: { invitationId: inv.id },
              headers: { Cookie: cookieHeader },
            });
            if (!joinedOrgId) {
              joinedOrgId = inv.organization_id;
            }
          } catch (error) {
            console.error(`Failed to auto-accept invitation ${inv.id}:`, error);
          }
        }

        // Set the first successfully accepted org as active
        if (joinedOrgId) {
          await auth.api.setActiveOrganization({
            body: { organizationId: joinedOrgId },
            headers: { Cookie: cookieHeader },
          });
        }
      }

      // If no invitations were accepted, create a default workspace
      if (!joinedOrgId) {
        const org = await auth.api.createOrganization({
          body: {
            name: `${result.data.name}'s Workspace`,
            slug: nanoid(10),
          },
          headers: { Cookie: cookieHeader },
        });

        // Backfill organization_id on the subscription created by the signup hook
        if (org?.id) {
          const session = await auth.api.getSession({
            headers: { Cookie: cookieHeader },
          });
          if (session?.user?.id) {
            await db
              .prepare(
                'UPDATE subscription SET organization_id = ? WHERE user_id = ? AND organization_id IS NULL',
              )
              .bind(org.id, session.user.id)
              .run();
          }
        }
      }
    }

    return redirect('/dashboard', {
      headers: forwardAuthCookies(response),
    });
  } catch (error) {
    console.error('Sign up error:', error);

    const message =
      error instanceof Error ? error.message : 'Registration failed';
    return data({ errors: { email: [message] } }, { status: 400 });
  }
};

export default function SignUp() {
  const fetcher = useFetcher();

  return (
    <div className="bg-muted flex min-h-svh flex-col items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm md:max-w-4xl">
        <SignUpForm fetcher={fetcher} />
      </div>
    </div>
  );
}
