import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
} from 'react-router';
import { Toaster } from '~/components/ui/sonner';
import { sessionContext } from '~/context';
import { RecentsProvider } from '~/context/recents-context';
import { SearchProvider } from '~/context/search-context';
import { parseCookie } from '~/lib/cookies';
import { authMiddleware } from '~/middleware/auth';
import { orgMiddleware } from '~/middleware/org';

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

  return {
    serverLayoutCookie: layoutCookie ?? null,
    user: session?.user ?? null,
  };
};

export const links: Route.LinksFunction = () => [
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

export const Layout = ({ children }: { children: React.ReactNode }) => {
  return (
    <html lang="en">
      <head title="Promptly">
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <script
          // biome-ignore lint/security/noDangerouslySetInnerHtml: Theme script prevents flash of unstyled content
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                var stored = localStorage.getItem('theme');
                var prefersDark = window.matchMedia('(prefers-color-scheme: dark)');
                function apply() {
                  var isDark = stored === 'dark' || (stored !== 'light' && prefersDark.matches);
                  document.documentElement.classList.toggle('dark', isDark);
                }
                apply();
                prefersDark.addEventListener('change', function() {
                  if (!stored || stored === 'system') apply();
                });
              })();
            `,
          }}
        />
        <Meta />
        <Links />
      </head>
      <body>
        <RecentsProvider>
          <SearchProvider>{children}</SearchProvider>
        </RecentsProvider>
        <Toaster />
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
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
