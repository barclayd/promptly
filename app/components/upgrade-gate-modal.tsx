'use client';

import {
  IconApi,
  IconCheck,
  IconFileText,
  IconSparkles,
  IconUsers,
} from '@tabler/icons-react';
import { useState } from 'react';
import { useCanManageBilling } from '~/hooks/use-can-manage-billing';
import { useResourceLimits } from '~/hooks/use-resource-limits';
import { authClient } from '~/lib/auth.client';
import { cn } from '~/lib/utils';
import { NotifyAdminButton } from './notify-admin-button';
import { ArrowUpIcon } from './ui/arrow-up-icon';
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
  resource: 'prompts' | 'team' | 'api-calls' | 'general';
  current?: number;
  limit?: number;
}

const RESOURCE_CONFIG = {
  prompts: {
    icon: IconFileText,
    title: 'Unlock unlimited prompts',
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
    title: 'Grow your team with Pro',
    features: [
      { label: '5 team members', highlighted: true },
      { label: 'Unlimited prompts', highlighted: false },
      { label: '50,000 API calls/mo', highlighted: false },
      { label: 'Version history', highlighted: false },
      { label: 'Priority support', highlighted: false },
    ],
  },
  'api-calls': {
    icon: IconApi,
    title: 'Unlock more API calls',
    features: [
      { label: '50,000 API calls/mo', highlighted: true },
      { label: 'Unlimited prompts', highlighted: false },
      { label: '5 team members', highlighted: false },
      { label: 'Version history', highlighted: false },
      { label: 'Priority support', highlighted: false },
    ],
  },
  general: {
    icon: IconSparkles,
    title: 'Unlock the full experience',
    features: [
      { label: 'Unlimited prompts', highlighted: true },
      { label: '5 team members', highlighted: true },
      { label: '50,000 API calls/mo', highlighted: false },
      { label: 'Version history', highlighted: false },
      { label: 'Priority support', highlighted: false },
    ],
  },
} as const;

const getBody = (
  resource: 'prompts' | 'team' | 'api-calls' | 'general',
  current?: number,
) => {
  if (resource === 'prompts') {
    return `You've created ${current ?? 0} prompts — nice work. Go unlimited with Pro.`;
  }
  if (resource === 'team') {
    return 'Your team is growing. Upgrade to invite up to 5 members.';
  }
  if (resource === 'api-calls') {
    return `You've used ${(current ?? 0).toLocaleString()} API calls this month. Upgrade for 10x more capacity.`;
  }
  return 'Pro gives you room to build without limits.';
};

export const UpgradeGateModal = ({
  open,
  onOpenChange,
  resource,
  current,
  limit,
}: UpgradeGateModalProps) => {
  const { canManageBilling } = useCanManageBilling();
  const { promptCount, promptLimit, memberCount, memberLimit } =
    useResourceLimits();
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

  const isGeneral = resource === 'general';
  const ctaLabel = isGeneral
    ? 'Get Pro \u2014 $29/mo'
    : 'Unlock Unlimited \u2014 $29/mo';

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
                {getBody(resource, current)}
              </DialogDescription>
            </div>
          </div>

          {/* Progress bar for limit-gated resources */}
          {!isGeneral && current != null && limit != null && (
            <div data-slot="upgrade-gate-progress" className="mt-4 space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">
                  {resource === 'api-calls'
                    ? `${(current ?? 0).toLocaleString()} API calls used`
                    : `${current} ${resource === 'prompts' ? 'prompts created' : 'members'}`}
                </span>
                <span className="font-medium text-amber-600 dark:text-amber-400">
                  Ready for more
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
          )}

          {/* Usage summary for general upgrade */}
          {isGeneral && (
            <div data-slot="upgrade-gate-usage" className="mt-4 flex gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-muted/60 px-2.5 py-1 text-xs text-muted-foreground">
                <IconFileText className="size-3" />
                {promptCount} of {promptLimit === -1 ? '∞' : promptLimit}{' '}
                prompts
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-muted/60 px-2.5 py-1 text-xs text-muted-foreground">
                <IconUsers className="size-3" />
                {memberCount} of {memberLimit === -1 ? '∞' : memberLimit}{' '}
                members
              </span>
            </div>
          )}
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
            <div className="flex flex-col items-center gap-1">
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
                    <ArrowUpIcon size={16} />
                    {ctaLabel}
                  </>
                )}
              </Button>
              <span className="text-xs text-muted-foreground">
                Cancel anytime
              </span>
            </div>
          ) : (
            <NotifyAdminButton variant="block" context="prompt_limit" />
          )}
          <Button
            variant="ghost"
            size="sm"
            className="w-full text-muted-foreground"
            onClick={() => onOpenChange(false)}
          >
            Stay on Free
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
