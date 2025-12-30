import { redirect } from 'react-router';
import { getAuth } from '~/lib/auth.server';
import type { Route } from './+types/_app.logout';

const performLogout = async (
  request: Request,
  context: Route.LoaderArgs['context'],
) => {
  const auth = getAuth(context);

  const response = await auth.api.signOut({
    headers: request.headers,
    asResponse: true,
  });

  const headers = new Headers();

  const setCookie = response.headers.get('set-cookie');

  if (setCookie) {
    headers.append('Set-Cookie', setCookie);
  }

  headers.append(
    'Set-Cookie',
    'better-auth.state=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT',
  );

  return redirect('/login', { headers });
};

export const loader = async ({ request, context }: Route.LoaderArgs) =>
  performLogout(request, context);

export const action = async ({ request, context }: Route.ActionArgs) =>
  performLogout(request, context);
