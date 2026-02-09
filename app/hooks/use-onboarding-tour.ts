import { useRouteLoaderData } from 'react-router';
import { getOnboardingStep } from '~/hooks/use-onboarding-progress';
import type { loader as rootLoader } from '~/root';

const COMPLETED_KEY = (userId: string) =>
  `promptly:onboarding-completed:${userId}`;
const SKIPPED_KEY = (userId: string) => `promptly:onboarding-skipped:${userId}`;

const isCompleted = (userId: string): boolean => {
  if (typeof window === 'undefined') return true;
  try {
    return localStorage.getItem(COMPLETED_KEY(userId)) === '1';
  } catch {
    return true;
  }
};

const isSkipped = (userId: string): boolean => {
  if (typeof window === 'undefined') return true;
  try {
    return localStorage.getItem(SKIPPED_KEY(userId)) === '1';
  } catch {
    return true;
  }
};

export const markOnboardingCompleted = (userId: string) => {
  try {
    localStorage.setItem(COMPLETED_KEY(userId), '1');
  } catch {
    // ignore
  }
};

export const markOnboardingSkipped = (userId: string) => {
  try {
    localStorage.setItem(SKIPPED_KEY(userId), '1');
  } catch {
    // ignore
  }
};

export const resetOnboarding = (userId: string) => {
  try {
    localStorage.removeItem(COMPLETED_KEY(userId));
    localStorage.removeItem(SKIPPED_KEY(userId));
  } catch {
    // ignore
  }
};

const NOT_VISIBLE = {
  visible: false,
  firstName: null as string | null,
  userId: null as string | null,
};

export const useOnboardingTour = () => {
  const rootData = useRouteLoaderData<typeof rootLoader>('root');
  const user = rootData?.user;

  if (!user?.id) return NOT_VISIBLE;

  // Don't show on mobile — right sidebar isn't usable
  if (typeof window !== 'undefined' && window.innerWidth < 768) {
    return NOT_VISIBLE;
  }

  if (isCompleted(user.id) || isSkipped(user.id)) return NOT_VISIBLE;

  // Users who started the tour but dismissed mid-way should NOT auto-start.
  // The progress widget handles resumption for them.
  const savedStep = getOnboardingStep(user.id);
  if (savedStep !== null && savedStep > 0) return NOT_VISIBLE;

  const firstName = user.name?.split(' ')[0] ?? null;

  return {
    visible: true,
    firstName,
    userId: user.id,
  };
};
