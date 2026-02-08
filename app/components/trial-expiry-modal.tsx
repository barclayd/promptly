'use client';

import {
  IconAlertCircleFilled,
  IconAlertTriangle,
  IconArrowRight,
  IconClock,
} from '@tabler/icons-react';
import { useState } from 'react';
import { useCanManageBilling } from '~/hooks/use-can-manage-billing';
import { useOrganizationId } from '~/hooks/use-organization-id';
import {
  dismissTrialExpiryModal,
  type WarningLevel,
} from '~/hooks/use-trial-expiry-modal';
import { authClient } from '~/lib/auth.client';
import { cn } from '~/lib/utils';
import { NumberTicker } from './landing/hero-demo/animations/number-ticker';
import { NotifyAdminButton } from './notify-admin-button';
import { ArrowUpIcon } from './ui/arrow-up-icon';
import { Button } from './ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from './ui/dialog';

interface TrialExpiryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  warningLevel: WarningLevel;
  daysLeft: number;
  expiryDate: Date;
  promptCount: number;
  memberCount: number;
}

const VARIANT_CONFIG = {
  '5day': {
    icon: IconClock,
    accentClass: 'text-indigo-500 dark:text-indigo-400',
    iconBgClass: 'bg-indigo-500/10 dark:bg-indigo-500/15',
    headerGradient:
      'from-indigo-500/[0.06] to-transparent dark:from-indigo-500/[0.08]',
    pillClass:
      'bg-indigo-500/8 text-indigo-600 ring-indigo-500/15 dark:bg-indigo-500/10 dark:text-indigo-400 dark:ring-indigo-500/20',
    secondaryCta: 'Remind me later',
    showTable: false,
    showLossBullets: false,
  },
  '2day': {
    icon: IconAlertTriangle,
    accentClass: 'text-amber-500 dark:text-amber-400',
    iconBgClass: 'bg-amber-500/10 dark:bg-amber-500/15',
    headerGradient:
      'from-amber-500/[0.06] to-transparent dark:from-amber-500/[0.08]',
    pillClass:
      'bg-amber-500/8 text-amber-600 ring-amber-500/15 dark:bg-amber-500/10 dark:text-amber-400 dark:ring-amber-500/20',
    secondaryCta: "I'll decide later",
    showTable: true,
    showLossBullets: false,
  },
  lastday: {
    icon: IconAlertCircleFilled,
    accentClass: 'text-red-500 dark:text-red-400',
    iconBgClass: 'bg-red-500/10 dark:bg-red-500/15',
    headerGradient:
      'from-red-500/[0.06] to-transparent dark:from-red-500/[0.08]',
    pillClass:
      'bg-red-500/8 text-red-600 ring-red-500/15 dark:bg-red-500/10 dark:text-red-400 dark:ring-red-500/20',
    secondaryCta: 'Continue to Free plan',
    showTable: true,
    showLossBullets: true,
  },
} as const;

const getTitle = (warningLevel: WarningLevel, daysLeft: number) => {
  if (warningLevel === 'lastday') {
    return daysLeft === 0
      ? 'Your trial ends today'
      : 'Your trial ends tomorrow';
  }
  if (warningLevel === '2day') return 'Your Pro trial ends in 2 days';
  return `Your trial ends in ${daysLeft} days`;
};

const getBody = (warningLevel: WarningLevel, formattedDate: string) => {
  if (warningLevel === '5day') {
    return `Your Pro trial expires on ${formattedDate}. After that, your workspace moves to the Free plan.`;
  }
  if (warningLevel === '2day') {
    return `On ${formattedDate}, here's what changes for your workspace:`;
  }
  return `After ${formattedDate}, your workspace moves to the Free plan.`;
};

const formatDate = (date: Date) =>
  date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

/*
 * Animation timing map (ms from modal open):
 *   0    — Icon badge-pop
 *   80   — Title fade-in-up
 *   160  — Description fade-in-up
 *   300  — Date pill badge-pop
 *   400+ — Content items stagger (60ms each)
 *   600+ — CTA fade-in-up
 *   700  — "Cancel anytime" fade-in-up
 *   800  — Secondary CTA fade-in-up
 */

const stagger = (base: number, i: number, step = 60) => ({
  animationDelay: `${base + i * step}ms`,
  animationFillMode: 'forwards' as const,
});

