import { Outlet } from 'react-router';
import { SidebarLeft } from '~/components/sidebar-left';
import { SiteHeader } from '~/components/site-header';
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
        <SiteHeader />
        <Outlet />
      </SidebarInset>
    </SidebarProvider>
  );
}
