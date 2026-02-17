import { CancelledBanner } from '~/components/cancelled-banner';
import { FailedPaymentBanner } from '~/components/failed-payment-banner';
import { MidTrialNudgeDrawer } from '~/components/mid-trial-nudge-drawer';
import { TrialBanner } from '~/components/trial-banner';
import { TrialExpiredBanner } from '~/components/trial-expired-banner';
import { TrialExpiredModal } from '~/components/trial-expired-modal';
import { TrialExpiryModal } from '~/components/trial-expiry-modal';
import { UsageThresholdDrawer } from '~/components/usage-threshold-drawer';
import { WinbackModal } from '~/components/winback-modal';
import type { InterstitialContext, InterstitialDefinition } from './types';

// ---- Shared helpers ----

export type WarningLevel = '5day' | '2day' | 'lastday';
export type WinbackSegment = 'power' | 'partial' | 'ghost';
type ThresholdMetric = 'prompts' | 'team' | 'api-calls';

const serverFlag = (ctx: InterstitialContext, key: string): boolean =>
  ctx.userState[key] === '1';

const boolLocal = (ctx: InterstitialContext, key: string): boolean =>
  ctx.clientState.getLocal(key) === '1';

const numericLocal = (
  ctx: InterstitialContext,
  key: string,
  fallback: number,
): number => {
  const val = ctx.clientState.getLocal(key);
  return val ? Number(val) : fallback;
};

const timestampLocal = (ctx: InterstitialContext, key: string): number => {
  const val = ctx.clientState.getLocal(key);
  return val ? Number(val) : 0;
};

const isSoftDismissedLocal = (
  ctx: InterstitialContext,
  key: string,
): boolean => {
  const remindAfter = timestampLocal(ctx, key);
  return remindAfter > 0 && Date.now() < remindAfter;
};

const isTimestampDismissed = (
  ctx: InterstitialContext,
  key: string,
  durationMs: number,
): boolean => {
  const dismissedAt = timestampLocal(ctx, key);
  if (!dismissedAt) return false;
  return Date.now() - dismissedAt < durationMs;
};

const getWarningLevel = (daysLeft: number): WarningLevel | null => {
  if (daysLeft <= 1) return 'lastday';
  if (daysLeft === 2) return '2day';
  if (daysLeft <= 5) return '5day';
  return null;
};

const getWinbackSegment = (promptCount: number): WinbackSegment => {
  if (promptCount >= 3) return 'power';
  if (promptCount >= 1) return 'partial';
  return 'ghost';
};

const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const NEW_USER_GRACE_MS = 24 * 60 * 60 * 1000;
const MAX_WINBACK_SHOWS = 3;

// ---- Registry ----

