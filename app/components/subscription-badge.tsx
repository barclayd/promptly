import {
  IconAlertTriangle,
  IconChevronRight,
  IconCircleCheck,
  IconClock,
  IconSparkles,
} from '@tabler/icons-react';
import { type ReactNode, useState } from 'react';
import { NavLink } from 'react-router';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '~/components/ui/tooltip';
import { useCanManageBilling } from '~/hooks/use-can-manage-billing';
import { useSubscription } from '~/hooks/use-subscription';
import type { SubscriptionStatus } from '~/plugins/trial-stripe/types';
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from './ui/sidebar';
import { UpgradeGateModal } from './upgrade-gate-modal';

interface BadgeConfig {
  label: string;
  subtext: string | null;
  colorClasses: string;
  subtextClasses: string;
  icon: ReactNode | null;
  tooltipBase: string;
}

const formatCancelDate = (periodEnd: number | null): string => {
  if (!periodEnd) return '';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
  }).format(new Date(periodEnd));
};

const getBadgeConfig = (
  subscription: SubscriptionStatus | null,
): BadgeConfig => {
  if (!subscription || subscription.status === 'expired') {
    return {
      label: 'FREE',
      subtext: 'Upgrade',
      colorClasses:
        'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300',
      subtextClasses: 'text-indigo-600 dark:text-indigo-400 font-medium',
      icon: <IconSparkles />,
      tooltipBase: 'Free plan — upgrade to unlock unlimited prompts',
    };
  }

  const { status, daysLeft, cancelAtPeriodEnd, periodEnd } = subscription;

  if (status === 'trialing') {
    if (daysLeft !== null && daysLeft <= 1) {
      return {
        label: 'TRIAL',
        subtext: 'ends today',
        colorClasses:
          'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
        subtextClasses: 'text-red-600 dark:text-red-400 font-medium',
        icon: <IconAlertTriangle />,
        tooltipBase: `Pro Trial — ends today`,
      };
    }
    if (daysLeft !== null && daysLeft <= 7) {
      return {
        label: 'TRIAL',
        subtext: `${daysLeft} days left`,
        colorClasses:
          'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
        subtextClasses: 'text-amber-600 dark:text-amber-400',
        icon: <IconClock />,
        tooltipBase: `Pro Trial — ${daysLeft} days remaining`,
      };
    }
    return {
      label: 'PRO TRIAL',
      subtext: null,
      colorClasses:
        'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
      subtextClasses: '',
      icon: <IconSparkles />,
      tooltipBase: `Pro Trial — ${daysLeft ?? 14} days remaining`,
    };
  }

  if (status === 'active') {
    if (cancelAtPeriodEnd) {
      return {
        label: 'PRO',
        subtext: `Cancels ${formatCancelDate(periodEnd)}`,
        colorClasses: 'bg-secondary text-muted-foreground',
        subtextClasses: 'text-muted-foreground',
        icon: null,
        tooltipBase: `Pro plan — cancels ${formatCancelDate(periodEnd)}`,
      };
    }
    return {
      label: 'PRO',
      subtext: null,
      colorClasses:
        'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300',
      subtextClasses: '',
      icon: <IconCircleCheck />,
      tooltipBase: 'Pro plan — active',
    };
  }

  if (status === 'canceled') {
    return {
      label: 'FREE',
      subtext: 'Upgrade',
      colorClasses:
        'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300',
      subtextClasses: 'text-indigo-600 dark:text-indigo-400 font-medium',
      icon: <IconSparkles />,
      tooltipBase: 'Free plan — upgrade to unlock unlimited prompts',
    };
  }

  if (status === 'past_due') {
    return {
      label: 'PRO',
      subtext: 'Payment issue',
      colorClasses:
        'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
      subtextClasses: 'text-red-600 dark:text-red-400 font-medium',
      icon: <IconAlertTriangle />,
      tooltipBase: 'Pro plan — payment issue',
    };
  }

  return {
    label: 'FREE',
    subtext: 'Upgrade',
    colorClasses:
      'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300',
    subtextClasses: 'text-indigo-600 dark:text-indigo-400 font-medium',
    icon: <IconSparkles />,
    tooltipBase: 'Free plan — upgrade to unlock unlimited prompts',
  };
};

export const SubscriptionBadge = () => {
  const { subscription } = useSubscription();
  const { canManageBilling } = useCanManageBilling();
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  const config = getBadgeConfig(subscription);
  const isUpgradeAction = config.subtext === 'Upgrade';

  const tooltipText = canManageBilling
    ? `${config.tooltipBase}. Click to manage plan.`
    : `${config.tooltipBase}. Click to view plan details.`;

  const badgeContent = (
    <>
      <span
        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold tracking-wide uppercase transition-colors duration-200 [&>svg]:size-3 ${config.colorClasses}`}
      >
        {config.icon}
        {config.label}
      </span>
      {config.subtext && (
        <span
          className={`inline-flex items-center gap-0.5 truncate text-xs ${config.subtextClasses}`}
        >
          {config.subtext}
          {isUpgradeAction && <IconChevronRight className="size-3" />}
        </span>
      )}
    </>
  );

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <Tooltip>
          <TooltipTrigger asChild>
            <SidebarMenuButton
              asChild={!isUpgradeAction}
              onClick={
                isUpgradeAction ? () => setShowUpgradeModal(true) : undefined
              }
              className={isUpgradeAction ? 'flex items-center gap-2' : ''}
            >
              {isUpgradeAction ? (
                badgeContent
              ) : (
                <NavLink
                  to="/settings?tab=billing"
                  className="flex items-center gap-2"
                >
                  {badgeContent}
                </NavLink>
              )}
            </SidebarMenuButton>
          </TooltipTrigger>
          <TooltipContent side="top" align="start">
            {tooltipText}
          </TooltipContent>
        </Tooltip>
      </SidebarMenuItem>
      {isUpgradeAction && (
        <UpgradeGateModal
          open={showUpgradeModal}
          onOpenChange={setShowUpgradeModal}
          resource="general"
        />
      )}
    </SidebarMenu>
  );
};
