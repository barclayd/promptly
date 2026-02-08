'use client';

import {
  IconArrowDown,
  IconArrowRight,
  IconBulb,
  IconFileText,
  IconRocket,
  IconSparkles,
  IconUsers,
} from '@tabler/icons-react';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useCanManageBilling } from '~/hooks/use-can-manage-billing';
import { useOrganizationId } from '~/hooks/use-organization-id';
import {
  dismissWinback,
  markWinbackShown,
  type WinbackSegment,
} from '~/hooks/use-winback-modal';
import { authClient } from '~/lib/auth.client';
import { cn } from '~/lib/utils';
import { NumberTicker } from './landing/hero-demo/animations/number-ticker';
import { ArrowUpIcon } from './ui/arrow-up-icon';
import { Button } from './ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from './ui/dialog';

interface WinbackModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  segment: WinbackSegment;
  promptCount: number;
  memberCount: number;
}

const VARIANT_CONFIG = {
  power: {
    icon: IconSparkles,
    accentClass: 'text-indigo-500 dark:text-indigo-400',
    iconBgClass: 'bg-indigo-500/10 dark:bg-indigo-500/15',
    headerGradient:
      'from-indigo-500/[0.06] to-transparent dark:from-indigo-500/[0.08]',
    pillClass:
      'bg-indigo-500/8 text-indigo-600 ring-indigo-500/15 dark:bg-indigo-500/10 dark:text-indigo-400 dark:ring-indigo-500/20',
    title: 'Welcome back',
    secondaryCta: 'Continue with Free',
    ctaClass:
      'bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-600 dark:hover:bg-indigo-500 shadow-indigo-500/20 dark:shadow-indigo-500/10',
  },
  partial: {
    icon: IconRocket,
    accentClass: 'text-purple-500 dark:text-purple-400',
    iconBgClass: 'bg-purple-500/10 dark:bg-purple-500/15',
    headerGradient:
      'from-purple-500/[0.06] to-transparent dark:from-purple-500/[0.08]',
    pillClass:
      'bg-purple-500/8 text-purple-600 ring-purple-500/15 dark:bg-purple-500/10 dark:text-purple-400 dark:ring-purple-500/20',
    title: 'Pick up where you left off',
    secondaryCta: 'Continue with Free',
    ctaClass:
      'bg-purple-600 hover:bg-purple-700 dark:bg-purple-600 dark:hover:bg-purple-500 shadow-purple-500/20 dark:shadow-purple-500/10',
  },
  ghost: {
    icon: IconBulb,
    accentClass: 'text-teal-500 dark:text-teal-400',
    iconBgClass: 'bg-teal-500/10 dark:bg-teal-500/15',
    headerGradient:
      'from-teal-500/[0.06] to-transparent dark:from-teal-500/[0.08]',
    pillClass:
      'bg-teal-500/8 text-teal-600 ring-teal-500/15 dark:bg-teal-500/10 dark:text-teal-400 dark:ring-teal-500/20',
    title: 'Ready to try Promptly?',
    secondaryCta: 'Maybe later',
    ctaClass:
      'bg-teal-600 hover:bg-teal-700 dark:bg-teal-600 dark:hover:bg-teal-500 shadow-teal-500/20 dark:shadow-teal-500/10',
  },
} as const;

const getBody = (segment: WinbackSegment) => {
  if (segment === 'power')
    return 'are right where you left them. Upgrade to Pro to keep building.';
  if (segment === 'partial')
    return 'Your workspace started something great. Upgrade to Pro to keep creating.';
  return 'Create your first prompt and see how easy prompt management can be.';
};

/*
 * Animation timing map (ms from modal open):
 *   0    — Icon badge-pop
 *   80   — Title fade-in-up
 *   160  — Description fade-in-up
 *   300  — Stat pills / badge-pop content
 *   400+ — Content items stagger (60ms each)
 *   700  — CTA fade-in-up
 *   800  — Secondary + dismiss fade-in-up
 */

const stagger = (base: number, i: number, step = 60) => ({
  animationDelay: `${base + i * step}ms`,
  animationFillMode: 'forwards' as const,
});

