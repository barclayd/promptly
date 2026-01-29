import type { RouterContextProvider } from 'react-router';
import { redirect } from 'react-router';
import { authContext, orgContext, sessionContext } from '~/context';
import { getActiveOrganizationWithAuth } from '~/lib/org.server';

const publicRoutes = [
  '/login',
  '/sign-up',
  '/logout',
  '/api/auth',
  '/api/prompts/get',
  '/auth/social',
  '/auth/oauth-complete',
  '/onboarding',
  '/invite',
];

const isPublicRoute = (pathname: string) =>
  publicRoutes.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );

export const orgMiddleware = async ({
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

  // Use cached auth instance from authMiddleware
  const auth = context.get(authContext);
  const org = await getActiveOrganizationWithAuth(auth, request.headers);

  if (org) {
    context.set(orgContext, {
      organizationId: org.id,
      organizationName: org.name,
      organizationSlug: org.slug,
    });
    return;
  }

  // Use cached session from authMiddleware
  const session = context.get(sessionContext);

  if (session?.user) {
    // Authenticated but no org - redirect to onboarding
    throw redirect('/onboarding/setup-workspace');
  }

  // Not authenticated - let the route handle it (will likely redirect to login)
};
