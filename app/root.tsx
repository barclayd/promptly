import { useMemo } from 'react';
import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useLocation,
  useMatch,
  useRouteLoaderData,
} from 'react-router';
import { SidebarLeft } from '~/components/sidebar-left';
import { SidebarRight } from '~/components/sidebar-right';
import { SiteHeader } from '~/components/site-header';
import {
  type LayoutStorage,
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
  useDefaultLayout,
} from '~/components/ui/resizable';
import { SidebarInset, SidebarProvider } from '~/components/ui/sidebar';
import { useIsMobile } from '~/hooks/use-mobile';
import { parseCookie } from '~/lib/cookies';

import type { Route } from './+types/root';
import './app.css';

const LAYOUT_COOKIE_NAME = 'panel-layout';

export const loader = ({ request }: Route.LoaderArgs) => {
  const cookieHeader = request.headers.get('Cookie') || '';
  const layoutCookie = parseCookie(cookieHeader, LAYOUT_COOKIE_NAME);
  return {
    serverLayoutCookie: layoutCookie ?? null,
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

const createCookieStorage = (serverCookie: string | null): LayoutStorage => ({
  getItem: (key: string) => {
    if (typeof document === 'undefined') {
      // Server-side: return the cookie value from loader
      return serverCookie;
    }
    // Client-side: read from document.cookie
    const cookies = document.cookie.split(';');
    for (const cookie of cookies) {
      const [name, value] = cookie.trim().split('=');
      if (name === key) {
        return value;
      }
    }
    return null;
  },
  setItem: (key: string, value: string) => {
    if (typeof document !== 'undefined') {
      document.cookie = `${key}=${value}; path=/; max-age=31536000`;
    }
  },
});

export function Layout({ children }: { children: React.ReactNode }) {
  const promptMatch = useMatch('/prompts/:id/:id');
  const loaderData = useRouteLoaderData<typeof loader>('root');

  const location = useLocation();

  const showSidebarRight =
    promptMatch !== null && /^\d+$/.test(promptMatch.params.id || '');

  const isMobile = useIsMobile();

  const cookieStorage = useMemo(
    () => createCookieStorage(loaderData?.serverLayoutCookie ?? null),
    [loaderData?.serverLayoutCookie],
  );

  const { defaultLayout, onLayoutChange } = useDefaultLayout({
    id: LAYOUT_COOKIE_NAME,
    storage: cookieStorage,
  });

  if (location.pathname === '/login') {
    return (
      <html lang="en">
        <head title="Promptly">
          <meta charSet="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <Meta />
          <Links />
        </head>
        <body data-dan="hi">
          {children}
          <ScrollRestoration />
          <Scripts />
        </body>
      </html>
    );
  }

  return (
    <html lang="en">
      <head title="Promptly">
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body>
        <SidebarProvider
          style={
            {
              '--sidebar-width': 'calc(var(--spacing) * 72)',
              '--header-height': 'calc(var(--spacing) * 12)',
            } as React.CSSProperties
          }
        >
          <SidebarLeft variant="inset" />
          {isMobile ? (
            <div className="flex flex-1 flex-col min-h-svh">
              <SidebarInset className="flex-1">
                <SiteHeader />
                {children}
              </SidebarInset>
              {showSidebarRight && (
                <div className="w-full shrink-0">
                  <SidebarRight />
                </div>
              )}
            </div>
          ) : (
            <ResizablePanelGroup
              direction="horizontal"
              className="flex-1"
              defaultLayout={defaultLayout}
              onLayoutChange={onLayoutChange}
            >
              <ResizablePanel
                id="main-content"
                defaultSize="75%"
                minSize="50%"
                className="h-full"
              >
                <SidebarInset className="min-h-svh">
                  <SiteHeader />
                  {children}
                </SidebarInset>
              </ResizablePanel>
              {showSidebarRight && (
                <>
                  <ResizableHandle withHandle />
                  <ResizablePanel
                    id="sidebar-right"
                    defaultSize="25%"
                    minSize="25%"
                    className="h-full"
                  >
                    <SidebarRight />
                  </ResizablePanel>
                </>
              )}
            </ResizablePanelGroup>
          )}
        </SidebarProvider>

        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  return <Outlet />;
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
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
}
