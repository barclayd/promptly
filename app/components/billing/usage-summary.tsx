'use client';

import {
  IconApi,
  IconArrowRight,
  IconCheck,
  IconFileText,
  IconUsers,
} from '@tabler/icons-react';
import { Link } from 'react-router';
import { Card, CardContent } from '~/components/ui/card';
import { useCanManageBilling } from '~/hooks/use-can-manage-billing';
import { useResourceLimits } from '~/hooks/use-resource-limits';
import { cn } from '~/lib/utils';
import { NotifyAdminButton } from '../notify-admin-button';

const getBarColor = (percentage: number): string => {
  if (percentage >= 0.8) return 'bg-red-500';
  if (percentage >= 0.6) return 'bg-amber-500';
  return 'bg-emerald-500';
};

type UsageRowProps = {
  icon: React.ReactNode;
  label: string;
  count: number;
  limit: number;
};

const UsageRow = ({ icon, label, count, limit }: UsageRowProps) => {
  const isUnlimited = limit === -1;
  const percentage = isUnlimited ? 0 : limit === 0 ? 1 : count / limit;
  const isAtLimit = !isUnlimited && count >= limit;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="flex items-center gap-2 text-muted-foreground">
          {icon}
          {label}
        </span>
        {isUnlimited ? (
          <span className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
            <IconCheck className="size-3" />
            Unlimited
          </span>
        ) : (
          <span
            className={cn(
              'tabular-nums text-xs',
              isAtLimit ? 'font-medium text-red-500' : 'text-muted-foreground',
            )}
          >
            {count.toLocaleString()} of {limit.toLocaleString()}
          </span>
        )}
      </div>
      {!isUnlimited && (
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className={cn(
              'h-full rounded-full transition-all duration-500',
              getBarColor(percentage),
            )}
            style={{ width: `${Math.min(percentage * 100, 100)}%` }}
          />
        </div>
      )}
    </div>
  );
};

export const UsageSummary = () => {
  const {
    promptCount,
    promptLimit,
    memberCount,
    memberLimit,
    apiCallCount,
    apiCallLimit,
    plan,
  } = useResourceLimits();
  const { canManageBilling } = useCanManageBilling();

  const promptsAtLimit = promptLimit !== -1 && promptCount >= promptLimit;
  const membersAtLimit = memberLimit !== -1 && memberCount >= memberLimit;
  const apiCallsAtLimit = apiCallLimit !== -1 && apiCallCount >= apiCallLimit;
  const anyAtLimit = promptsAtLimit || membersAtLimit || apiCallsAtLimit;
  const showContextual = plan === 'free' && anyAtLimit;

  return (
    <Card className="py-4">
      <CardContent className="space-y-4">
        <UsageRow
          icon={<IconFileText className="size-3.5" />}
          label="Prompts"
          count={promptCount}
          limit={promptLimit}
        />
        <UsageRow
          icon={<IconUsers className="size-3.5" />}
          label="Team Members"
          count={memberCount}
          limit={memberLimit}
        />
        <UsageRow
          icon={<IconApi className="size-3.5" />}
          label="API Calls"
          count={apiCallCount}
          limit={apiCallLimit}
        />
        <div className="flex flex-col gap-1.5 pt-1">
          {showContextual &&
            (canManageBilling ? (
              <p className="text-xs text-amber-500">
                Upgrade to unlock higher limits
              </p>
            ) : (
              <NotifyAdminButton
                variant="inline"
                context="usage_limit"
                className="ml-0 text-xs text-amber-500"
              />
            ))}
          <div className="flex justify-end">
            <Link
              to="/analytics"
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              View details
              <IconArrowRight className="size-3" />
            </Link>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
