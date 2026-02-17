import { useEffect } from 'react';
import { Outlet } from 'react-router';
import { useStartOnboarding } from '~/components/onboarding/onboarding-provider';
import { SidebarLeft } from '~/components/sidebar-left';
import { SiteHeader } from '~/components/site-header';
import { SidebarInset, SidebarProvider } from '~/components/ui/sidebar';
import { useInterstitials } from '~/hooks/use-interstitials';
import { useOnboardingTour } from '~/hooks/use-onboarding-tour';

export default function AppLayout() {
  const { banners, overlay, overlayOpen, setOverlayOpen } = useInterstitials();

  // Onboarding tour (separate — it's a tour, not an interstitial)
  const { visible: onboardingVisible, firstName: onboardingFirstName } =
    useOnboardingTour();
  const { start: startOnboarding } = useStartOnboarding();

  useEffect(() => {
    if (!onboardingVisible) return;
    const timer = setTimeout(() => {
      startOnboarding(onboardingFirstName);
    }, 1500);
    return () => clearTimeout(timer);
  }, [onboardingVisible, onboardingFirstName, startOnboarding]);

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
          {banners.map((b) => (
            <b.component key={b.id} {...b.props} />
          ))}
          <SiteHeader />
        </div>
        <Outlet />
      </SidebarInset>
      {overlay && (
        <overlay.component
          open={overlayOpen}
          onOpenChange={setOverlayOpen}
          {...overlay.props}
        />
      )}
    </SidebarProvider>
  );
}
