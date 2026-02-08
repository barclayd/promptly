'use client';

import { IconShieldCheckFilled } from '@tabler/icons-react';
import { useState } from 'react';
import { useCanManageBilling } from '~/hooks/use-can-manage-billing';
import { useOrganizationId } from '~/hooks/use-organization-id';
import { markExpiredModalShown } from '~/hooks/use-trial-expired';
import { authClient } from '~/lib/auth.client';
import { cn } from '~/lib/utils';
import { ArrowUpIcon } from './ui/arrow-up-icon';
import { Button } from './ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from './ui/dialog';

interface TrialExpiredModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  promptCount: number;
  memberCount: number;
}

/*
 * Animation timing map (ms from modal open):
 *   0    — Shield icon badge-pop
 *   80   — Title fade-in-up
 *   160  — Description fade-in-up
 *   300  — "Data is safe" pill badge-pop
 *   400  — Table container fade-in-up
 *   460+ — Table rows stagger (80ms each)
 *   680  — CTA fade-in-up
 *   780  — Secondary CTA fade-in-up
 */

const stagger = (base: number, i: number, step = 60) => ({
  animationDelay: `${base + i * step}ms`,
  animationFillMode: 'forwards' as const,
});

const ComparisonTable = ({
  promptCount,
  memberCount,
}: {
  promptCount: number;
  memberCount: number;
}) => {
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
      data-slot="expired-comparison-table"
      className="overflow-hidden rounded-lg border border-border/60 opacity-0 animate-fade-in-up"
      style={stagger(400, 0)}
    >
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border/60 bg-muted/30">
            <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">
              Feature
            </th>
            <th className="px-3 py-2 text-left text-xs font-medium text-indigo-600 dark:text-indigo-400">
              Pro (Before)
            </th>
            <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">
              Free (Now)
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={row.feature}
              className="border-b border-border/40 last:border-0 opacity-0 animate-fade-in-up"
              style={stagger(460, i, 80)}
            >
              <td className="px-3 py-2 font-medium text-foreground/80">
                {row.feature}
              </td>
              <td className="px-3 py-2 text-foreground/70">{row.pro}</td>
              <td
                className={cn(
                  'px-3 py-2',
                  row.exceeds
                    ? 'font-medium text-amber-600 dark:text-amber-400'
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

export const TrialExpiredModal = ({
  open,
  onOpenChange,
  promptCount,
  memberCount,
}: TrialExpiredModalProps) => {
  const { canManageBilling } = useCanManageBilling();
  const organizationId = useOrganizationId();
  const [isUpgrading, setIsUpgrading] = useState(false);

  const handleDismiss = () => {
    if (organizationId) markExpiredModalShown(organizationId);
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
        data-slot="trial-expired-modal"
        className="sm:max-w-md gap-0 p-0 overflow-hidden"
      >
        {/* Header */}
        <div
          data-slot="expired-header"
          className="relative px-6 pt-6 pb-5 bg-gradient-to-b from-emerald-500/[0.06] to-transparent dark:from-emerald-500/[0.08]"
        >
          <div className="flex items-start gap-4">
            {/* Shield icon — badge-pop entrance */}
            <div
              className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 dark:bg-emerald-500/15 animate-badge-pop"
              style={stagger(0, 0)}
            >
              <IconShieldCheckFilled className="size-5 text-emerald-500 dark:text-emerald-400" />
            </div>
            <div className="space-y-1.5 min-w-0">
              {/* Title */}
              <DialogTitle
                className="text-base font-semibold leading-snug opacity-0 animate-fade-in-up"
                style={stagger(80, 0)}
              >
                Your Pro trial has ended
              </DialogTitle>
              {/* Description */}
              <DialogDescription
                className="text-sm text-muted-foreground leading-relaxed opacity-0 animate-fade-in-up"
                style={stagger(160, 0)}
              >
                Your workspace is now on the Free plan. Here's what changed:
              </DialogDescription>
            </div>
          </div>

          {/* Data safety pill — badge-pop */}
          <div className="mt-4">
            <span
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ring-1 bg-emerald-500/8 text-emerald-600 ring-emerald-500/15 dark:bg-emerald-500/10 dark:text-emerald-400 dark:ring-emerald-500/20 animate-badge-pop"
              style={stagger(300, 0)}
            >
              <IconShieldCheckFilled className="size-3" />
              Your data is safe — nothing has been deleted
            </span>
          </div>
        </div>

        {/* Comparison table */}
        <div data-slot="expired-content" className="px-6 py-5">
          <ComparisonTable
            promptCount={promptCount}
            memberCount={memberCount}
          />
        </div>

        {/* CTA area */}
        <div
          data-slot="expired-cta"
          className="px-6 pb-6 pt-1 flex flex-col items-center gap-3"
        >
          {canManageBilling ? (
            <div
              className="flex flex-col items-center gap-1.5 opacity-0 animate-fade-in-up"
              style={stagger(680, 0)}
            >
              <Button
                size="lg"
                className="px-8 bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-500/20 dark:bg-indigo-600 dark:hover:bg-indigo-500 dark:shadow-indigo-500/10"
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
                    Reactivate Pro — $29/mo
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
              style={stagger(680, 0)}
            >
              <p className="text-sm text-muted-foreground">
                Ask your workspace admin to reactivate Pro.
              </p>
            </div>
          )}
          <button
            type="button"
            onClick={handleDismiss}
            className="text-sm text-muted-foreground/60 underline underline-offset-4 decoration-muted-foreground/30 transition-colors hover:text-muted-foreground hover:decoration-muted-foreground/50 opacity-0 animate-fade-in-up"
            style={stagger(780, 0)}
          >
            Continue with Free
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
