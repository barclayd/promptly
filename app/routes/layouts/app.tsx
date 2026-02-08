import { useEffect, useState } from 'react';
import { Outlet } from 'react-router';
import { CancelledBanner } from '~/components/cancelled-banner';
import { MidTrialNudgeDrawer } from '~/components/mid-trial-nudge-drawer';
import { SidebarLeft } from '~/components/sidebar-left';
import { SiteHeader } from '~/components/site-header';
import { TrialBanner } from '~/components/trial-banner';
import { TrialExpiredBanner } from '~/components/trial-expired-banner';
import { TrialExpiredModal } from '~/components/trial-expired-modal';
import { TrialExpiryModal } from '~/components/trial-expiry-modal';
import { SidebarInset, SidebarProvider } from '~/components/ui/sidebar';
import { UsageThresholdDrawer } from '~/components/usage-threshold-drawer';
import { useCancelledBanner } from '~/hooks/use-cancelled-banner';
import { useMidTrialNudge } from '~/hooks/use-mid-trial-nudge';
import { useTrialExpired } from '~/hooks/use-trial-expired';
import { useTrialExpiryModal } from '~/hooks/use-trial-expiry-modal';
import { useUsageThresholdNudge } from '~/hooks/use-usage-threshold-nudge';

export default function AppLayout() {
  const { visible, daysLeft, promptCount } = useMidTrialNudge();
  const [nudgeOpen, setNudgeOpen] = useState(false);

  const {
    visible: expiryVisible,
    warningLevel,
    daysLeft: expiryDaysLeft,
    expiryDate,
    promptCount: expiryPromptCount,
    memberCount,
  } = useTrialExpiryModal();
  const [expiryModalOpen, setExpiryModalOpen] = useState(false);

  const {
    showModal: expiredModalVisible,
    showBanner: expiredBannerVisible,
    promptCount: expiredPromptCount,
    memberCount: expiredMemberCount,
  } = useTrialExpired();
  const [expiredModalOpen, setExpiredModalOpen] = useState(false);

  const {
    visible: cancelledVisible,
    periodEnd: cancelledPeriodEnd,
    canDismiss: cancelledCanDismiss,
  } = useCancelledBanner();

  const {
    visible: thresholdVisible,
    metric: thresholdMetric,
    count: thresholdCount,
    limit: thresholdLimit,
  } = useUsageThresholdNudge();
  const [thresholdOpen, setThresholdOpen] = useState(false);

  useEffect(() => {
    if (!visible) return;
    const timer = setTimeout(() => setNudgeOpen(true), 2000);
    return () => clearTimeout(timer);
  }, [visible]);

  useEffect(() => {
    if (!expiryVisible) return;
    const timer = setTimeout(() => setExpiryModalOpen(true), 2500);
    return () => clearTimeout(timer);
  }, [expiryVisible]);

  useEffect(() => {
    if (!expiredModalVisible) return;
    const timer = setTimeout(() => setExpiredModalOpen(true), 2000);
    return () => clearTimeout(timer);
  }, [expiredModalVisible]);

  // Only show threshold drawer if no other interstitial is visible
  const otherInterstitialVisible =
    visible || expiryVisible || expiredModalVisible;
  useEffect(() => {
    if (!thresholdVisible || otherInterstitialVisible) return;
    const timer = setTimeout(() => setThresholdOpen(true), 2000);
    return () => clearTimeout(timer);
  }, [thresholdVisible, otherInterstitialVisible]);

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
          <TrialExpiredBanner
            visible={expiredBannerVisible}
            onReactivate={() => setExpiredModalOpen(true)}
          />
          <CancelledBanner
            visible={cancelledVisible}
            periodEnd={cancelledPeriodEnd}
            canDismiss={cancelledCanDismiss}
          />
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
      {expiryVisible &&
        warningLevel &&
        expiryDaysLeft !== null &&
        expiryDate && (
          <TrialExpiryModal
            open={expiryModalOpen}
            onOpenChange={setExpiryModalOpen}
            warningLevel={warningLevel}
            daysLeft={expiryDaysLeft}
            expiryDate={expiryDate}
            promptCount={expiryPromptCount}
            memberCount={memberCount}
          />
        )}
      {(expiredModalVisible || expiredBannerVisible) && (
        <TrialExpiredModal
          open={expiredModalOpen}
          onOpenChange={setExpiredModalOpen}
          promptCount={expiredPromptCount}
          memberCount={expiredMemberCount}
        />
      )}
      {thresholdVisible && thresholdMetric && (
        <UsageThresholdDrawer
          open={thresholdOpen}
          onOpenChange={setThresholdOpen}
          metric={thresholdMetric}
          count={thresholdCount}
          limit={thresholdLimit}
        />
      )}
    </SidebarProvider>
  );
}
