import { redirect } from 'react-router';
import { getAuth } from '~/lib/auth.server';
import { forwardAuthCookies } from '~/lib/auth-cookies.server';
import { isValidRedirectPath } from '~/lib/redirect';
import type { Route } from './+types/social';

// GET requests to this route should redirect to login
export const loader = () => redirect('/login');

export const action = async ({ request, context }: Route.ActionArgs) => {
  const formData = await request.formData();
  const provider = formData.get('provider');

  if (
    typeof provider !== 'string' ||
    !['apple', 'google', 'github'].includes(provider)
  ) {
    throw new Response('Unsupported sign-in provider', { status: 400 });
  }

  const auth = getAuth(context);
  const redirectTo = formData.get('redirectTo');
  const returnQuery =
    typeof redirectTo === 'string' && isValidRedirectPath(redirectTo)
      ? `?redirectTo=${encodeURIComponent(redirectTo)}`
      : '';

  const response = await auth.api.signInSocial({
    body: {
      provider,
      callbackURL: `/auth/oauth-complete${returnQuery}`,
      errorCallbackURL: `/login${returnQuery}`,
    },
    headers: request.headers,
    asResponse: true,
  });

  const data = (await response.json()) as { url?: string };

  if (!data.url) {
    throw new Response('Failed to get OAuth URL', { status: 500 });
  }

  return redirect(data.url, {
    headers: forwardAuthCookies(response),
  });
};
