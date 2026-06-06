import { Outlet, useParams } from 'react-router';
import { SidebarAutoHide } from '~/components/sidebar-auto-hide';
import { SidebarLeft } from '~/components/sidebar-left';
import { SiteHeader } from '~/components/site-header';
import { TrialBanner } from '~/components/trial-banner';
import { SidebarInset, SidebarProvider } from '~/components/ui/sidebar';

export default function PromptCompareLayout() {
  const params = useParams();

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
      <SidebarInset className="min-h-svh max-h-svh flex flex-col overflow-hidden">
        <TrialBanner />
        <SiteHeader promptId={params.promptId} />
        <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
          <Outlet key={params.promptId} />
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
