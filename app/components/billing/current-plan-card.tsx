'use client';

import {
  IconAlertTriangle,
  IconArrowDown,
  IconCheck,
  IconClock,
  IconCrown,
  IconExternalLink,
  IconSparkles,
} from '@tabler/icons-react';
import { type ReactNode, useState } from 'react';
import { useCanManageBilling } from '~/hooks/use-can-manage-billing';
import { useResourceLimits } from '~/hooks/use-resource-limits';
import { useSubscription } from '~/hooks/use-subscription';
import { authClient } from '~/lib/auth.client';
import { cn } from '~/lib/utils';
import type { SubscriptionStatus } from '~/plugins/trial-stripe/types';
import { Button } from '../ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '../ui/dialog';

interface PlanDisplayConfig {
  title: string;
  subtitle: string;
  icon: ReactNode;
  accentColor: string;
  badgeClasses: string;
}

const formatDate = (timestamp: number | null): string => {
  if (!timestamp) return '';
  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(timestamp));
};

const getPlanDisplay = (
  subscription: SubscriptionStatus,
): PlanDisplayConfig => {
  const { status, daysLeft, cancelAtPeriodEnd, periodEnd } = subscription;

  if (status === 'trialing') {
    return {
      title: 'Pro Trial',
      subtitle: `${daysLeft ?? 0} days remaining`,
      icon: <IconClock className="size-5" />,
      accentColor: 'text-amber-600 dark:text-amber-400',
      badgeClasses:
        'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
    };
  }

  if (status === 'active' && cancelAtPeriodEnd) {
    return {
      title: 'Pro Plan',
      subtitle: `Cancels ${formatDate(periodEnd)}`,
      icon: <IconClock className="size-5" />,
      accentColor: 'text-muted-foreground',
      badgeClasses: 'bg-secondary text-muted-foreground',
    };
  }

  if (status === 'active') {
    return {
      title: 'Pro Plan',
      subtitle: '$29/month',
      icon: <IconCheck className="size-5" />,
      accentColor: 'text-indigo-600 dark:text-indigo-400',
      badgeClasses:
        'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300',
    };
  }

  if (status === 'past_due') {
    return {
      title: 'Pro Plan',
      subtitle: 'Payment failed',
      icon: <IconAlertTriangle className="size-5" />,
      accentColor: 'text-red-600 dark:text-red-400',
      badgeClasses:
        'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
    };
  }

  return {
    title: 'Pro Plan',
    subtitle: '',
    icon: <IconSparkles className="size-5" />,
    accentColor: 'text-indigo-600 dark:text-indigo-400',
    badgeClasses:
      'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300',
  };
};

const stagger = (base: number, i: number, step = 60) => ({
  animationDelay: `${base + i * step}ms`,
  animationFillMode: 'forwards' as const,
});

const DOWNGRADE_ROWS = [
  { feature: 'Prompts', pro: 'Unlimited', free: '3' },
  { feature: 'Team members', pro: '5', free: '1' },
  { feature: 'API calls', pro: '50,000/mo', free: '5,000/mo' },
  { feature: 'Priority support', pro: 'Included', free: 'None' },
];

