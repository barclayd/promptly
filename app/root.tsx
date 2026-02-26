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

  // Fetch all root loader data for the active org in a single D1 batch.
  // (orgContext may not be set on public routes)
  let subscription = null;
  let memberRole = null;
  let resourceCounts = null;
  let enabledModels: string[] = [];
  let organizationId: string | null = null;
  const userState: Record<string, string> = {};
  try {
    const org = context.get(orgContext);
    organizationId = org.organizationId;
    const db = context.cloudflare.env.promptly;
    const userId = session?.user?.id;

    const now = new Date();
    const period = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;

    // Single D1 batch: all queries in one round-trip
    const statements = [
      db
        .prepare(
          'SELECT id, plan, status, trial_end, period_end, cancel_at_period_end FROM subscription WHERE organization_id = ? LIMIT 1',
        )
        .bind(organizationId),
      db
        .prepare(
          'SELECT role FROM member WHERE user_id = ? AND organization_id = ? LIMIT 1',
        )
        .bind(userId ?? '', organizationId),
      db
        .prepare(
          'SELECT COUNT(*) as count FROM prompt WHERE organization_id = ? AND deleted_at IS NULL',
        )
        .bind(organizationId),
      db
        .prepare(
          'SELECT COUNT(*) as count FROM member WHERE organization_id = ?',
        )
        .bind(organizationId),
      db
        .prepare(
          'SELECT count FROM api_usage WHERE organization_id = ? AND period = ?',
        )
        .bind(organizationId, period),
      db
        .prepare(
          'SELECT enabled_models FROM llm_api_key WHERE organization_id = ?',
        )
        .bind(organizationId),
      db
        .prepare('SELECT key, value FROM user_state WHERE user_id = ?')
        .bind(userId ?? ''),
    ];

    const batchResults = await db.batch(statements);

    // Process subscription
    const PLAN_LIMITS = {
      free: { prompts: 3, teamMembers: 1, apiCalls: 5000 },
      pro: { prompts: -1, teamMembers: 5, apiCalls: 50000 },
      enterprise: { prompts: -1, teamMembers: -1, apiCalls: -1 },
    } as const;
    const FREE_STATUS = {
      plan: 'free' as const,
      status: 'expired' as const,
      isTrial: false,
      hadTrial: false,
      daysLeft: null,
      limits: PLAN_LIMITS.free,
      cancelAtPeriodEnd: false,
      periodEnd: null,
    };

    const subRow = batchResults[0].results[0] as
      | {
          id: string;
          plan: string;
          status: string;
          trial_end: number | null;
          period_end: number | null;
          cancel_at_period_end: number;
        }
      | undefined;

    if (!subRow) {
      subscription = FREE_STATUS;
    } else {
      const nowMs = Date.now();
      // Lazy trial expiration
      if (
        subRow.status === 'trialing' &&
        subRow.trial_end &&
        subRow.trial_end < nowMs
      ) {
        await db
          .prepare(
            'UPDATE subscription SET status = ?, plan = ?, updated_at = ? WHERE id = ?',
          )
          .bind('expired', 'free', nowMs, subRow.id)
          .run();
        subscription = { ...FREE_STATUS, hadTrial: true };
      } else {
        const isTrial = subRow.status === 'trialing';
        const daysLeft =
          isTrial && subRow.trial_end
            ? Math.max(
                0,
                Math.ceil((subRow.trial_end - nowMs) / (1000 * 60 * 60 * 24)),
              )
            : null;
        const limits =
          subRow.plan in PLAN_LIMITS
            ? PLAN_LIMITS[subRow.plan as keyof typeof PLAN_LIMITS]
            : PLAN_LIMITS.free;
        subscription = {
          plan: subRow.plan,
          status: subRow.status,
          isTrial,
          hadTrial: true,
          daysLeft,
          limits,
          cancelAtPeriodEnd: subRow.cancel_at_period_end === 1,
          periodEnd: subRow.period_end ?? null,
        };
      }
    }

    // Process member role
    const roleRow = batchResults[1].results[0] as { role: string } | undefined;
    memberRole =
      userId && roleRow ? (roleRow.role as 'owner' | 'admin' | 'member') : null;

    // Process resource counts
    const promptCount =
      (batchResults[2].results[0] as { count: number } | undefined)?.count ?? 0;
    const memberCount =
      (batchResults[3].results[0] as { count: number } | undefined)?.count ?? 0;
    const apiCallCount =
      (batchResults[4].results[0] as { count: number } | undefined)?.count ?? 0;
    resourceCounts = { promptCount, memberCount, apiCallCount };

    // Process enabled models
    const modelRows = batchResults[5].results as
      | { enabled_models: string }[]
      | undefined;
    if (modelRows) {
      const modelSet = new Set<string>();
      for (const row of modelRows) {
        const models = JSON.parse(row.enabled_models) as string[];
        for (const model of models) {
          modelSet.add(model);
        }
      }
      enabledModels = [...modelSet];
    }

    // Process user state
    const userStateRows = batchResults[6].results as
      | { key: string; value: string }[]
      | undefined;
    if (userStateRows) {
      for (const row of userStateRows) {
        userState[row.key] = row.value;
      }
    }
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
    userState,
  };
};

export const shouldRevalidate = ({
  formAction,
  currentUrl,
  nextUrl,
  defaultShouldRevalidate,
}: ShouldRevalidateFunctionArgs): boolean => {
  // Form actions: only revalidate for mutations that change root loader data
  if (formAction) {
    return (
      formAction.includes('/subscription/') ||
      formAction.includes('/api/auth/') ||
      formAction.includes('/team/') ||
      formAction.includes('/api/prompts/create') ||
      formAction.includes('/api/prompts/delete') ||
      formAction.includes('/api/snippets/create') ||
      formAction.includes('/api/snippets/delete') ||
      formAction.includes('/api/composers/create') ||
      formAction.includes('/api/composers/delete') ||
      formAction.includes('/api/settings/') ||
      formAction.includes('/api/user-state')
    );
  }

  // Navigation: skip revalidation when staying in the same top-level section.
  // Root loader data (subscription, role, resource counts, models) rarely changes
  // within a section. Cross-section navigations still revalidate for lazy trial expiry.
  const currentSection = currentUrl.pathname.split('/')[1];
  const nextSection = nextUrl.pathname.split('/')[1];
  if (currentSection === nextSection) return false;

  return defaultShouldRevalidate;
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
