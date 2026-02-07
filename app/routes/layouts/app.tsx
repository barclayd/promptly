import { useEffect, useState } from 'react';
import { Outlet } from 'react-router';
import { MidTrialNudgeDrawer } from '~/components/mid-trial-nudge-drawer';
import { SidebarLeft } from '~/components/sidebar-left';
import { SiteHeader } from '~/components/site-header';
import { TrialBanner } from '~/components/trial-banner';
import { TrialExpiredBanner } from '~/components/trial-expired-banner';
import { TrialExpiredModal } from '~/components/trial-expired-modal';
import { TrialExpiryModal } from '~/components/trial-expiry-modal';
import { SidebarInset, SidebarProvider } from '~/components/ui/sidebar';
import { useMidTrialNudge } from '~/hooks/use-mid-trial-nudge';
import { useTrialExpired } from '~/hooks/use-trial-expired';
import { useTrialExpiryModal } from '~/hooks/use-trial-expiry-modal';

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
          <TrialExpiredBanner visible={expiredBannerVisible} />
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
      {expiredModalVisible && (
        <TrialExpiredModal
          open={expiredModalOpen}
          onOpenChange={setExpiredModalOpen}
          promptCount={expiredPromptCount}
          memberCount={expiredMemberCount}
        />
      )}
    </SidebarProvider>
  );
}
