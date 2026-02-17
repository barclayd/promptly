import { useRouteLoaderData } from 'react-router';
import { useCanManageBilling } from '~/hooks/use-can-manage-billing';
import { useOrganizationId } from '~/hooks/use-organization-id';
import { useResourceLimits } from '~/hooks/use-resource-limits';
import type { loader as rootLoader } from '~/root';

type ThresholdMetric = 'prompts' | 'team' | 'api-calls';

const PERMANENT_KEY = (metric: ThresholdMetric, orgId: string) =>
  `promptly:usage-threshold-dismissed:${metric}:${orgId}`;
const REMIND_KEY = (metric: ThresholdMetric, orgId: string) =>
  `promptly:usage-threshold-remind-after:${metric}:${orgId}`;

const HAS_VISITED_KEY = (userId: string) => `promptly:has-visited:${userId}`;

const ONBOARDING_COMPLETED_KEY = (userId: string) =>
  `promptly:onboarding-completed:${userId}`;
const ONBOARDING_SKIPPED_KEY = (userId: string) =>
  `promptly:onboarding-skipped:${userId}`;

const isFirstVisitWithoutOnboarding = (userId: string): boolean => {
  if (typeof window === 'undefined') return false;
  try {
    const hasVisited = localStorage.getItem(HAS_VISITED_KEY(userId)) === '1';
    const onboardingDone =
      localStorage.getItem(ONBOARDING_COMPLETED_KEY(userId)) === '1' ||
      localStorage.getItem(ONBOARDING_SKIPPED_KEY(userId)) === '1';

    // Set the flag for next visit (regardless of outcome)
    if (!hasVisited) {
      localStorage.setItem(HAS_VISITED_KEY(userId), '1');
    }

    return !hasVisited && !onboardingDone;
  } catch {
    return false;
  }
};

const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;

const isPermanentlyDismissed = (
  metric: ThresholdMetric,
  orgId: string,
): boolean => {
  if (typeof window === 'undefined') return false;
  try {
    return localStorage.getItem(PERMANENT_KEY(metric, orgId)) === '1';
  } catch {
    return false;
  }
};

const isSoftDismissed = (metric: ThresholdMetric, orgId: string): boolean => {
  if (typeof window === 'undefined') return false;
  try {
    const remindAfter = localStorage.getItem(REMIND_KEY(metric, orgId));
    if (!remindAfter) return false;
    return Date.now() < Number(remindAfter);
  } catch {
    return false;
  }
};

export const permanentlyDismissThreshold = (
  metric: ThresholdMetric,
  orgId: string,
) => {
  try {
    localStorage.setItem(PERMANENT_KEY(metric, orgId), '1');
  } catch {
    // ignore
  }
};

export const softDismissThreshold = (
  metric: ThresholdMetric,
  orgId: string,
) => {
  try {
    localStorage.setItem(
      REMIND_KEY(metric, orgId),
      String(Date.now() + THREE_DAYS_MS),
    );
  } catch {
    // ignore
  }
};

type ThresholdResult =
  | { visible: false; metric: null; count: 0; limit: 0 }
  | {
      visible: true;
      metric: ThresholdMetric;
      count: number;
      limit: number;
    };

const NOT_VISIBLE: ThresholdResult = {
  visible: false,
  metric: null,
  count: 0,
  limit: 0,
};

export const useUsageThresholdNudge = (): ThresholdResult => {
  const { canManageBilling } = useCanManageBilling();
  const organizationId = useOrganizationId();
  const {
    promptCount,
    promptLimit,
    memberCount,
    memberLimit,
    apiCallCount,
    apiCallLimit,
  } = useResourceLimits();
  const rootData = useRouteLoaderData<typeof rootLoader>('root');
  const userId = rootData?.user?.id;

  if (!organizationId) return NOT_VISIBLE;

  // Suppress for brand-new users until second visit or onboarding completion
  if (userId && isFirstVisitWithoutOnboarding(userId)) return NOT_VISIBLE;

  // Only show for admins/owners
  if (!canManageBilling) return NOT_VISIBLE;

  // Build candidates: metrics at >= 80% of their limit (skip unlimited)
  const candidates: {
    metric: ThresholdMetric;
    count: number;
    limit: number;
    percentage: number;
  }[] = [];

  if (promptLimit !== -1 && promptLimit > 0) {
    const pct = promptCount / promptLimit;
    if (pct >= 0.8) {
      candidates.push({
        metric: 'prompts',
        count: promptCount,
        limit: promptLimit,
        percentage: pct,
      });
    }
  }

  if (memberLimit !== -1 && memberLimit > 0) {
    const pct = memberCount / memberLimit;
    if (pct >= 0.8) {
      candidates.push({
        metric: 'team',
        count: memberCount,
        limit: memberLimit,
        percentage: pct,
      });
    }
  }

  if (apiCallLimit !== -1 && apiCallLimit > 0) {
    const pct = apiCallCount / apiCallLimit;
    if (pct >= 0.8) {
      candidates.push({
        metric: 'api-calls',
        count: apiCallCount,
        limit: apiCallLimit,
        percentage: pct,
      });
    }
  }

  if (candidates.length === 0) return NOT_VISIBLE;

  // Pick the highest percentage metric
  candidates.sort((a, b) => b.percentage - a.percentage);

  for (const candidate of candidates) {
    if (isPermanentlyDismissed(candidate.metric, organizationId)) continue;
    if (isSoftDismissed(candidate.metric, organizationId)) continue;

    return {
      visible: true,
      metric: candidate.metric,
      count: candidate.count,
      limit: candidate.limit,
    };
  }

  return NOT_VISIBLE;
};
