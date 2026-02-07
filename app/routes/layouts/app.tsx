import { Outlet } from 'react-router';
import { SidebarLeft } from '~/components/sidebar-left';
import { SiteHeader } from '~/components/site-header';
import { TrialBanner } from '~/components/trial-banner';
import { SidebarInset, SidebarProvider } from '~/components/ui/sidebar';

export default function AppLayout() {
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
      <SidebarInset className="min-h-svh">
        <div className="sticky top-0 z-50">
          <TrialBanner />
          <SiteHeader />
        </div>
        <Outlet />
      </SidebarInset>
    </SidebarProvider>
  );
}
