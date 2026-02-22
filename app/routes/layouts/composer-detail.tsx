import { useMemo, useRef } from 'react';
import { Outlet, useParams, useRouteLoaderData } from 'react-router';
import {
  ComposerSidebarRight,
  type ComposerSidebarRightHandle,
} from '~/components/composer-sidebar-right';
import { SidebarAutoHide } from '~/components/sidebar-auto-hide';
import { SidebarLeft } from '~/components/sidebar-left';
import { SiteHeader } from '~/components/site-header';
import { TrialBanner } from '~/components/trial-banner';
import {
  type LayoutStorage,
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
  useDefaultLayout,
} from '~/components/ui/resizable';
import { SidebarInset, SidebarProvider } from '~/components/ui/sidebar';
import type { Version } from '~/components/versions-table';
import { useIsMobile } from '~/hooks/use-mobile';
import type { loader as rootLoader } from '~/root';

type ComposerDetailLoaderData = {
  versions: Version[];
  isViewingOldVersion?: boolean;
};

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
      // biome-ignore lint/suspicious/noDocumentCookie: Cookie Store API has limited browser support
      document.cookie = `${key}=${value}; path=/; max-age=31536000`;
    }
  },
});

export default function ComposerDetailLayout() {
  const loaderData = useRouteLoaderData<typeof rootLoader>('root');
  const composerDetailData =
    useRouteLoaderData<ComposerDetailLoaderData>('composer-detail');
  const params = useParams();
  const isMobile = useIsMobile();

  const versions = composerDetailData?.versions ?? [];
  const isViewingOldVersion = composerDetailData?.isViewingOldVersion ?? false;
  const isReadonly = isViewingOldVersion;

  const sidebarRightRef = useRef<ComposerSidebarRightHandle>(null);

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
      <SidebarAutoHide />
      <SidebarLeft variant="inset" />
      {isMobile ? (
        <div className="flex flex-1 flex-col min-h-svh overflow-x-hidden">
          <SidebarInset className="flex-1">
            <div className="sticky top-0 z-50">
              <TrialBanner />
              <SiteHeader />
            </div>
            <Outlet
              key={params.composerId}
              context={{
                triggerTest: () => sidebarRightRef.current?.triggerTest(),
              }}
            />
          </SidebarInset>
          <div className="w-full shrink-0">
            <ComposerSidebarRight
              ref={sidebarRightRef}
              versions={versions}
              isReadonly={isReadonly}
            />
          </div>
        </div>
      ) : (
        <ResizablePanelGroup
          orientation="horizontal"
          className="flex-1 min-h-svh max-h-svh overflow-hidden"
          defaultLayout={defaultLayout}
          onLayoutChange={onLayoutChange}
        >
          <ResizablePanel
            id="main-content"
            defaultSize="75%"
            minSize="50%"
            className="h-full overflow-hidden"
          >
            <SidebarInset className="h-full flex flex-col">
              <TrialBanner />
              <SiteHeader />
              <div className="flex-1 overflow-y-auto">
                <Outlet
                  key={params.composerId}
                  context={{
                    triggerTest: () => sidebarRightRef.current?.triggerTest(),
                  }}
                />
              </div>
            </SidebarInset>
          </ResizablePanel>
          <ResizableHandle withHandle />
          <ResizablePanel
            id="sidebar-right"
            defaultSize="25%"
            minSize="25%"
            className="h-full flex flex-col overflow-hidden"
          >
            <ComposerSidebarRight
              ref={sidebarRightRef}
              versions={versions}
              isReadonly={isReadonly}
            />
          </ResizablePanel>
        </ResizablePanelGroup>
      )}
    </SidebarProvider>
  );
}
