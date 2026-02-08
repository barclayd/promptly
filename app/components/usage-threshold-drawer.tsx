'use client';

import {
  IconAlertTriangle,
  IconFileText,
  IconUsers,
  IconX,
} from '@tabler/icons-react';
import { useState } from 'react';
import { useCanManageBilling } from '~/hooks/use-can-manage-billing';
import { useOrganizationId } from '~/hooks/use-organization-id';
import {
  permanentlyDismissThreshold,
  softDismissThreshold,
} from '~/hooks/use-usage-threshold-nudge';
import { authClient } from '~/lib/auth.client';
import { NumberTicker } from './landing/hero-demo/animations/number-ticker';
import { NotifyAdminButton } from './notify-admin-button';
import { ArrowUpIcon } from './ui/arrow-up-icon';
import { Button } from './ui/button';
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerTitle,
} from './ui/drawer';

interface UsageThresholdDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  metric: 'prompts' | 'team';
  count: number;
  limit: number;
}

export const UsageThresholdDrawer = ({
  open,
  onOpenChange,
  metric,
  count,
  limit,
}: UsageThresholdDrawerProps) => {
  const { canManageBilling } = useCanManageBilling();
  const organizationId = useOrganizationId();
  const [isUpgrading, setIsUpgrading] = useState(false);

  const percentage = Math.round((count / limit) * 100);

  const handlePermanentDismiss = () => {
    if (organizationId) permanentlyDismissThreshold(metric, organizationId);
    onOpenChange(false);
  };

  const handleSoftDismiss = () => {
    if (organizationId) softDismissThreshold(metric, organizationId);
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

  const description =
    metric === 'prompts'
      ? `You've used ${count} of ${limit} prompts. Upgrade to Pro for unlimited prompts.`
      : `You've filled ${count} of ${limit} team seats. Upgrade to Pro for up to 5 members.`;

  const nonAdminDescription =
    metric === 'prompts'
      ? `Your workspace has used ${count} of ${limit} prompts. Ask your admin to upgrade for unlimited prompts.`
      : `Your workspace has filled ${count} of ${limit} team seats. Ask your admin to upgrade for more seats.`;

  const MetricIcon = metric === 'prompts' ? IconFileText : IconUsers;
  const metricLabel = metric === 'prompts' ? 'prompts used' : 'seats filled';

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="md:left-[var(--sidebar-width)] overflow-hidden">
        {/* Full-width background gradient */}
        <div className="pointer-events-none absolute inset-x-0 -top-20 h-80 bg-gradient-to-b from-amber-500/6 via-orange-500/4 to-transparent blur-2xl dark:from-amber-500/10 dark:via-orange-500/6 dark:to-transparent" />

        {/* Close button */}
        <button
          type="button"
          onClick={handlePermanentDismiss}
          className="absolute right-4 top-4 z-10 rounded-full p-1.5 text-muted-foreground/60 transition-colors hover:bg-muted hover:text-muted-foreground"
          aria-label="Dismiss permanently"
        >
          <IconX className="size-4" />
        </button>

        {/* Header */}
        <div className="relative px-6 pt-2 pb-4">
          <div className="flex flex-col items-center text-center gap-3">
            {/* Gradient icon container */}
            <div className="flex size-12 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-500/10 to-orange-500/10 ring-1 ring-amber-500/10 dark:from-amber-500/15 dark:to-orange-500/15 dark:ring-amber-500/15">
              <IconAlertTriangle className="size-6 text-amber-500 dark:text-amber-400" />
            </div>

            {/* Gradient headline */}
            <DrawerTitle className="text-xl font-bold bg-gradient-to-r from-amber-500 via-orange-500 to-red-500 bg-clip-text text-transparent">
              Approaching your limit
            </DrawerTitle>

            <DrawerDescription className="text-sm text-muted-foreground leading-relaxed max-w-sm">
              {canManageBilling ? description : nonAdminDescription}
            </DrawerDescription>
          </div>
        </div>

        {/* Stat pills */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-2.5 px-6 pb-5">
          <span className="inline-flex items-center gap-2 rounded-full bg-amber-500/8 px-3.5 py-1.5 text-sm font-medium text-amber-600 ring-1 ring-amber-500/10 dark:bg-amber-500/10 dark:text-amber-400 dark:ring-amber-500/15">
            <MetricIcon className="size-3.5" />
            <NumberTicker value={count} duration={800} delay={600} />
            <span>{metricLabel}</span>
          </span>
          <span className="inline-flex items-center gap-2 rounded-full bg-orange-500/8 px-3.5 py-1.5 text-sm font-medium text-orange-600 ring-1 ring-orange-500/10 dark:bg-orange-500/10 dark:text-orange-400 dark:ring-orange-500/15">
            <span>
              <NumberTicker value={percentage} duration={800} delay={800} />% of
              limit
            </span>
          </span>
        </div>

        {/* CTA area */}
        <div className="px-6 pb-6 flex flex-col items-center gap-3">
          {canManageBilling ? (
            <div className="flex flex-col items-center gap-1.5">
              <Button
                size="lg"
                className="bg-amber-600 hover:bg-amber-700 text-white shadow-lg shadow-amber-500/20 px-8 dark:bg-amber-600 dark:hover:bg-amber-500 dark:shadow-amber-500/10"
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
            <NotifyAdminButton variant="block" context="usage_threshold" />
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
