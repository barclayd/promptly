import { useCanManageBilling } from '~/hooks/use-can-manage-billing';
import { useOrganizationId } from '~/hooks/use-organization-id';
import { useSubscription } from '~/hooks/use-subscription';

const BANNER_DISMISSED_KEY = (orgId: string) =>
  `promptly:cancelled-banner-dismissed:${orgId}`;

const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;

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

export const dismissCancelledBanner = (orgId: string) => {
  try {
    localStorage.setItem(BANNER_DISMISSED_KEY(orgId), String(Date.now()));
  } catch {
    // ignore
  }
};

const NOT_VISIBLE = {
  visible: false as const,
  periodEnd: null as number | null,
  daysUntilCancel: null as number | null,
  canDismiss: true,
};

export const useCancelledBanner = () => {
  const { subscription } = useSubscription();
  const organizationId = useOrganizationId();
  const { canManageBilling } = useCanManageBilling();

  if (
    !subscription ||
    subscription.status !== 'active' ||
    !subscription.cancelAtPeriodEnd ||
    !organizationId
  ) {
    return NOT_VISIBLE;
  }

  const { periodEnd } = subscription;
  const daysUntilCancel = periodEnd
    ? Math.max(0, Math.ceil((periodEnd - Date.now()) / (24 * 60 * 60 * 1000)))
    : null;

  // Non-dismissible in last 3 days for admins
  const canDismiss =
    !canManageBilling || daysUntilCancel === null || daysUntilCancel > 3;

  if (canDismiss && isBannerDismissed(organizationId)) {
    return NOT_VISIBLE;
  }

  return {
    visible: true as const,
    periodEnd,
    daysUntilCancel,
    canDismiss,
  };
};
