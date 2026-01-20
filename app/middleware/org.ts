import { redirect } from 'react-router';
import type { RouterContextProvider } from 'react-router';
import { orgContext } from '~/context';
import { getAuth } from '~/lib/auth.server';
import { getActiveOrganization } from '~/lib/org.server';

const publicRoutes = [
  '/login',
  '/sign-up',
  '/logout',
  '/api/auth',
  '/auth/social',
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

  const org = await getActiveOrganization(context, request.headers);

  if (org) {
    context.set(orgContext, {
      organizationId: org.id,
      organizationName: org.name,
      organizationSlug: org.slug,
    });
    return;
  }

  // No active org - check if user is authenticated
  const auth = getAuth(context);
  const session = await auth.api.getSession({
    headers: request.headers,
  });

  if (session?.user) {
    // Authenticated but no org - redirect to onboarding
    throw redirect('/onboarding/setup-workspace');
  }

  // Not authenticated - let the route handle it (will likely redirect to login)
};
