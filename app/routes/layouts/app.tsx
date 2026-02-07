import { useEffect, useState } from 'react';
import { Outlet } from 'react-router';
import { MidTrialNudgeDrawer } from '~/components/mid-trial-nudge-drawer';
import { SidebarLeft } from '~/components/sidebar-left';
import { SiteHeader } from '~/components/site-header';
import { TrialBanner } from '~/components/trial-banner';
import { SidebarInset, SidebarProvider } from '~/components/ui/sidebar';
import { useMidTrialNudge } from '~/hooks/use-mid-trial-nudge';

export default function AppLayout() {
  const { visible, daysLeft, promptCount } = useMidTrialNudge();
  const [nudgeOpen, setNudgeOpen] = useState(false);

  useEffect(() => {
    if (!visible) return;
    const timer = setTimeout(() => setNudgeOpen(true), 2000);
    return () => clearTimeout(timer);
  }, [visible]);

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
      {visible && daysLeft !== null && (
        <MidTrialNudgeDrawer
          open={nudgeOpen}
          onOpenChange={setNudgeOpen}
          daysLeft={daysLeft}
          promptCount={promptCount}
        />
      )}
    </SidebarProvider>
  );
}