// biome-ignore lint/suspicious/noExplicitAny: registry components have varying props
export const INTERSTITIAL_REGISTRY: InterstitialDefinition<any>[] = [
  // ============================================
  // BANNERS (stack, all visible render)
  // ============================================

  // Priority 10: Failed Payment Banner
  {
    id: 'failed-payment-banner',
    kind: 'banner',
    priority: 10,
    component: FailedPaymentBanner,
    evaluate: (ctx) => {
      const visible = ctx.subscription?.status === 'past_due';
      if (!visible) return { visible: false };
      return { visible: true, props: { visible: true } };
    },
  },

  // Priority 20: Trial Banner (self-managed — no props, uses hooks internally)
  {
    id: 'trial-banner',
    kind: 'banner',
    priority: 20,
    component: TrialBanner,
    evaluate: (ctx) => {
      // TrialBanner manages its own visibility via useTrialBannerVisible()
      // We just check if the user is in a trial state at all
      const visible =
        ctx.subscription?.status === 'trialing' &&
        ctx.subscription.daysLeft !== null &&
        ctx.subscription.daysLeft <= 7;
      return visible ? { visible: true, props: {} } : { visible: false };
    },
  },

  // Priority 30: Trial Expired Banner
  {
    id: 'trial-expired-banner',
    kind: 'banner',
    priority: 30,
    component: TrialExpiredBanner,
    evaluate: (ctx) => {
      if (
        !ctx.subscription ||
        ctx.subscription.status !== 'expired' ||
        !ctx.subscription.hadTrial ||
        !ctx.organizationId
      ) {
        return { visible: false };
      }

      // Must have already seen the expired modal (server milestone)
      const modalShownKey = `trial-expired-modal-shown:${ctx.organizationId}`;
      const modalShown =
        serverFlag(ctx, modalShownKey) ||
        boolLocal(
          ctx,
          `promptly:trial-expired-modal-shown:${ctx.organizationId}`,
        );

      if (!modalShown) return { visible: false };

      // Check soft dismiss (3-day timestamp)
      const bannerDismissKey = `promptly:trial-expired-banner-dismissed:${ctx.organizationId}`;
      if (isTimestampDismissed(ctx, bannerDismissKey, THREE_DAYS_MS)) {
        return { visible: false };
      }

      return { visible: true, props: { visible: true } };
    },
  },

  // Priority 40: Cancelled Banner
  {
    id: 'cancelled-banner',
    kind: 'banner',
    priority: 40,
    component: CancelledBanner,
    evaluate: (ctx) => {
      if (
        !ctx.subscription ||
        ctx.subscription.status !== 'active' ||
        !ctx.subscription.cancelAtPeriodEnd ||
        !ctx.organizationId
      ) {
        return { visible: false };
      }

      const { periodEnd } = ctx.subscription;
      const daysUntilCancel = periodEnd
        ? Math.max(
            0,
            Math.ceil((periodEnd - Date.now()) / (24 * 60 * 60 * 1000)),
          )
        : null;

      // Non-dismissible in last 3 days for admins
      const canDismiss =
        !ctx.canManageBilling ||
        daysUntilCancel === null ||
        daysUntilCancel > 3;

      if (canDismiss) {
        const bannerDismissKey = `promptly:cancelled-banner-dismissed:${ctx.organizationId}`;
        if (isTimestampDismissed(ctx, bannerDismissKey, THREE_DAYS_MS)) {
          return { visible: false };
        }
      }

      return {
        visible: true,
        props: { visible: true, periodEnd, canDismiss },
      };
    },
  },

  // ============================================
  // OVERLAYS (exclusive, only lowest priority wins)
  // ============================================

  // Priority 50: Mid-Trial Nudge Drawer
  {
    id: 'mid-trial-nudge',
    kind: 'drawer',
    priority: 50,
    delay: 2000,
    component: MidTrialNudgeDrawer,
    evaluate: (ctx) => {
      if (
        !ctx.subscription ||
        ctx.subscription.status !== 'trialing' ||
        ctx.subscription.daysLeft === null ||
        !ctx.organizationId
      ) {
        return { visible: false };
      }

      const { daysLeft } = ctx.subscription;

      // Must be at least 5 days in (daysLeft <= 9 of 14-day trial)
      if (daysLeft > 9) return { visible: false };

      // Must have created at least 2 prompts
      if (ctx.promptCount < 2) return { visible: false };

      // Check permanent dismiss (server-side)
      const permanentKey = `mid-trial-nudge-dismissed:${ctx.organizationId}`;
      if (
        serverFlag(ctx, permanentKey) ||
        boolLocal(
          ctx,
          `promptly:mid-trial-nudge-dismissed:${ctx.organizationId}`,
        )
      ) {
        return { visible: false };
      }

      // Check soft dismiss (client-side)
      const remindKey = `promptly:mid-trial-nudge-remind-after:${ctx.organizationId}`;
      if (isSoftDismissedLocal(ctx, remindKey)) return { visible: false };

      return {
        visible: true,
        props: { daysLeft, promptCount: ctx.promptCount },
      };
    },
  },

  // Priority 60: Trial Expiry Modal
  {
    id: 'trial-expiry-modal',
    kind: 'modal',
    priority: 60,
    delay: 2500,
    component: TrialExpiryModal,
    evaluate: (ctx) => {
      if (
        !ctx.subscription ||
        ctx.subscription.status !== 'trialing' ||
        ctx.subscription.daysLeft === null ||
        !ctx.organizationId
      ) {
        return { visible: false };
      }

      const { daysLeft } = ctx.subscription;
      const warningLevel = getWarningLevel(daysLeft);
      if (!warningLevel) return { visible: false };

      // Mid-trial nudge takes priority — check if it would be visible
      // (nudge: trialing, daysLeft <= 9, promptCount >= 2, not dismissed)
      if (daysLeft <= 9 && ctx.promptCount >= 2) {
        const permanentKey = `mid-trial-nudge-dismissed:${ctx.organizationId}`;
        const nudgeDismissed =
          serverFlag(ctx, permanentKey) ||
          boolLocal(
            ctx,
            `promptly:mid-trial-nudge-dismissed:${ctx.organizationId}`,
          );
        const nudgeRemindKey = `promptly:mid-trial-nudge-remind-after:${ctx.organizationId}`;
        const nudgeSoftDismissed = isSoftDismissedLocal(ctx, nudgeRemindKey);

        if (!nudgeDismissed && !nudgeSoftDismissed) {
          return { visible: false };
        }
      }

      // At 5-day level, also skip if nudge is soft-dismissed (respect remind-later)
      if (warningLevel === '5day') {
        const nudgeRemindKey = `promptly:mid-trial-nudge-remind-after:${ctx.organizationId}`;
        if (isSoftDismissedLocal(ctx, nudgeRemindKey)) {
          return { visible: false };
        }
      }

      // Already dismissed this session
      const dismissKey = `promptly:trial-expiry-dismissed:${warningLevel}:${ctx.organizationId}`;
      if (ctx.clientState.getSession(dismissKey) === '1') {
        return { visible: false };
      }

      const expiryDate = ctx.subscription.periodEnd
        ? new Date(ctx.subscription.periodEnd)
        : new Date(Date.now() + daysLeft * 24 * 60 * 60 * 1000);

      return {
        visible: true,
        props: {
          warningLevel,
          daysLeft,
          expiryDate,
          promptCount: ctx.promptCount,
          memberCount: ctx.memberCount,
        },
      };
    },
  },

  // Priority 70: Trial Expired Modal
  {
    id: 'trial-expired-modal',
    kind: 'modal',
    priority: 70,
    delay: 2000,
    component: TrialExpiredModal,
    evaluate: (ctx) => {
      if (
        !ctx.subscription ||
        ctx.subscription.status !== 'expired' ||
        !ctx.subscription.hadTrial ||
        !ctx.organizationId
      ) {
        return { visible: false };
      }

      // Check if modal has already been shown (server milestone)
      const milestoneKey = `trial-expired-modal-shown:${ctx.organizationId}`;
      if (
        serverFlag(ctx, milestoneKey) ||
        boolLocal(
          ctx,
          `promptly:trial-expired-modal-shown:${ctx.organizationId}`,
        )
      ) {
        return { visible: false };
      }

      return {
        visible: true,
        props: {
          promptCount: ctx.promptCount,
          memberCount: ctx.memberCount,
        },
      };
    },
  },

  // Priority 80: Winback Modal
  {
    id: 'winback-modal',
    kind: 'modal',
    priority: 80,
    delay: 2000,
    component: WinbackModal,
    evaluate: (ctx) => {
      if (
        !ctx.subscription ||
        ctx.subscription.status !== 'expired' ||
        !ctx.subscription.hadTrial ||
        !ctx.organizationId
      ) {
        return { visible: false };
      }

      // Must have already seen the initial expired modal (server milestone)
      const milestoneKey = `trial-expired-modal-shown:${ctx.organizationId}`;
      if (
        !serverFlag(ctx, milestoneKey) &&
        !boolLocal(
          ctx,
          `promptly:trial-expired-modal-shown:${ctx.organizationId}`,
        )
      ) {
        return { visible: false };
      }

      // Permanently dismissed (server)
      const dismissedKey = `winback-dismissed:${ctx.organizationId}`;
      if (
        serverFlag(ctx, dismissedKey) ||
        boolLocal(ctx, `promptly:winback-dismissed:${ctx.organizationId}`)
      ) {
        return { visible: false };
      }

      // Frequency cap: max 3 shows (server + local)
      const countKey = `winback-show-count:${ctx.organizationId}`;
      const serverCount = Number(ctx.userState[countKey] ?? '0');
      const localCount = numericLocal(
        ctx,
        `promptly:winback-show-count:${ctx.organizationId}`,
        0,
      );
      if (Math.max(serverCount, localCount) >= MAX_WINBACK_SHOWS) {
        return { visible: false };
      }

      // Cooldown: at least 7 days between shows (client-side)
      const lastShown = timestampLocal(
        ctx,
        `promptly:winback-last-shown:${ctx.organizationId}`,
      );
      if (lastShown > 0 && Date.now() - lastShown < SEVEN_DAYS_MS) {
        return { visible: false };
      }

      return {
        visible: true,
        props: {
          segment: getWinbackSegment(ctx.promptCount),
          promptCount: ctx.promptCount,
          memberCount: ctx.memberCount,
        },
      };
    },
  },

  // Priority 90: Usage Threshold Drawer
  {
    id: 'usage-threshold',
    kind: 'drawer',
    priority: 90,
    delay: 2000,
    component: UsageThresholdDrawer,
    evaluate: (ctx) => {
      if (!ctx.organizationId) return { visible: false };

      // Suppress for brand-new users (< 24h old) via server-side createdAt
      if (
        ctx.userCreatedAt &&
        Date.now() - ctx.userCreatedAt.getTime() < NEW_USER_GRACE_MS
      ) {
        return { visible: false };
      }

      // Only show for admins/owners
      if (!ctx.canManageBilling) return { visible: false };

      // Build candidates: metrics at >= 80% of their limit (skip unlimited)
      const candidates: {
        metric: ThresholdMetric;
        count: number;
        limit: number;
        percentage: number;
      }[] = [];

      if (ctx.promptLimit !== -1 && ctx.promptLimit > 0) {
        const pct = ctx.promptCount / ctx.promptLimit;
        if (pct >= 0.8) {
          candidates.push({
            metric: 'prompts',
            count: ctx.promptCount,
            limit: ctx.promptLimit,
            percentage: pct,
          });
        }
      }

      if (ctx.memberLimit !== -1 && ctx.memberLimit > 0) {
        const pct = ctx.memberCount / ctx.memberLimit;
        if (pct >= 0.8) {
          candidates.push({
            metric: 'team',
            count: ctx.memberCount,
            limit: ctx.memberLimit,
            percentage: pct,
          });
        }
      }

      if (ctx.apiCallLimit !== -1 && ctx.apiCallLimit > 0) {
        const pct = ctx.apiCallCount / ctx.apiCallLimit;
        if (pct >= 0.8) {
          candidates.push({
            metric: 'api-calls',
            count: ctx.apiCallCount,
            limit: ctx.apiCallLimit,
            percentage: pct,
          });
        }
      }

      if (candidates.length === 0) return { visible: false };

      // Pick the highest percentage metric
      candidates.sort((a, b) => b.percentage - a.percentage);

      for (const candidate of candidates) {
        // Check permanent dismiss (server + local)
        const permanentKey = `usage-threshold-dismissed:${candidate.metric}:${ctx.organizationId}`;
        if (
          serverFlag(ctx, permanentKey) ||
          boolLocal(
            ctx,
            `promptly:usage-threshold-dismissed:${candidate.metric}:${ctx.organizationId}`,
          )
        ) {
          continue;
        }

        // Check soft dismiss (client-side)
        const remindKey = `promptly:usage-threshold-remind-after:${candidate.metric}:${ctx.organizationId}`;
        if (isSoftDismissedLocal(ctx, remindKey)) continue;

        return {
          visible: true,
          props: {
            metric: candidate.metric,
            count: candidate.count,
            limit: candidate.limit,
          },
        };
      }

      return { visible: false };
    },
  },
];
