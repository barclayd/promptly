import { useEffect, useState } from 'react';
import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useMatch,
} from 'react-router';
import { SidebarLeft } from '~/components/sidebar-left';
import { SidebarRight } from '~/components/sidebar-right';
import { SiteHeader } from '~/components/site-header';
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '~/components/ui/resizable';
import { SidebarInset, SidebarProvider } from '~/components/ui/sidebar';

import type { Route } from './+types/root';
import './app.css';

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

export function Layout({ children }: { children: React.ReactNode }) {
  const promptMatch = useMatch('/prompts/:id/:id');
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  const showSidebarRight =
    promptMatch !== null && /^\d+$/.test(promptMatch.params.id || '');

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
          {isHydrated ? (
            <ResizablePanelGroup direction="horizontal" className="flex-1">
              <ResizablePanel id="main-content" defaultSize="75%">
                <SidebarInset>
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
                  >
                    <SidebarRight />
                  </ResizablePanel>
                </>
              )}
            </ResizablePanelGroup>
          ) : (
            <div className="flex flex-1">
              <div style={{ flex: showSidebarRight ? '3 1 0%' : '1 1 0%' }}>
                <SidebarInset>
                  <SiteHeader />
                  {children}
                </SidebarInset>
              </div>
              {showSidebarRight && (
                <>
                  <div className="w-px bg-sidebar-border" />
                  <div style={{ flex: '1 1 0%' }}>
                    <SidebarRight />
                  </div>
                </>
              )}
            </div>
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
