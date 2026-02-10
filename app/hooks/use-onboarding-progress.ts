import { useSyncExternalStore } from 'react';

const STEP_KEY = (userId: string) => `promptly:onboarding-step:${userId}`;
const PROMPT_ID_KEY = (userId: string) =>
  `promptly:onboarding-prompt-id:${userId}`;
const COMPLETED_KEY = (userId: string) =>
  `promptly:onboarding-completed:${userId}`;

const TOTAL_MILESTONES = 6;

/**
 * Maps the highest completed tour step (0–9) to a user-facing milestone (1–6).
 *
 * | Milestone | Label          | Tour Steps |
 * |-----------|----------------|------------|
 * | 1         | Welcome        | 0          |
 * | 2         | Create prompt  | 1–3        |
 * | 3         | System prompt  | 4          |
 * | 4         | User prompt    | 5          |
 * | 5         | Test setup     | 6          |
 * | 6         | Run test       | 7–9        |
 */
export const stepToMilestone = (step: number): number => {
  if (step <= 0) return 1;
  if (step <= 3) return 2;
  if (step <= 4) return 3;
  if (step <= 5) return 4;
  if (step <= 6) return 5;
  return 6;
};

// --- Custom event for same-tab reactivity ---

const PROGRESS_EVENT = 'onboarding-progress';
export const notifyProgressChange = () =>
  window.dispatchEvent(new Event(PROGRESS_EVENT));

// --- localStorage utilities ---

export const getOnboardingStep = (userId: string): number | null => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STEP_KEY(userId));
    if (raw === null) return null;
    const parsed = Number.parseInt(raw, 10);
    return Number.isNaN(parsed) ? null : parsed;
  } catch {
    return null;
  }
};

export const setOnboardingStep = (userId: string, step: number) => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STEP_KEY(userId), String(step));
    notifyProgressChange();
  } catch {
    // ignore
  }
};

export const getOnboardingPromptId = (userId: string): string | null => {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem(PROMPT_ID_KEY(userId));
  } catch {
    return null;
  }
};

export const setOnboardingPromptId = (userId: string, promptId: string) => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(PROMPT_ID_KEY(userId), promptId);
  } catch {
    // ignore
  }
};

export const clearOnboardingProgress = (userId: string) => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(STEP_KEY(userId));
    localStorage.removeItem(PROMPT_ID_KEY(userId));
    notifyProgressChange();
  } catch {
    // ignore
  }
};

// --- React hook ---

const subscribe = (cb: () => void) => {
  window.addEventListener('storage', cb);
  window.addEventListener(PROGRESS_EVENT, cb);
  return () => {
    window.removeEventListener('storage', cb);
    window.removeEventListener(PROGRESS_EVENT, cb);
  };
};

const NOT_VISIBLE = {
  visible: false,
  milestone: 0,
  total: TOTAL_MILESTONES,
  highestStep: null as number | null,
  promptId: null as string | null,
};

export const useOnboardingProgress = (userId: string | null) => {
  const snapshot = useSyncExternalStore(
    subscribe,
    () => {
      if (!userId) return JSON.stringify(NOT_VISIBLE);
      const highestStep = getOnboardingStep(userId);
      const promptId = getOnboardingPromptId(userId);

      // Not visible if user never started, or completed (step >= 9), or has completed flag
      const isCompleted =
        typeof window !== 'undefined' &&
        localStorage.getItem(COMPLETED_KEY(userId)) === '1';

      if (highestStep === null || highestStep >= 9 || isCompleted) {
        return JSON.stringify(NOT_VISIBLE);
      }

      return JSON.stringify({
        visible: true,
        milestone: stepToMilestone(highestStep),
        total: TOTAL_MILESTONES,
        highestStep,
        promptId,
      });
    },
    () => JSON.stringify(NOT_VISIBLE),
  );

  return JSON.parse(snapshot) as {
    visible: boolean;
    milestone: number;
    total: number;
    highestStep: number | null;
    promptId: string | null;
  };
};
