import { redirect } from 'react-router';
import type { RouterContextProvider } from 'react-router';
import { userContext } from '~/context';
import { getAuth } from '~/lib/auth.server';

const publicRoutes = ['/login', '/sign-up', '/logout', '/api/auth', '/auth/social'];

const isPublicRoute = (pathname: string) =>
  publicRoutes.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );

export const authMiddleware = async ({
  request,
  context,
}: {
  request: Request;
  context: RouterContextProvider;
}) => {
  const url = new URL(request.url);

  if (isPublicRoute(url.pathname)) {
    return;
  }

  const auth = getAuth(context);
  const session = await auth.api.getSession({ headers: request.headers });

  if (!session?.user) {
    throw redirect('/login');
  }

  context.set(userContext, session.user);
};
