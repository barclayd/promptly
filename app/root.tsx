import type { ShouldRevalidateFunctionArgs } from 'react-router';
import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useLoaderData,
} from 'react-router';
import {
  PreventFlashOnWrongTheme,
  ThemeProvider,
  useTheme,
} from 'remix-themes';
import { OnboardingProvider } from '~/components/onboarding/onboarding-provider';
import { Toaster } from '~/components/ui/sonner';
import { orgContext, sessionContext } from '~/context';
import { RecentsProvider } from '~/context/recents-context';
import { SearchProvider } from '~/context/search-context';
import { parseCookie } from '~/lib/cookies';
import { getEnabledModelsForOrg } from '~/lib/llm-api-keys.server';
import {
  getMemberRole,
  getResourceCounts,
  getSubscriptionStatus,
} from '~/lib/subscription.server';
import { authMiddleware } from '~/middleware/auth';
import { orgMiddleware } from '~/middleware/org';
import { themeSessionResolver } from '~/sessions.server';

import type { Route } from './+types/root';
import './app.css';

export const middleware: Route.MiddlewareFunction[] = [
  authMiddleware,
  orgMiddleware,
];

const LAYOUT_COOKIE_NAME = 'panel-layout';

export const loader = async ({ request, context }: Route.LoaderArgs) => {
  const cookieHeader = request.headers.get('Cookie') || '';
  const layoutCookie = parseCookie(cookieHeader, LAYOUT_COOKIE_NAME);

  // Use cached session from authMiddleware (already fetched once)
  const session = context.get(sessionContext);

  // Get theme from cookie session
  const { getTheme } = await themeSessionResolver(request);

  // Fetch subscription status and member role for the active org
  // (orgContext may not be set on public routes)
  let subscription = null;
  let memberRole = null;
  let resourceCounts = null;
  let enabledModels: string[] = [];
  let organizationId: string | null = null;
  try {
    const org = context.get(orgContext);
    organizationId = org.organizationId;
    const db = context.cloudflare.env.promptly;
    const userId = session?.user?.id;

    const results = await Promise.all([
      getSubscriptionStatus(db, organizationId),
      userId ? getMemberRole(db, userId, organizationId) : null,
      getResourceCounts(db, organizationId),
      getEnabledModelsForOrg(db, organizationId),
    ]);

    subscription = results[0];
    memberRole = results[1];
    resourceCounts = results[2];
    enabledModels = results[3];
  } catch {
    // No org context (public route or unauthenticated) — defaults stay null
  }

  return {
    serverLayoutCookie: layoutCookie ?? null,
    user: session?.user ?? null,
    theme: getTheme(),
    subscription,
    memberRole,
    resourceCounts,
    enabledModels,
    organizationId,
  };
};

export const shouldRevalidate = ({
  formAction,
  defaultShouldRevalidate,
}: ShouldRevalidateFunctionArgs): boolean => {
  // No form action = normal navigation → use default (revalidate)
  // This ensures lazy trial expiration runs on page transitions
  if (!formAction) return defaultShouldRevalidate;

  // Only revalidate after actions that could change subscription/role/resource data
  if (
    formAction.includes('/subscription/') ||
    formAction.includes('/api/auth/') ||
    formAction.includes('/team/') ||
    formAction.includes('/api/prompts/') ||
    formAction.includes('/api/settings/')
  ) {
    return true;
  }

  // Skip revalidation for all other actions (prompt saves, tests, etc.)
  return false;
};

const CDN = 'https://images.keepfre.sh/app/icons/promptly/';

export const links: Route.LinksFunction = () => [
  {
    rel: 'icon',
    href: `${CDN}favicon.ico`,
    sizes: '32x32',
    media: '(prefers-color-scheme: dark)',
  },
  {
    rel: 'apple-touch-icon',
    href: `${CDN}apple-touch-icon.png`,
    sizes: '180x180',
  },
  { rel: 'manifest', href: `${CDN}site.webmanifest` },
  { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
  {
    rel: 'preconnect',
    href: 'https://fonts.gstatic.com',
    crossOrigin: 'anonymous',
  },
  {
    rel: 'stylesheet',
    href: 'https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&display=swap',
  },
];

const AppWithTheme = ({ children }: { children: React.ReactNode }) => {
  const data = useLoaderData<typeof loader>();
  const [theme] = useTheme();

  return (
    <html lang="en" className={theme ?? ''} suppressHydrationWarning>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <PreventFlashOnWrongTheme ssrTheme={Boolean(data?.theme)} />
        <Meta />
        <Links />
      </head>
      <body>
        <RecentsProvider>
          <SearchProvider>
            <OnboardingProvider>{children}</OnboardingProvider>
          </SearchProvider>
        </RecentsProvider>
        <Toaster />
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
};

export const Layout = ({ children }: { children: React.ReactNode }) => {
  const data = useLoaderData<typeof loader>();

  return (
    <ThemeProvider
      specifiedTheme={data?.theme ?? null}
      themeAction="/api/set-theme"
    >
      <AppWithTheme>{children}</AppWithTheme>
    </ThemeProvider>
  );
};

const App = () => {
  return <Outlet />;
};

export default App;

export const ErrorBoundary = ({ error }: Route.ErrorBoundaryProps) => {
  let message = 'Oops!';
  let details = 'An unexpected error occurred.';
  let stack: string | undefined;

  if (isRouteErrorResponse(error)) {
    message = error.status === 404 ? '404' : 'Error';
    details =
      error.status === 404
        ? 'The requested page could not be found.'
        : error.statusText || details;
  } else if (import.meta.env.DEV && error && error instanceof Error) {
    details = error.message;
    stack = error.stack;
  }

  return (
    <main className="pt-16 p-4 container mx-auto">
      <h1>{message}</h1>
      <p>{details}</p>
      {stack && (
        <pre className="w-full p-4 overflow-x-auto">
          <code>{stack}</code>
        </pre>
      )}
    </main>
  );
};
