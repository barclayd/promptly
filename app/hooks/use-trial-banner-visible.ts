import { useOrganizationId } from '~/hooks/use-organization-id';
import { useSubscription } from '~/hooks/use-subscription';

type TrialPhase = 1 | 2 | 3;

const getPhase = (daysLeft: number): TrialPhase | null => {
  if (daysLeft <= 1) return 3;
  if (daysLeft <= 3) return 2;
  if (daysLeft <= 7) return 1;
  return null;
};

const getDismissKey = (phase: TrialPhase, orgId: string) =>
  `trial-banner-dismissed-phase${phase}-${orgId}`;

const isDismissedInStorage = (phase: TrialPhase, orgId: string): boolean => {
  if (typeof window === 'undefined') return false;
  try {
    return sessionStorage.getItem(getDismissKey(phase, orgId)) === '1';
  } catch {
    return false;
  }
};

export const useTrialBannerVisible = () => {
  const { subscription } = useSubscription();
  const organizationId = useOrganizationId();

  if (
    !subscription ||
    subscription.status !== 'trialing' ||
    subscription.daysLeft === null ||
    !organizationId
  ) {
    return {
      visible: false,
      phase: null as TrialPhase | null,
      daysLeft: null as number | null,
    };
  }

  const { daysLeft } = subscription;
  const phase = getPhase(daysLeft);

  if (!phase) {
    return { visible: false, phase: null, daysLeft };
  }

  // Phase 3 is never dismissible
  const isDismissible = phase !== 3;
  const isDismissed =
    isDismissible && isDismissedInStorage(phase, organizationId);

  return {
    visible: !isDismissed,
    phase,
    daysLeft,
  };
};

export { getDismissKey, type TrialPhase };
