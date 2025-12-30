import { redirect } from 'react-router';
import { getAuth } from '~/lib/auth.server';
import type { Route } from './+types/logout';

export const action = async ({ request, context }: Route.ActionArgs) => {
  const auth = getAuth(context);

  const response = await auth.api.signOut({
    headers: request.headers,
    asResponse: true,
  });

  const setCookie = response.headers.get('set-cookie');

  return redirect('/login', {
    headers: setCookie ? { 'Set-Cookie': setCookie } : {},
  });
};
