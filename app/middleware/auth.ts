import type { RouterContextProvider } from 'react-router';
import { redirect } from 'react-router';
import { authContext, sessionContext, userContext } from '~/context';
import { getAuth } from '~/lib/auth.server';

const publicRoutes = [
  '/login',
  '/sign-up',
  '/logout',
  '/api/auth',
  '/api/prompts/get',
  '/auth/social',
  '/invite',
  '/team/accept-invitation',
];

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
  // Create auth instance ONCE and cache in context
  const auth = getAuth(context);
  context.set(authContext, auth);

  // Fetch session ONCE and cache in context
  const session = await auth.api.getSession({ headers: request.headers });
  context.set(sessionContext, session);

  const url = new URL(request.url);

  if (isPublicRoute(url.pathname)) {
    return;
  }

  if (!session?.user) {
    throw redirect('/login');
  }

  context.set(userContext, session.user);
};
