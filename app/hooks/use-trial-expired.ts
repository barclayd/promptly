import { useOrganizationId } from '~/hooks/use-organization-id';
import { useResourceLimits } from '~/hooks/use-resource-limits';
import { useSubscription } from '~/hooks/use-subscription';

const MODAL_SHOWN_KEY = (orgId: string) =>
  `promptly:trial-expired-modal-shown:${orgId}`;

const BANNER_DISMISSED_KEY = (orgId: string) =>
  `promptly:trial-expired-banner-dismissed:${orgId}`;

const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;

const isModalShown = (orgId: string): boolean => {
  if (typeof window === 'undefined') return false;
  try {
    return localStorage.getItem(MODAL_SHOWN_KEY(orgId)) === '1';
  } catch {
    return false;
  }
};

const isBannerDismissed = (orgId: string): boolean => {
  if (typeof window === 'undefined') return false;
  try {
    const dismissedAt = localStorage.getItem(BANNER_DISMISSED_KEY(orgId));
    if (!dismissedAt) return false;
    return Date.now() - Number(dismissedAt) < THREE_DAYS_MS;
  } catch {
    return false;
  }
};

export const markExpiredModalShown = (orgId: string) => {
  try {
    localStorage.setItem(MODAL_SHOWN_KEY(orgId), '1');
  } catch {
    // ignore
  }
};

export const dismissExpiredBanner = (orgId: string) => {
  try {
    localStorage.setItem(BANNER_DISMISSED_KEY(orgId), String(Date.now()));
  } catch {
    // ignore
  }
};

const NOT_VISIBLE = {
  showModal: false as const,
  showBanner: false as const,
  promptCount: 0,
  memberCount: 0,
  promptLimit: 3,
  memberLimit: 1,
};

export const useTrialExpired = () => {
  const { subscription } = useSubscription();
  const organizationId = useOrganizationId();
  const { promptCount, memberCount, promptLimit, memberLimit } =
    useResourceLimits();

  if (
    !subscription ||
    subscription.status !== 'expired' ||
    !subscription.hadTrial ||
    !organizationId
  ) {
    return NOT_VISIBLE;
  }

  const showModal = !isModalShown(organizationId);
  const showBanner = !showModal && !isBannerDismissed(organizationId);

  return {
    showModal,
    showBanner,
    promptCount,
    memberCount,
    promptLimit,
    memberLimit,
  };
};
