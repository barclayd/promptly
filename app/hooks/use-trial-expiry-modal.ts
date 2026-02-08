import { useMidTrialNudge } from '~/hooks/use-mid-trial-nudge';
import { useOrganizationId } from '~/hooks/use-organization-id';
import { useResourceLimits } from '~/hooks/use-resource-limits';
import { useSubscription } from '~/hooks/use-subscription';

export type WarningLevel = '5day' | '2day' | 'lastday';

const getWarningLevel = (daysLeft: number): WarningLevel | null => {
  if (daysLeft <= 1) return 'lastday';
  if (daysLeft === 2) return '2day';
  if (daysLeft <= 5) return '5day';
  return null;
};

const DISMISS_KEY = (level: WarningLevel, orgId: string) =>
  `promptly:trial-expiry-dismissed:${level}:${orgId}`;

const NUDGE_REMIND_KEY = (orgId: string) =>
  `promptly:mid-trial-nudge-remind-after:${orgId}`;

const isDismissedInSession = (level: WarningLevel, orgId: string): boolean => {
  if (typeof window === 'undefined') return false;
  try {
    return sessionStorage.getItem(DISMISS_KEY(level, orgId)) === '1';
  } catch {
    return false;
  }
};

const isNudgeSoftDismissed = (orgId: string): boolean => {
  if (typeof window === 'undefined') return false;
  try {
    const remindAfter = localStorage.getItem(NUDGE_REMIND_KEY(orgId));
    if (!remindAfter) return false;
    return Date.now() < Number(remindAfter);
  } catch {
    return false;
  }
};

export const dismissTrialExpiryModal = (orgId: string, level: WarningLevel) => {
  try {
    sessionStorage.setItem(DISMISS_KEY(level, orgId), '1');
  } catch {
    // ignore
  }
};

const NOT_VISIBLE = {
  visible: false as const,
  warningLevel: null as WarningLevel | null,
  daysLeft: null as number | null,
  expiryDate: null as Date | null,
  promptCount: 0,
  memberCount: 0,
};

export const useTrialExpiryModal = () => {
  const { subscription } = useSubscription();
  const organizationId = useOrganizationId();
  const { promptCount, memberCount } = useResourceLimits();
  const nudge = useMidTrialNudge();

  if (
    !subscription ||
    subscription.status !== 'trialing' ||
    subscription.daysLeft === null ||
    !organizationId
  ) {
    return NOT_VISIBLE;
  }

  const { daysLeft } = subscription;
  const warningLevel = getWarningLevel(daysLeft);

  if (!warningLevel) return NOT_VISIBLE;

  // Nudge drawer takes priority — only one interstitial per page load
  if (nudge.visible) return NOT_VISIBLE;

  // At 5-day level, also skip if nudge is soft-dismissed (respect remind-later)
  if (warningLevel === '5day' && isNudgeSoftDismissed(organizationId)) {
    return NOT_VISIBLE;
  }

  // Already dismissed this session
  if (isDismissedInSession(warningLevel, organizationId)) return NOT_VISIBLE;

  const expiryDate = subscription.periodEnd
    ? new Date(subscription.periodEnd)
    : new Date(Date.now() + daysLeft * 24 * 60 * 60 * 1000);

  return {
    visible: true as const,
    warningLevel,
    daysLeft,
    expiryDate,
    promptCount,
    memberCount,
  };
};