const PowerContent = ({
  promptCount,
  memberCount,
}: {
  promptCount: number;
  memberCount: number;
}) => {
  const promptsOver = promptCount > 3;
  const membersOver = memberCount > 1;

  const rows = [
    {
      icon: IconFileText,
      label: 'Prompts',
      current: promptCount,
      free: 3,
      exceeds: promptsOver,
    },
    {
      icon: IconUsers,
      label: 'Team members',
      current: memberCount,
      free: 1,
      exceeds: membersOver,
    },
  ];

  return (
    <div data-slot="winback-stats" className="space-y-2">
      <p
        className="text-xs font-medium uppercase tracking-wider text-muted-foreground/70 opacity-0 animate-fade-in-up"
        style={stagger(400, 0)}
      >
        On the Free plan
      </p>
      <div className="space-y-2">
        {rows.map((row, i) => (
          <div
            key={row.label}
            className="flex items-center gap-3 rounded-lg bg-muted/40 ring-1 ring-border/50 px-3 py-2.5 opacity-0 animate-fade-in-up"
            style={stagger(460, i)}
          >
            <row.icon className="size-4 shrink-0 text-muted-foreground/60" />
            <span className="text-sm text-foreground/80 flex-1">
              {row.label}
            </span>
            <span className="flex items-center gap-1.5 text-sm">
              <span className="font-medium text-foreground/70">
                <NumberTicker
                  value={row.current}
                  duration={800}
                  delay={460 + i * 60}
                />
              </span>
              <IconArrowDown
                className={cn(
                  'size-3',
                  row.exceeds
                    ? 'text-amber-500 dark:text-amber-400'
                    : 'text-muted-foreground/40',
                )}
              />
              <span
                className={cn(
                  'font-medium',
                  row.exceeds
                    ? 'text-amber-600 dark:text-amber-400'
                    : 'text-muted-foreground/60',
                )}
              >
                {row.free}
              </span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

const PartialContent = () => (
  <div data-slot="winback-features" className="space-y-2">
    <p
      className="text-xs font-medium uppercase tracking-wider text-muted-foreground/70 opacity-0 animate-fade-in-up"
      style={stagger(400, 0)}
    >
      Pro includes
    </p>
    <ul className="space-y-2">
      {['Unlimited prompts', '5 team members', '50,000 API calls/month'].map(
        (item, i) => (
          <li
            key={item}
            className="flex items-start gap-2.5 text-sm text-muted-foreground opacity-0 animate-fade-in-up"
            style={stagger(460, i)}
          >
            <IconArrowRight className="size-3.5 mt-0.5 shrink-0 text-purple-400/60 dark:text-purple-400/50" />
            {item}
          </li>
        ),
      )}
    </ul>
  </div>
);

const GhostContent = () => (
  <div data-slot="winback-steps" className="space-y-2">
    <p
      className="text-xs font-medium uppercase tracking-wider text-muted-foreground/70 opacity-0 animate-fade-in-up"
      style={stagger(400, 0)}
    >
      Get started in 3 steps
    </p>
    <ol className="space-y-2">
      {[
        'Create a prompt',
        'Add variables for dynamic content',
        'Test with real data',
      ].map((item, i) => (
        <li
          key={item}
          className="flex items-start gap-2.5 text-sm text-muted-foreground opacity-0 animate-fade-in-up"
          style={stagger(460, i)}
        >
          <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-teal-500/10 text-[11px] font-semibold text-teal-600 dark:bg-teal-500/15 dark:text-teal-400">
            {i + 1}
          </span>
          {item}
        </li>
      ))}
    </ol>
  </div>
);

export const WinbackModal = ({
  open,
  onOpenChange,
  segment,
  promptCount,
  memberCount,
}: WinbackModalProps) => {
  const { canManageBilling } = useCanManageBilling();
  const organizationId = useOrganizationId();
  const navigate = useNavigate();
  const [isUpgrading, setIsUpgrading] = useState(false);
  const config = VARIANT_CONFIG[segment];
  const SegmentIcon = config.icon;
  const isGhost = segment === 'ghost';

  const handleClose = () => {
    if (organizationId) markWinbackShown(organizationId);
    onOpenChange(false);
  };

  const handleDismissForever = () => {
    if (organizationId) {
      markWinbackShown(organizationId);
      dismissWinback(organizationId);
    }
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

  const handleGhostCta = () => {
    handleClose();
    navigate('/prompts');
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) handleClose();
        else onOpenChange(v);
      }}
    >
      <DialogContent
        data-slot="winback-modal"
        className="sm:max-w-md gap-0 p-0 overflow-hidden"
      >
        {/* Header */}
        <div
          data-slot="winback-header"
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
              <SegmentIcon className={cn('size-5', config.accentClass)} />
            </div>
            <div className="space-y-1.5 min-w-0">
              {/* Title — staggered fade-in-up */}
              <DialogTitle
                className="text-base font-semibold leading-snug opacity-0 animate-fade-in-up"
                style={stagger(80, 0)}
              >
                {config.title}
              </DialogTitle>
              {/* Description — staggered fade-in-up */}
              <DialogDescription
                className="text-sm text-muted-foreground leading-relaxed opacity-0 animate-fade-in-up"
                style={stagger(160, 0)}
              >
                {segment === 'power' ? (
                  <>
                    {"Your workspace's "}
                    <NumberTicker
                      value={promptCount}
                      duration={600}
                      delay={160}
                      className="font-medium text-foreground"
                    />
                    {` ${promptCount === 1 ? 'prompt is' : 'prompts are'} right where you left ${promptCount === 1 ? 'it' : 'them'}. Upgrade to Pro to keep building.`}
                  </>
                ) : (
                  getBody(segment)
                )}
              </DialogDescription>
            </div>
          </div>
        </div>

        {/* Content area */}
        <div data-slot="winback-content" className="px-6 py-5">
          {segment === 'power' && (
            <PowerContent promptCount={promptCount} memberCount={memberCount} />
          )}
          {segment === 'partial' && <PartialContent />}
          {segment === 'ghost' && <GhostContent />}
        </div>

        {/* CTA area */}
        <div
          data-slot="winback-cta"
          className="px-6 pb-6 pt-1 flex flex-col items-center gap-3"
        >
          {/* Primary CTA */}
          {isGhost ? (
            <div
              className="opacity-0 animate-fade-in-up"
              style={stagger(700, 0)}
            >
              <Button
                size="lg"
                className={cn('px-8 text-white shadow-lg', config.ctaClass)}
                onClick={handleGhostCta}
              >
                <IconArrowRight className="size-4" />
                Create a prompt
              </Button>
            </div>
          ) : canManageBilling ? (
            <div
              className="flex flex-col items-center gap-1.5 opacity-0 animate-fade-in-up"
              style={stagger(700, 0)}
            >
              <Button
                size="lg"
                className={cn('px-8 text-white shadow-lg', config.ctaClass)}
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
                    Upgrade to Pro
                  </>
                )}
              </Button>
              <span className="text-xs text-muted-foreground/60">
                Cancel anytime
              </span>
            </div>
          ) : (
            <div
              className="text-center py-3 px-4 rounded-xl bg-muted/50 ring-1 ring-border/50 opacity-0 animate-fade-in-up"
              style={stagger(700, 0)}
            >
              <p className="text-sm text-muted-foreground">
                Ask your workspace admin about upgrading.
              </p>
            </div>
          )}

          {/* Secondary CTA */}
          <button
            type="button"
            onClick={handleClose}
            className="text-sm text-muted-foreground/60 underline underline-offset-4 decoration-muted-foreground/30 transition-colors hover:text-muted-foreground hover:decoration-muted-foreground/50 opacity-0 animate-fade-in-up"
            style={stagger(800, 0)}
          >
            {config.secondaryCta}
          </button>

          {/* Permanent dismiss */}
          <button
            type="button"
            onClick={handleDismissForever}
            className="text-xs text-muted-foreground/40 transition-colors hover:text-muted-foreground/60 opacity-0 animate-fade-in-up"
            style={stagger(860, 0)}
          >
            Don't show this again
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
