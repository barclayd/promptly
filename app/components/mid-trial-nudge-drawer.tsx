'use client';

import {
  IconCrown,
  IconFileText,
  IconHourglass,
  IconX,
} from '@tabler/icons-react';
import { useState } from 'react';
import { useCanManageBilling } from '~/hooks/use-can-manage-billing';
import {
  permanentlyDismissNudge,
  softDismissNudge,
} from '~/hooks/use-mid-trial-nudge';
import { useOrganizationId } from '~/hooks/use-organization-id';
import { authClient } from '~/lib/auth.client';
import { NumberTicker } from './landing/hero-demo/animations/number-ticker';
import { Button } from './ui/button';
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerTitle,
} from './ui/drawer';

interface MidTrialNudgeDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  daysLeft: number;
  promptCount: number;
}

export const MidTrialNudgeDrawer = ({
  open,
  onOpenChange,
  daysLeft,
  promptCount,
}: MidTrialNudgeDrawerProps) => {
  const { canManageBilling } = useCanManageBilling();
  const organizationId = useOrganizationId();
  const [isUpgrading, setIsUpgrading] = useState(false);

  const handlePermanentDismiss = () => {
    if (organizationId) permanentlyDismissNudge(organizationId);
    onOpenChange(false);
  };

  const handleSoftDismiss = () => {
    if (organizationId) softDismissNudge(organizationId);
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
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="md:left-[var(--sidebar-width)]">
        {/* Close button */}
        <button
          type="button"
          onClick={handlePermanentDismiss}
          className="absolute right-4 top-4 z-10 rounded-full p-1.5 text-muted-foreground/60 transition-colors hover:bg-muted hover:text-muted-foreground"
          aria-label="Dismiss permanently"
        >
          <IconX className="size-4" />
        </button>

        {/* Header with gradient orb */}
        <div className="relative overflow-hidden px-6 pt-2 pb-4">
          {/* Subtle background orb */}
          <div className="pointer-events-none absolute -top-20 left-1/2 -translate-x-1/2 size-64 rounded-full bg-gradient-to-br from-indigo-500/8 via-purple-500/6 to-pink-500/4 blur-3xl dark:from-indigo-500/12 dark:via-purple-500/8 dark:to-pink-500/6" />

          <div className="relative flex flex-col items-center text-center gap-3">
            {/* Gradient icon container */}
            <div className="flex size-12 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500/10 to-purple-500/10 ring-1 ring-indigo-500/10 dark:from-indigo-500/15 dark:to-purple-500/15 dark:ring-indigo-500/15">
              <IconCrown className="size-6 text-indigo-500 dark:text-indigo-400" />
            </div>

            {/* Gradient headline */}
            <DrawerTitle className="text-xl font-bold bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 bg-clip-text text-transparent">
              You're on a roll!
            </DrawerTitle>

            <DrawerDescription className="text-sm text-muted-foreground leading-relaxed max-w-sm">
              {canManageBilling
                ? `You've created ${promptCount} prompts so far — nice work. Go unlimited with Pro and keep building without limits.`
                : `Your team has created ${promptCount} prompts so far. Ask your admin to upgrade before the trial ends in ${daysLeft} days.`}
            </DrawerDescription>
          </div>
        </div>

        {/* Stat pills */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-2.5 px-6 pb-5">
          <span className="inline-flex items-center gap-2 rounded-full bg-indigo-500/8 px-3.5 py-1.5 text-sm font-medium text-indigo-600 ring-1 ring-indigo-500/10 dark:bg-indigo-500/10 dark:text-indigo-400 dark:ring-indigo-500/15">
            <IconFileText className="size-3.5" />
            <NumberTicker value={promptCount} duration={800} delay={600} />
            <span>prompts created</span>
          </span>
          <span className="inline-flex items-center gap-2 rounded-full bg-purple-500/8 px-3.5 py-1.5 text-sm font-medium text-purple-600 ring-1 ring-purple-500/10 dark:bg-purple-500/10 dark:text-purple-400 dark:ring-purple-500/15">
            <IconHourglass className="size-3.5" />
            <NumberTicker value={daysLeft} duration={800} delay={800} />
            <span>days left</span>
          </span>
        </div>

        {/* CTA area */}
        <div className="px-6 pb-6 flex flex-col items-center gap-3">
          {canManageBilling ? (
            <div className="flex flex-col items-center gap-1.5">
              <Button
                size="lg"
                className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-500/20 px-8 dark:bg-indigo-600 dark:hover:bg-indigo-500 dark:shadow-indigo-500/10"
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
                    <IconCrown className="size-4" />
                    Upgrade to Pro — $29/mo
                  </>
                )}
              </Button>
              <span className="text-xs text-muted-foreground/60">
                Cancel anytime
              </span>
            </div>
          ) : (
            <div className="text-center py-3 px-4 rounded-xl bg-muted/50 ring-1 ring-border/50">
              <p className="text-sm text-muted-foreground">
                Ask your workspace admin to upgrade to Pro.
              </p>
            </div>
          )}
          <DrawerClose asChild>
            <button
              type="button"
              onClick={handleSoftDismiss}
              className="text-sm text-muted-foreground/60 underline underline-offset-4 decoration-muted-foreground/30 transition-colors hover:text-muted-foreground hover:decoration-muted-foreground/50"
            >
              Remind me in 3 days
            </button>
          </DrawerClose>
        </div>
      </DrawerContent>
    </Drawer>
  );
};
