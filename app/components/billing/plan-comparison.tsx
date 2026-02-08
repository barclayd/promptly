'use client';

import { IconCheck, IconSparkles, IconX } from '@tabler/icons-react';
import { useState } from 'react';
import { useCanManageBilling } from '~/hooks/use-can-manage-billing';
import { useSubscription } from '~/hooks/use-subscription';
import { authClient } from '~/lib/auth.client';
import { cn } from '~/lib/utils';
import { ArrowUpIcon } from '../ui/arrow-up-icon';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';

const FREE_FEATURES = [
  { label: '3 prompts', included: true },
  { label: '1 team member', included: true },
  { label: '5,000 API calls/mo', included: true },
  { label: 'Version history', included: true },
  { label: 'Priority support', included: false },
];

const PRO_FEATURES = [
  { label: 'Unlimited prompts', included: true },
  { label: '5 team members', included: true },
  { label: '50,000 API calls/mo', included: true },
  { label: 'Version history', included: true },
  { label: 'Priority support', included: true },
];

export const PlanComparison = () => {
  const { subscription } = useSubscription();
  const { canManageBilling } = useCanManageBilling();
  const [isUpgrading, setIsUpgrading] = useState(false);

  const currentPlan = subscription?.plan ?? 'free';
  const isActive =
    subscription?.status === 'active' && !subscription.cancelAtPeriodEnd;

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

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {/* Free Plan */}
      <Card
        className={cn(
          'relative',
          currentPlan === 'free' && 'ring-2 ring-border',
        )}
      >
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <IconSparkles className="size-4 text-muted-foreground" />
              Free
            </CardTitle>
            {currentPlan === 'free' && (
              <span className="inline-flex items-center rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-muted-foreground">
                Current plan
              </span>
            )}
          </div>
          <p className="text-2xl font-bold">
            $0
            <span className="text-sm font-normal text-muted-foreground">
              /month
            </span>
          </p>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2.5">
            {FREE_FEATURES.map((feature) => (
              <li key={feature.label} className="flex items-center gap-2.5">
                {feature.included ? (
                  <IconCheck className="size-4 text-muted-foreground shrink-0" />
                ) : (
                  <IconX className="size-4 text-muted-foreground/40 shrink-0" />
                )}
                <span
                  className={cn(
                    'text-sm',
                    !feature.included && 'text-muted-foreground/60',
                  )}
                >
                  {feature.label}
                </span>
              </li>
            ))}
          </ul>
          {currentPlan === 'free' && (
            <div className="mt-5">
              <Button variant="outline" className="w-full" disabled>
                Current plan
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pro Plan */}
      <Card
        className={cn(
          'relative',
          currentPlan === 'pro' && isActive
            ? 'ring-2 ring-indigo-500/50'
            : 'border-indigo-200 dark:border-indigo-500/30',
        )}
      >
        {/* Recommended badge */}
        {currentPlan !== 'pro' && (
          <div className="absolute -top-3 left-1/2 -translate-x-1/2">
            <span className="inline-flex items-center rounded-full bg-indigo-600 px-3 py-0.5 text-xs font-medium text-white shadow-sm">
              Recommended
            </span>
          </div>
        )}
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <ArrowUpIcon size={16} className="text-indigo-500" />
              Pro
            </CardTitle>
            {currentPlan === 'pro' && isActive && (
              <span className="inline-flex items-center rounded-full bg-indigo-100 dark:bg-indigo-900/40 px-2 py-0.5 text-xs font-medium text-indigo-700 dark:text-indigo-300">
                Current plan
              </span>
            )}
          </div>
          <p className="text-2xl font-bold">
            $29
            <span className="text-sm font-normal text-muted-foreground">
              /month
            </span>
          </p>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2.5">
            {PRO_FEATURES.map((feature) => (
              <li key={feature.label} className="flex items-center gap-2.5">
                <IconCheck className="size-4 text-indigo-500 shrink-0" />
                <span className="text-sm">{feature.label}</span>
              </li>
            ))}
          </ul>
          {currentPlan === 'pro' && isActive ? (
            <div className="mt-5">
              <Button variant="outline" className="w-full" disabled>
                Current plan
              </Button>
            </div>
          ) : canManageBilling ? (
            <div className="mt-5">
              <Button
                className="w-full gap-2 bg-indigo-600 hover:bg-indigo-700 text-white dark:bg-indigo-600 dark:hover:bg-indigo-500"
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
            </div>
          ) : (
            <div className="mt-5">
              <div className="rounded-lg bg-muted/50 px-3 py-2 text-center">
                <p className="text-xs text-muted-foreground">
                  Ask your workspace admin to upgrade.
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
