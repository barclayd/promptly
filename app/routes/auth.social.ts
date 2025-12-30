import { redirect } from 'react-router';
import { getAuth } from '~/lib/auth.server';
import type { Route } from './+types/auth.social';

export const action = async ({ request, context }: Route.ActionArgs) => {
  const formData = await request.formData();
  const provider = formData.get('provider');

  if (typeof provider !== 'string') {
    throw new Response('Provider is required', { status: 400 });
  }

  const auth = getAuth(context);

  const response = await auth.api.signInSocial({
    body: {
      provider,
    },
    asResponse: true,
  });

  const data = await response.json();

  if (!data.url) {
    throw new Response('Failed to get OAuth URL', { status: 500 });
  }

  const setCookie = response.headers.get('set-cookie');

  return redirect(data.url, {
    headers: setCookie ? { 'Set-Cookie': setCookie } : {},
  });
};
