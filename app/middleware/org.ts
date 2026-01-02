import type { RouterContextProvider } from 'react-router';
import { orgContext } from '~/context';
import { getActiveOrganization } from '~/lib/org.server';

const publicRoutes = [
  '/login',
  '/sign-up',
  '/logout',
  '/api/auth',
  '/auth/social',
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
  }
};
