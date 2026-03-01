import { useEffect } from 'react';
import { Outlet } from 'react-router';
import {
  OnboardingProvider,
  useStartOnboarding,
} from '~/components/onboarding/onboarding-provider';
import { SidebarLeft } from '~/components/sidebar-left';
import { SiteHeader } from '~/components/site-header';
import { SidebarInset, SidebarProvider } from '~/components/ui/sidebar';
import { RecentsProvider } from '~/context/recents-context';
import { SearchProvider } from '~/context/search-context';
import { useInterstitials } from '~/hooks/use-interstitials';
import { useOnboardingTour } from '~/hooks/use-onboarding-tour';

/**
 * Inner layout that consumes context from the providers above.
 * useStartOnboarding requires NextStepProvider (from OnboardingProvider),
 * so it must be rendered as a child of OnboardingProvider.
 */
const AppLayoutInner = () => {
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
};

export default function AppLayout() {
  return (
    <RecentsProvider>
      <SearchProvider>
        <OnboardingProvider>
          <AppLayoutInner />
        </OnboardingProvider>
      </SearchProvider>
    </RecentsProvider>
  );
}
