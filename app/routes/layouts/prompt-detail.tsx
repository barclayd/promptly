import { useMemo } from 'react';
import { Outlet, useRouteLoaderData } from 'react-router';
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
import type { loader as rootLoader } from '~/root';

const LAYOUT_COOKIE_NAME = 'panel-layout';

const createCookieStorage = (serverCookie: string | null): LayoutStorage => ({
  getItem: (key: string) => {
    if (typeof document === 'undefined') {
      return serverCookie;
    }

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

export default function PromptDetailLayout() {
  const loaderData = useRouteLoaderData<typeof rootLoader>('root');
  const isMobile = useIsMobile();

  const cookieStorage = useMemo(
    () => createCookieStorage(loaderData?.serverLayoutCookie ?? null),
    [loaderData?.serverLayoutCookie],
  );

  const { defaultLayout, onLayoutChange } = useDefaultLayout({
    id: LAYOUT_COOKIE_NAME,
    storage: cookieStorage,
  });

  return (
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
            <Outlet />
          </SidebarInset>
          <div className="w-full shrink-0">
            <SidebarRight />
          </div>
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
              <Outlet />
            </SidebarInset>
          </ResizablePanel>
          <ResizableHandle withHandle />
          <ResizablePanel
            id="sidebar-right"
            defaultSize="25%"
            minSize="25%"
            className="h-full"
          >
            <SidebarRight />
          </ResizablePanel>
        </ResizablePanelGroup>
      )}
    </SidebarProvider>
  );
}