const FreePlanBullets = ({
  promptCount,
  memberCount,
}: {
  promptCount: number;
  memberCount: number;
}) => (
  <div data-slot="expiry-free-limits" className="space-y-2">
    <p
      className="text-xs font-medium uppercase tracking-wider text-muted-foreground/70 opacity-0 animate-fade-in-up"
      style={stagger(400, 0)}
    >
      Free plan limits
    </p>
    <ul className="space-y-2">
      {[
        `3 prompts (you have ${promptCount})`,
        `1 team member (you have ${memberCount})`,
        '5,000 API calls/month',
      ].map((item, i) => (
        <li
          key={item}
          className="flex items-start gap-2.5 text-sm text-muted-foreground opacity-0 animate-fade-in-up"
          style={stagger(460, i)}
        >
          <IconArrowRight className="size-3.5 mt-0.5 shrink-0 text-muted-foreground/50" />
          {item}
        </li>
      ))}
    </ul>
  </div>
);

const LossBullets = ({
  promptCount,
  memberCount,
  accentClass,
}: {
  promptCount: number;
  memberCount: number;
  accentClass: string;
}) => {
  const promptsOver = promptCount - 3;
  const membersOver = memberCount - 1;

  const losses: {
    text: string;
    prefix: string;
    count: number;
    suffix: string;
  }[] = [];
  if (promptsOver > 0)
    losses.push({
      text: `${promptsOver} prompt${promptsOver === 1 ? '' : 's'} become read-only`,
      prefix: '',
      count: promptsOver,
      suffix: ` prompt${promptsOver === 1 ? '' : 's'} become read-only`,
    });
  if (membersOver > 0)
    losses.push({
      text: `${membersOver} member${membersOver === 1 ? '' : 's'} lose access`,
      prefix: '',
      count: membersOver,
      suffix: ` member${membersOver === 1 ? '' : 's'} lose access`,
    });

  if (losses.length === 0) return null;

  return (
    <div data-slot="expiry-loss-bullets" className="space-y-2">
      <p
        className="text-xs font-medium uppercase tracking-wider text-muted-foreground/70 opacity-0 animate-fade-in-up"
        style={stagger(400, 0)}
      >
        What you'll lose
      </p>
      <ul className="space-y-2">
        {losses.map((loss, i) => (
          <li
            key={loss.text}
            className={cn(
              'flex items-start gap-2.5 text-sm font-medium opacity-0 animate-fade-in-up',
              accentClass,
            )}
            style={stagger(460, i)}
          >
            <IconAlertTriangle className="size-3.5 mt-0.5 shrink-0" />
            <span>
              <NumberTicker
                value={loss.count}
                duration={800}
                delay={460 + i * 60}
              />
              {loss.suffix}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
};

const ComparisonTable = ({
  promptCount,
  memberCount,
  warningLevel,
}: {
  promptCount: number;
  memberCount: number;
  warningLevel: '2day' | 'lastday';
}) => {
  const isLastDay = warningLevel === 'lastday';
  const warnColor = isLastDay
    ? 'text-red-600 dark:text-red-400'
    : 'text-amber-600 dark:text-amber-400';
  const baseDelay = isLastDay ? 580 : 400;

  const rows = [
    {
      feature: 'Prompts',
      pro: `Unlimited (you have ${promptCount})`,
      free: '3',
      exceeds: promptCount > 3,
    },
    {
      feature: 'Team Members',
      pro: `5 (you have ${memberCount})`,
      free: '1',
      exceeds: memberCount > 1,
    },
    {
      feature: 'API Calls',
      pro: '50,000/mo',
      free: '5,000/mo',
      exceeds: false,
    },
  ];

  return (
    <div
      data-slot="expiry-comparison-table"
      className="overflow-hidden rounded-lg border border-border/60 opacity-0 animate-fade-in-up"
      style={stagger(baseDelay, 0)}
    >
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border/60 bg-muted/30">
            <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">
              Feature
            </th>
            <th className="px-3 py-2 text-left text-xs font-medium text-indigo-600 dark:text-indigo-400">
              Pro (Current)
            </th>
            <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">
              Free (After)
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={row.feature}
              className="border-b border-border/40 last:border-0 opacity-0 animate-fade-in-up"
              style={stagger(baseDelay + 60, i, 80)}
            >
              <td className="px-3 py-2 font-medium text-foreground/80">
                {row.feature}
              </td>
              <td className="px-3 py-2 text-foreground/70">{row.pro}</td>
              <td
                className={cn(
                  'px-3 py-2',
                  row.exceeds
                    ? cn('font-medium', warnColor)
                    : 'text-foreground/70',
                )}
              >
                {row.free}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export const TrialExpiryModal = ({
  open,
  onOpenChange,
  warningLevel,
  daysLeft,
  expiryDate,
  promptCount,
  memberCount,
}: TrialExpiryModalProps) => {
  const { canManageBilling } = useCanManageBilling();
  const organizationId = useOrganizationId();
  const [isUpgrading, setIsUpgrading] = useState(false);
  const config = VARIANT_CONFIG[warningLevel];
  const WarningIcon = config.icon;
  const formattedDate = formatDate(expiryDate);
  const isLastDay = warningLevel === 'lastday';

  const handleDismiss = () => {
    if (organizationId) dismissTrialExpiryModal(organizationId, warningLevel);
    onOpenChange(false);
  };

  const handleUpgrade = async () => {
    setIsUpgrading(true);
    try {
      const { data } = await authClient.subscription.upgrade({
        plan: 'pro',
        successUrl: `${window.location.origin}/dashboard?upgraded=true`,
        cancelUrl: window.location.href,
      });
      if (data?.url) window.location.href = data.url;
    } finally {
      setIsUpgrading(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) handleDismiss();
        else onOpenChange(v);
      }}
    >
      <DialogContent
        data-slot="trial-expiry-modal"
        className="sm:max-w-md gap-0 p-0 overflow-hidden"
      >
        {/* Header */}
        <div
          data-slot="expiry-header"
          className={cn(
            'relative px-6 pt-6 pb-5 bg-gradient-to-b',
            config.headerGradient,
          )}
        >
          <div className="flex items-start gap-4">
            {/* Icon — badge-pop entrance */}
            <div
              className={cn(
                'flex size-10 shrink-0 items-center justify-center rounded-xl animate-badge-pop',
                config.iconBgClass,
              )}
              style={stagger(0, 0)}
            >
              <WarningIcon className={cn('size-5', config.accentClass)} />
            </div>
            <div className="space-y-1.5 min-w-0">
              {/* Title — staggered fade-in-up */}
              <DialogTitle
                className="text-base font-semibold leading-snug opacity-0 animate-fade-in-up"
                style={stagger(80, 0)}
              >
                {getTitle(warningLevel, daysLeft)}
              </DialogTitle>
              {/* Description — staggered fade-in-up */}
              <DialogDescription
                className="text-sm text-muted-foreground leading-relaxed opacity-0 animate-fade-in-up"
                style={stagger(160, 0)}
              >
                {getBody(warningLevel, formattedDate)}
              </DialogDescription>
            </div>
          </div>

          {/* Expiry date pill — badge-pop with delay */}
          <div className="mt-4">
            <span
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ring-1 animate-badge-pop',
                config.pillClass,
              )}
              style={stagger(300, 0)}
            >
              <IconClock className="size-3" />
              Expires {formattedDate}
            </span>
          </div>
        </div>

        {/* Content area */}
        <div data-slot="expiry-content" className="px-6 py-5 space-y-4">
          {/* Loss bullets (last day only) */}
          {config.showLossBullets && (
            <LossBullets
              promptCount={promptCount}
              memberCount={memberCount}
              accentClass={config.accentClass}
            />
          )}

          {/* Comparison table (2-day and last day) */}
          {config.showTable && (
            <ComparisonTable
              promptCount={promptCount}
              memberCount={memberCount}
              warningLevel={warningLevel as '2day' | 'lastday'}
            />
          )}

          {/* Free plan bullet list (5-day only) */}
          {!config.showTable && (
            <FreePlanBullets
              promptCount={promptCount}
              memberCount={memberCount}
            />
          )}
        </div>

        {/* CTA area */}
        <div
          data-slot="expiry-cta"
          className="px-6 pb-6 pt-1 flex flex-col items-center gap-3"
        >
          {canManageBilling ? (
            <div
              className="flex flex-col items-center gap-1.5 opacity-0 animate-fade-in-up"
              style={stagger(700, 0)}
            >
              <Button
                size="lg"
                className={cn(
                  'px-8 bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg dark:bg-indigo-600 dark:hover:bg-indigo-500',
                  isLastDay
                    ? 'shadow-red-500/20 dark:shadow-red-500/15 animate-pulse-glow-red'
                    : 'shadow-indigo-500/20 dark:shadow-indigo-500/10',
                )}
                onClick={handleUpgrade}
                disabled={isUpgrading}
              >
                {isUpgrading ? (
                  <>
                    <span className="size-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Redirecting...
                  </>
                ) : (
                  <>
                    <ArrowUpIcon size={16} />
                    Upgrade to Pro — $29/mo
                  </>
                )}
              </Button>
              <span className="text-xs text-muted-foreground/60">
                Cancel anytime
              </span>
            </div>
          ) : (
            <NotifyAdminButton
              variant="block"
              context="trial_expiry"
              className="opacity-0 animate-fade-in-up"
              style={stagger(700, 0)}
            />
          )}
          <button
            type="button"
            onClick={handleDismiss}
            className="text-sm text-muted-foreground/60 underline underline-offset-4 decoration-muted-foreground/30 transition-colors hover:text-muted-foreground hover:decoration-muted-foreground/50 opacity-0 animate-fade-in-up"
            style={stagger(800, 0)}
          >
            {config.secondaryCta}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