const CancelPlanDialog = ({
  open,
  onOpenChange,
  periodEnd,
  isCanceling,
  onCancel,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  periodEnd: number | null;
  isCanceling: boolean;
  onCancel: () => void;
}) => {
  const { promptCount, memberCount } = useResourceLimits();

  const willExceedPrompts = promptCount > 3;
  const willExceedMembers = memberCount > 1;
  const hasExceedingLimits = willExceedPrompts || willExceedMembers;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        data-slot="cancel-plan-modal"
        className="sm:max-w-md gap-0 p-0 overflow-hidden"
      >
        {/* Header with amber caution gradient */}
        <div className="relative px-6 pt-6 pb-5 bg-gradient-to-b from-amber-500/[0.06] to-transparent dark:from-amber-500/[0.08]">
          <div className="flex items-start gap-4">
            <div
              className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 dark:bg-amber-500/15 animate-badge-pop"
              style={stagger(0, 0)}
            >
              <IconArrowDown className="size-5 text-amber-500 dark:text-amber-400" />
            </div>
            <div className="space-y-1.5 min-w-0">
              <DialogTitle
                className="text-base font-semibold leading-snug opacity-0 animate-fade-in-up"
                style={stagger(80, 0)}
              >
                Downgrade to Free?
              </DialogTitle>
              <DialogDescription
                className="text-sm text-muted-foreground leading-relaxed opacity-0 animate-fade-in-up"
                style={stagger(160, 0)}
              >
                You'll keep Pro access until{' '}
                <span className="font-medium text-foreground">
                  {formatDate(periodEnd)}
                </span>
                . After that, your workspace switches to Free.
              </DialogDescription>
            </div>
          </div>

          {/* Exceeding limits warning pill */}
          {hasExceedingLimits && (
            <div className="mt-4">
              <span
                className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ring-1 bg-amber-500/8 text-amber-600 ring-amber-500/15 dark:bg-amber-500/10 dark:text-amber-400 dark:ring-amber-500/20 animate-badge-pop"
                style={stagger(300, 0)}
              >
                <IconAlertTriangle className="size-3" />
                You currently exceed Free plan limits
              </span>
            </div>
          )}
        </div>

        {/* What changes comparison table */}
        <div className="px-6 py-5">
          <div
            className="overflow-hidden rounded-lg border border-border/60 opacity-0 animate-fade-in-up"
            style={stagger(380, 0)}
          >
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/60 bg-muted/30">
                  <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">
                    Feature
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-indigo-600 dark:text-indigo-400">
                    Pro (Now)
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">
                    Free (After)
                  </th>
                </tr>
              </thead>
              <tbody>
                {DOWNGRADE_ROWS.map((row, i) => {
                  const exceeds =
                    (row.feature === 'Prompts' && willExceedPrompts) ||
                    (row.feature === 'Team members' && willExceedMembers);

                  return (
                    <tr
                      key={row.feature}
                      className="border-b border-border/40 last:border-0 opacity-0 animate-fade-in-up"
                      style={stagger(440, i, 70)}
                    >
                      <td className="px-3 py-2 font-medium text-foreground/80">
                        {row.feature}
                      </td>
                      <td className="px-3 py-2 text-foreground/70">
                        {row.pro}
                      </td>
                      <td
                        className={cn(
                          'px-3 py-2',
                          exceeds
                            ? 'font-medium text-amber-600 dark:text-amber-400'
                            : 'text-foreground/70',
                        )}
                      >
                        {row.free}
                        {exceeds && (
                          <span className="ml-1.5 text-xs text-amber-500">
                            *
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Footnote for exceeded limits */}
          {hasExceedingLimits && (
            <p
              className="mt-2.5 text-xs text-amber-600/80 dark:text-amber-400/70 opacity-0 animate-fade-in-up"
              style={stagger(700, 0)}
            >
              * You have {willExceedPrompts ? `${promptCount} prompts` : ''}
              {willExceedPrompts && willExceedMembers ? ' and ' : ''}
              {willExceedMembers ? `${memberCount} team members` : ''} —
              exceeding Free limits. You won't lose data, but access will be
              restricted.
            </p>
          )}
        </div>

        {/* CTA area */}
        <div className="px-6 pb-6 pt-1 flex flex-col items-center gap-3">
          <Button
            size="lg"
            className="w-full gap-2 bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-500/20 dark:bg-indigo-600 dark:hover:bg-indigo-500 dark:shadow-indigo-500/10 opacity-0 animate-fade-in-up"
            style={stagger(720, 0)}
            onClick={() => onOpenChange(false)}
          >
            <IconCrown className="size-4" />
            Keep Pro
          </Button>
          <button
            type="button"
            onClick={onCancel}
            disabled={isCanceling}
            className="text-sm text-muted-foreground/60 underline underline-offset-4 decoration-muted-foreground/30 transition-colors hover:text-muted-foreground hover:decoration-muted-foreground/50 disabled:opacity-50 disabled:pointer-events-none opacity-0 animate-fade-in-up"
            style={stagger(800, 0)}
          >
            {isCanceling ? 'Canceling...' : 'Yes, cancel my plan'}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export const CurrentPlanCard = () => {
  const { subscription } = useSubscription();
  const { canManageBilling } = useCanManageBilling();
  const [isUpgrading, setIsUpgrading] = useState(false);
  const [isPortalLoading, setIsPortalLoading] = useState(false);
  const [isCanceling, setIsCanceling] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);

  if (!subscription) return null;

  const config = getPlanDisplay(subscription);
  const { status, cancelAtPeriodEnd, periodEnd, daysLeft, isTrial } =
    subscription;

  const handleUpgrade = async () => {
    setIsUpgrading(true);
    try {
      const { data } = await authClient.subscription.upgrade({
        plan: 'pro',
        successUrl: `${window.location.origin}/settings?tab=billing&upgraded=true`,
        cancelUrl: `${window.location.origin}/settings?tab=billing`,
      });
      if (data?.url) window.location.href = data.url;
    } finally {
      setIsUpgrading(false);
    }
  };

  const handlePortal = async () => {
    setIsPortalLoading(true);
    try {
      const { data } = await authClient.subscription.portal({
        returnUrl: `${window.location.origin}/settings?tab=billing`,
      });
      if (data?.url) window.location.href = data.url;
    } finally {
      setIsPortalLoading(false);
    }
  };

  const handleCancel = async () => {
    setIsCanceling(true);
    try {
      await authClient.subscription.cancel();
      setShowCancelDialog(false);
      window.location.reload();
    } finally {
      setIsCanceling(false);
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div
              className={cn(
                'flex size-10 shrink-0 items-center justify-center rounded-xl',
                status === 'past_due'
                  ? 'bg-red-500/10 text-red-500 dark:bg-red-500/15'
                  : status === 'trialing'
                    ? 'bg-amber-500/10 text-amber-500 dark:bg-amber-500/15'
                    : 'bg-indigo-500/10 text-indigo-500 dark:bg-indigo-500/15',
              )}
            >
              {config.icon}
            </div>
            <div>
              <CardTitle className="flex items-center gap-2">
                {config.title}
                <span
                  className={cn(
                    'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold uppercase',
                    config.badgeClasses,
                  )}
                >
                  {status === 'trialing'
                    ? 'Trial'
                    : status === 'past_due'
                      ? 'Past Due'
                      : 'Active'}
                </span>
              </CardTitle>
              <CardDescription
                className={cn(
                  status === 'past_due' && 'text-red-600 dark:text-red-400',
                )}
              >
                {config.subtitle}
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {/* Status details */}
          <div className="space-y-3">
            {isTrial && daysLeft !== null && (
              <div className="flex items-center justify-between rounded-lg bg-muted/50 px-4 py-3">
                <span className="text-sm text-muted-foreground">
                  Trial ends
                </span>
                <span className="text-sm font-medium">
                  {formatDate(periodEnd)}
                </span>
              </div>
            )}
            {status === 'active' && !cancelAtPeriodEnd && periodEnd && (
              <div className="flex items-center justify-between rounded-lg bg-muted/50 px-4 py-3">
                <span className="text-sm text-muted-foreground">
                  Next billing date
                </span>
                <span className="text-sm font-medium">
                  {formatDate(periodEnd)}
                </span>
              </div>
            )}
            {status === 'active' && cancelAtPeriodEnd && periodEnd && (
              <div className="flex items-center justify-between rounded-lg bg-amber-50 dark:bg-amber-900/10 px-4 py-3">
                <span className="text-sm text-muted-foreground">
                  Access until
                </span>
                <span className="text-sm font-medium">
                  {formatDate(periodEnd)}
                </span>
              </div>
            )}
            {status === 'past_due' && (
              <div className="flex items-center gap-2 rounded-lg bg-red-50 dark:bg-red-900/10 px-4 py-3">
                <IconAlertTriangle className="size-4 text-red-500 shrink-0" />
                <span className="text-sm text-red-700 dark:text-red-300">
                  Your payment method needs to be updated to avoid service
                  interruption.
                </span>
              </div>
            )}
          </div>

          {/* CTAs */}
          {canManageBilling ? (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              {/* Trialing: Upgrade + Manage billing */}
              {status === 'trialing' && (
                <>
                  <Button
                    onClick={handleUpgrade}
                    disabled={isUpgrading}
                    className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white dark:bg-indigo-600 dark:hover:bg-indigo-500"
                  >
                    {isUpgrading ? (
                      <>
                        <span className="size-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Redirecting...
                      </>
                    ) : (
                      <>
                        <IconCrown className="size-4" />
                        Upgrade to Pro
                      </>
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handlePortal}
                    disabled={isPortalLoading}
                    className="gap-2"
                  >
                    <IconExternalLink className="size-4" />
                    Manage billing
                  </Button>
                </>
              )}

              {/* Active: Manage billing + Cancel */}
              {status === 'active' && !cancelAtPeriodEnd && (
                <>
                  <Button
                    variant="outline"
                    onClick={handlePortal}
                    disabled={isPortalLoading}
                    className="gap-2"
                  >
                    <IconExternalLink className="size-4" />
                    Manage billing
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => setShowCancelDialog(true)}
                    className="gap-2 text-muted-foreground"
                  >
                    Cancel plan
                  </Button>
                </>
              )}

              {/* Active + Cancel pending: Reactivate + Manage billing */}
              {status === 'active' && cancelAtPeriodEnd && (
                <>
                  <Button
                    onClick={handleUpgrade}
                    disabled={isUpgrading}
                    className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white dark:bg-indigo-600 dark:hover:bg-indigo-500"
                  >
                    {isUpgrading ? (
                      <>
                        <span className="size-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Redirecting...
                      </>
                    ) : (
                      'Reactivate plan'
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handlePortal}
                    disabled={isPortalLoading}
                    className="gap-2"
                  >
                    <IconExternalLink className="size-4" />
                    Manage billing
                  </Button>
                </>
              )}

              {/* Past due: Update payment */}
              {status === 'past_due' && (
                <Button
                  onClick={handlePortal}
                  disabled={isPortalLoading}
                  className="gap-2 bg-red-600 hover:bg-red-700 text-white dark:bg-red-600 dark:hover:bg-red-500"
                >
                  {isPortalLoading ? (
                    <>
                      <span className="size-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Redirecting...
                    </>
                  ) : (
                    'Update payment method'
                  )}
                </Button>
              )}
            </div>
          ) : (
            <div className="mt-4 rounded-lg bg-muted/50 px-4 py-3 text-center">
              <p className="text-sm text-muted-foreground">
                Billing is managed by your workspace admin.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Cancel confirmation dialog */}
      <CancelPlanDialog
        open={showCancelDialog}
        onOpenChange={setShowCancelDialog}
        periodEnd={periodEnd}
        isCanceling={isCanceling}
        onCancel={handleCancel}
      />
    </>
  );
};
