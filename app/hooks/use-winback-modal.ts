import { useOrganizationId } from '~/hooks/use-organization-id';
import { useResourceLimits } from '~/hooks/use-resource-limits';
import { useSubscription } from '~/hooks/use-subscription';

const SHOW_COUNT_KEY = (orgId: string) =>
  `promptly:winback-show-count:${orgId}`;
const LAST_SHOWN_KEY = (orgId: string) =>
  `promptly:winback-last-shown:${orgId}`;
const DISMISSED_KEY = (orgId: string) => `promptly:winback-dismissed:${orgId}`;
const EXPIRED_MODAL_SHOWN_KEY = (orgId: string) =>
  `promptly:trial-expired-modal-shown:${orgId}`;

const MAX_SHOWS = 3;
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

const getShowCount = (orgId: string): number => {
  if (typeof window === 'undefined') return MAX_SHOWS;
  try {
    return Number(localStorage.getItem(SHOW_COUNT_KEY(orgId)) ?? '0');
  } catch {
    return MAX_SHOWS;
  }
};

const getLastShown = (orgId: string): number => {
  if (typeof window === 'undefined') return Date.now();
  try {
    const val = localStorage.getItem(LAST_SHOWN_KEY(orgId));
    return val ? Number(val) : 0;
  } catch {
    return Date.now();
  }
};

const isDismissed = (orgId: string): boolean => {
  if (typeof window === 'undefined') return false;
  try {
    return localStorage.getItem(DISMISSED_KEY(orgId)) === '1';
  } catch {
    return false;
  }
};

const hasSeenExpiredModal = (orgId: string): boolean => {
  if (typeof window === 'undefined') return false;
  try {
    return localStorage.getItem(EXPIRED_MODAL_SHOWN_KEY(orgId)) === '1';
  } catch {
    return false;
  }
};

export const markWinbackShown = (orgId: string) => {
  try {
    const count = getShowCount(orgId);
    localStorage.setItem(SHOW_COUNT_KEY(orgId), String(count + 1));
    localStorage.setItem(LAST_SHOWN_KEY(orgId), String(Date.now()));
  } catch {
    // ignore
  }
};

export const dismissWinback = (orgId: string) => {
  try {
    localStorage.setItem(DISMISSED_KEY(orgId), '1');
  } catch {
    // ignore
  }
};

export type WinbackSegment = 'power' | 'partial' | 'ghost';

const getSegment = (promptCount: number): WinbackSegment => {
  if (promptCount >= 3) return 'power';
  if (promptCount >= 1) return 'partial';
  return 'ghost';
};

const NOT_VISIBLE = {
  visible: false,
  segment: null as WinbackSegment | null,
  promptCount: 0,
  memberCount: 0,
};

export const useWinbackModal = () => {
  const { subscription } = useSubscription();
  const organizationId = useOrganizationId();
  const { promptCount, memberCount } = useResourceLimits();

  if (
    !subscription ||
    subscription.status !== 'expired' ||
    !subscription.hadTrial ||
    !organizationId
  ) {
    return NOT_VISIBLE;
  }

  // Must have already seen the initial expired modal
  if (!hasSeenExpiredModal(organizationId)) return NOT_VISIBLE;

  // Permanently dismissed
  if (isDismissed(organizationId)) return NOT_VISIBLE;

  // Frequency cap: max 3 shows
  if (getShowCount(organizationId) >= MAX_SHOWS) return NOT_VISIBLE;

  // Cooldown: at least 7 days between shows
  const lastShown = getLastShown(organizationId);
  if (lastShown > 0 && Date.now() - lastShown < SEVEN_DAYS_MS) {
    return NOT_VISIBLE;
  }

  return {
    visible: true,
    segment: getSegment(promptCount),
    promptCount,
    memberCount,
  };
};
