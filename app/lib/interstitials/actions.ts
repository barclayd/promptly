const writeServer = (key: string) => {
  fetch('/api/user-state', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key }),
  }).catch(() => {
    // Fire-and-forget — server write is best-effort
  });
};

const writeServerWithValue = (key: string, value: string) => {
  fetch('/api/user-state', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key, value }),
  }).catch(() => {
    // Fire-and-forget
  });
};

const setLocal = (key: string, value: string) => {
  try {
    localStorage.setItem(key, value);
  } catch {
    // ignore
  }
};

const setSession = (key: string, value: string) => {
  try {
    sessionStorage.setItem(key, value);
  } catch {
    // ignore
  }
};

/** Permanent dismiss — writes to server AND optimistically to localStorage */
export const dismissPermanently = (key: string, orgId?: string) => {
  const fullKey = orgId ? `${key}:${orgId}` : key;
  setLocal(`promptly:${fullKey}`, '1');
  writeServer(fullKey);
};

/** Mark a one-time milestone — writes to server AND optimistically to localStorage */
export const markMilestone = (key: string, orgId?: string) => {
  const fullKey = orgId ? `${key}:${orgId}` : key;
  setLocal(`promptly:${fullKey}`, '1');
  writeServer(fullKey);
};

/** Increment a counter on the server AND locally */
export const incrementCounter = (key: string, orgId: string) => {
  const fullKey = `${key}:${orgId}`;
  const localKey = `promptly:${fullKey}`;
  try {
    const current = Number(localStorage.getItem(localKey) ?? '0');
    localStorage.setItem(localKey, String(current + 1));
  } catch {
    // ignore
  }
  // Read current count + 1 to send to server
  let newCount = 1;
  try {
    newCount = Number(localStorage.getItem(localKey) ?? '1');
  } catch {
    // ignore
  }
  writeServerWithValue(fullKey, String(newCount));
};

/** Soft dismiss — client-side only, expires after daysMs */
export const softDismiss = (key: string, orgId: string, daysMs: number) => {
  const fullKey = `promptly:${key}:${orgId}`;
  setLocal(fullKey, String(Date.now() + daysMs));
};

/** Session dismiss — client-side only, expires when browser closes */
export const sessionDismiss = (key: string, orgId: string) => {
  const fullKey = `promptly:${key}:${orgId}`;
  setSession(fullKey, '1');
};

/** Set a timestamp in localStorage (for cooldown tracking) */
export const setTimestamp = (key: string, orgId: string) => {
  const fullKey = `promptly:${key}:${orgId}`;
  setLocal(fullKey, String(Date.now()));
};

// ----- Convenience exports matching old hook APIs -----

const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;

// Mid-trial nudge
export const permanentlyDismissNudge = (orgId: string) => {
  dismissPermanently('mid-trial-nudge-dismissed', orgId);
};

export const softDismissNudge = (orgId: string) => {
  softDismiss('mid-trial-nudge-remind-after', orgId, THREE_DAYS_MS);
};

// Trial expired
export const markExpiredModalShown = (orgId: string) => {
  markMilestone('trial-expired-modal-shown', orgId);
};

export const dismissExpiredBanner = (orgId: string) => {
  const fullKey = `promptly:trial-expired-banner-dismissed:${orgId}`;
  setLocal(fullKey, String(Date.now()));
};

// Trial expiry (session-based)
export type { WarningLevel } from './registry';

export const dismissTrialExpiryModal = (orgId: string, level: string) => {
  sessionDismiss(`trial-expiry-dismissed:${level}`, orgId);
};

// Cancelled banner
export const dismissCancelledBanner = (orgId: string) => {
  const fullKey = `promptly:cancelled-banner-dismissed:${orgId}`;
  setLocal(fullKey, String(Date.now()));
};

// Winback
export type { WinbackSegment } from './registry';

export const markWinbackShown = (orgId: string) => {
  incrementCounter('winback-show-count', orgId);
  setTimestamp('winback-last-shown', orgId);
};

export const dismissWinback = (orgId: string) => {
  dismissPermanently('winback-dismissed', orgId);
};

// Usage threshold
export const permanentlyDismissThreshold = (
  metric: 'prompts' | 'team' | 'api-calls',
  orgId: string,
) => {
  dismissPermanently(`usage-threshold-dismissed:${metric}`, orgId);
};

export const softDismissThreshold = (
  metric: 'prompts' | 'team' | 'api-calls',
  orgId: string,
) => {
  softDismiss(`usage-threshold-remind-after:${metric}`, orgId, THREE_DAYS_MS);
};

// Onboarding
export {
  markOnboardingCompleted,
  markOnboardingSkipped,
} from '~/hooks/use-onboarding-tour';
