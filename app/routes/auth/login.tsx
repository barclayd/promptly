import { data, redirect, useFetcher, useSearchParams } from 'react-router';
import { z } from 'zod';
import { LoginForm } from '~/components/login-form';
import { sessionContext } from '~/context';
import { getAuth } from '~/lib/auth.server';
import {
  forwardAuthCookies,
  toRequestCookieHeader,
} from '~/lib/auth-cookies.server';
import { getRedirectTarget } from '~/lib/redirect';
import { loginSchema } from '~/lib/validations/auth';
import type { Route } from './+types/login';

// biome-ignore lint/correctness/noEmptyPattern: react router default
export const meta = ({}: Route.MetaArgs) => [
  { title: 'Promptly' },
  {
    name: 'description',
    content: 'Login | The CMS for building AI at scale',
  },
];

export const loader = async ({ request, context }: Route.LoaderArgs) => {
  const session = context.get(sessionContext);
  if (session?.user) {
    const url = new URL(request.url);
    const target = getRedirectTarget(url.searchParams.get('redirectTo'));
    return redirect(target);
  }
  return null;
};

export const action = async ({ request, context }: Route.ActionArgs) => {
  const formData = await request.formData();
  const redirectTo = formData.get('redirectTo');
  const target = getRedirectTarget(redirectTo);
  const rawData = {
    email: formData.get('email'),
    password: formData.get('password'),
  };

  const result = loginSchema.safeParse(rawData);

  if (!result.success) {
    return data(
      { errors: z.flattenError(result.error).fieldErrors },
      { status: 400 },
    );
  }

  const auth = getAuth(context);

  try {
    const response = await auth.api.signInEmail({
      body: {
        email: result.data.email,
        password: result.data.password,
      },
      asResponse: true,
    });

    const cookieHeader = toRequestCookieHeader(response);

    if (cookieHeader) {
      const orgsResponse = await auth.api.listOrganizations({
        headers: { Cookie: cookieHeader },
      });

      if (orgsResponse && orgsResponse.length > 0) {
        await auth.api.setActiveOrganization({
          body: { organizationId: orgsResponse[0].id },
          headers: { Cookie: cookieHeader },
        });
      }
    }

    return redirect(target, {
      headers: forwardAuthCookies(response),
    });
  } catch (error) {
    console.error('Login error:', error);

    const message =
      error instanceof Error ? error.message : 'Invalid email or password';
    return data({ errors: { email: [message] } }, { status: 400 });
  }
};

export default function Login() {
  const fetcher = useFetcher();
  const [searchParams] = useSearchParams();
  const redirectTo = searchParams.get('redirectTo');

  return (
    <div className="bg-muted flex min-h-svh flex-col items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm md:max-w-4xl">
        <LoginForm fetcher={fetcher} redirectTo={redirectTo} />
      </div>
    </div>
  );
}
