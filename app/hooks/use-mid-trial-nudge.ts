import { useOrganizationId } from '~/hooks/use-organization-id';
import { useResourceLimits } from '~/hooks/use-resource-limits';
import { useSubscription } from '~/hooks/use-subscription';

const PERMANENT_KEY = (orgId: string) =>
  `promptly:mid-trial-nudge-dismissed:${orgId}`;
const REMIND_KEY = (orgId: string) =>
  `promptly:mid-trial-nudge-remind-after:${orgId}`;

const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;

const isPermanentlyDismissed = (orgId: string): boolean => {
  if (typeof window === 'undefined') return false;
  try {
    return localStorage.getItem(PERMANENT_KEY(orgId)) === '1';
  } catch {
    return false;
  }
};

const isSoftDismissed = (orgId: string): boolean => {
  if (typeof window === 'undefined') return false;
  try {
    const remindAfter = localStorage.getItem(REMIND_KEY(orgId));
    if (!remindAfter) return false;
    return Date.now() < Number(remindAfter);
  } catch {
    return false;
  }
};

export const permanentlyDismissNudge = (orgId: string) => {
  try {
    localStorage.setItem(PERMANENT_KEY(orgId), '1');
  } catch {
    // ignore
  }
};

export const softDismissNudge = (orgId: string) => {
  try {
    localStorage.setItem(REMIND_KEY(orgId), String(Date.now() + THREE_DAYS_MS));
  } catch {
    // ignore
  }
};

const NOT_VISIBLE = {
  visible: false,
  daysLeft: null as number | null,
  promptCount: 0,
};

export const useMidTrialNudge = () => {
  const { subscription } = useSubscription();
  const organizationId = useOrganizationId();
  const { promptCount } = useResourceLimits();

  if (
    !subscription ||
    subscription.status !== 'trialing' ||
    subscription.daysLeft === null ||
    !organizationId
  ) {
    return NOT_VISIBLE;
  }

  const { daysLeft } = subscription;

  // Must be at least 5 days in (daysLeft <= 9 of 14-day trial)
  if (daysLeft > 9) return NOT_VISIBLE;

  // Must have created at least 2 prompts
  if (promptCount < 2) return NOT_VISIBLE;

  // Check dismissals
  if (isPermanentlyDismissed(organizationId)) return NOT_VISIBLE;
  if (isSoftDismissed(organizationId)) return NOT_VISIBLE;

  return {
    visible: true,
    daysLeft,
    promptCount,
  };
};
