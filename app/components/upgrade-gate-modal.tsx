'use client';

import {
  IconCheck,
  IconCrown,
  IconFileText,
  IconUsers,
} from '@tabler/icons-react';
import { useState } from 'react';
import { useCanManageBilling } from '~/hooks/use-can-manage-billing';
import { authClient } from '~/lib/auth.client';
import { cn } from '~/lib/utils';
import { Button } from './ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from './ui/dialog';

interface UpgradeGateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  resource: 'prompts' | 'team';
  current: number;
  limit: number;
}

const RESOURCE_CONFIG = {
  prompts: {
    icon: IconFileText,
    title: "You've reached your prompt limit",
    body: 'Free plans include 3 prompts. Upgrade to Pro for unlimited prompts and more.',
    features: [
      { label: 'Unlimited prompts', highlighted: true },
      { label: '5 team members', highlighted: false },
      { label: '50,000 API calls/mo', highlighted: false },
      { label: 'Version history', highlighted: false },
      { label: 'Priority support', highlighted: false },
    ],
  },
  team: {
    icon: IconUsers,
    title: 'Invite your team with Pro',
    body: 'Free plans include 1 team member. Upgrade to Pro to invite up to 5 team members.',
    features: [
      { label: '5 team members', highlighted: true },
      { label: 'Unlimited prompts', highlighted: false },
      { label: '50,000 API calls/mo', highlighted: false },
      { label: 'Version history', highlighted: false },
      { label: 'Priority support', highlighted: false },
    ],
  },
} as const;

export const UpgradeGateModal = ({
  open,
  onOpenChange,
  resource,
  current,
  limit,
}: UpgradeGateModalProps) => {
  const { canManageBilling } = useCanManageBilling();
  const [isUpgrading, setIsUpgrading] = useState(false);
  const config = RESOURCE_CONFIG[resource];
  const ResourceIcon = config.icon;

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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        data-slot="upgrade-gate-modal"
        className="sm:max-w-md gap-0 p-0 overflow-hidden"
      >
        {/* Header with gradient accent */}
        <div
          data-slot="upgrade-gate-header"
          className="relative px-6 pt-6 pb-5 bg-gradient-to-b from-indigo-500/[0.06] to-transparent dark:from-indigo-500/[0.08]"
        >
          <div className="flex items-start gap-4">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-indigo-500/10 dark:bg-indigo-500/15">
              <ResourceIcon className="size-5 text-indigo-500" />
            </div>
            <div className="space-y-1.5 min-w-0">
              <DialogTitle className="text-base font-semibold leading-snug">
                {config.title}
              </DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground leading-relaxed">
                {config.body}
              </DialogDescription>
            </div>
          </div>

          {/* Progress bar */}
          <div data-slot="upgrade-gate-progress" className="mt-4 space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">
                {current} of {limit} used
              </span>
              <span className="font-medium text-amber-600 dark:text-amber-400">
                Limit reached
              </span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-muted/60 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-amber-500 transition-all duration-600 ease-out"
                style={{
                  width: open ? '100%' : '0%',
                  transitionDuration: '600ms',
                }}
              />
            </div>
          </div>
        </div>

        {/* Feature list */}
        <div data-slot="upgrade-gate-features" className="px-6 py-5">
          <ul className="space-y-2.5">
            {config.features.map((feature, i) => (
              <li
                key={feature.label}
                className={cn(
                  'flex items-center gap-3 opacity-0 animate-fade-in-up',
                  feature.highlighted && 'font-medium',
                )}
                style={{
                  animationDelay: `${i * 60}ms`,
                  animationFillMode: 'forwards',
                }}
              >
                <div
                  className={cn(
                    'shrink-0 size-5 rounded-full flex items-center justify-center',
                    feature.highlighted
                      ? 'bg-indigo-500/15 dark:bg-indigo-500/20'
                      : 'bg-indigo-500/10',
                  )}
                >
                  <IconCheck
                    className={cn(
                      'size-3',
                      feature.highlighted
                        ? 'text-indigo-600 dark:text-indigo-400'
                        : 'text-indigo-500',
                    )}
                  />
                </div>
                <span
                  className={cn(
                    'text-sm',
                    feature.highlighted
                      ? 'text-foreground'
                      : 'text-foreground/80',
                  )}
                >
                  {feature.label}
                </span>
              </li>
            ))}
          </ul>
        </div>

        {/* CTA area */}
        <div
          data-slot="upgrade-gate-cta"
          className="px-6 pb-6 pt-1 flex flex-col gap-2"
        >
          {canManageBilling ? (
            <Button
              size="lg"
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-500/25 dark:bg-indigo-600 dark:hover:bg-indigo-500"
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
                  Upgrade to Pro &mdash; $29/mo
                </>
              )}
            </Button>
          ) : (
            <div className="text-center py-2 px-3 rounded-lg bg-muted/50">
              <p className="text-sm text-muted-foreground">
                Ask your workspace admin to upgrade to Pro.
              </p>
            </div>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="w-full text-muted-foreground"
            onClick={() => onOpenChange(false)}
          >
            Maybe later
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
