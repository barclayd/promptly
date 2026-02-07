import {
  IconAlertCircleFilled,
  IconAlertTriangle,
  IconInfoCircle,
  IconX,
} from '@tabler/icons-react';
import { useState } from 'react';
import { NavLink } from 'react-router';
import { useCanManageBilling } from '~/hooks/use-can-manage-billing';
import { useOrganizationId } from '~/hooks/use-organization-id';
import {
  getDismissKey,
  type TrialPhase,
  useTrialBannerVisible,
} from '~/hooks/use-trial-banner-visible';
import { cn } from '~/lib/utils';

interface PhaseConfig {
  icon: React.ReactNode;
  copy: string;
  adminCta: string | null;
  memberCopy: string | null;
  dismissible: boolean;
  containerClasses: string;
  ctaClasses: string;
  dismissClasses: string;
}

const getPhaseConfig = (
  phase: TrialPhase,
  daysLeft: number,
  canManageBilling: boolean,
): PhaseConfig => {
  if (phase === 3) {
    const dayWord = daysLeft === 0 ? 'today' : 'tomorrow';
    return {
      icon: <IconAlertCircleFilled className="size-4 shrink-0" />,
      copy: `Your Pro trial ends ${dayWord}. You'll move to the Free plan (3 prompts, 1 team member).`,
      adminCta: 'Upgrade to Pro',
      memberCopy: canManageBilling ? null : 'Contact your admin to upgrade',
      dismissible: false,
      containerClasses:
        'bg-red-50 text-red-900 border-b border-red-200 dark:bg-red-950/50 dark:text-red-100 dark:border-red-800',
      ctaClasses:
        'text-red-700 underline underline-offset-2 font-medium hover:text-red-900 dark:text-red-300 dark:hover:text-red-100',
      dismissClasses: '',
    };
  }

  if (phase === 2) {
    return {
      icon: <IconAlertTriangle className="size-4 shrink-0" />,
      copy: `Your Pro trial ends in ${daysLeft} days. Upgrade to keep unlimited prompts and team access.`,
      adminCta: 'Upgrade to Pro',
      memberCopy: canManageBilling ? null : 'Contact your admin',
      dismissible: true,
      containerClasses:
        'bg-amber-50 text-amber-900 border-b border-amber-200 dark:bg-amber-950/50 dark:text-amber-100 dark:border-amber-800',
      ctaClasses:
        'text-amber-700 underline underline-offset-2 font-medium hover:text-amber-900 dark:text-amber-300 dark:hover:text-amber-100',
      dismissClasses:
        'text-amber-600 hover:text-amber-900 dark:text-amber-400 dark:hover:text-amber-100',
    };
  }

  // Phase 1 (calm)
  return {
    icon: <IconInfoCircle className="size-4 shrink-0" />,
    copy: `Your Pro trial ends in ${daysLeft} days.`,
    adminCta: 'View plans',
    memberCopy: null,
    dismissible: true,
    containerClasses:
      'bg-blue-50 text-blue-900 border-b border-blue-200 dark:bg-blue-950/50 dark:text-blue-100 dark:border-blue-800',
    ctaClasses:
      'text-blue-700 underline underline-offset-2 font-medium hover:text-blue-900 dark:text-blue-300 dark:hover:text-blue-100',
    dismissClasses:
      'text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-100',
  };
};

export const TrialBanner = () => {
  const { visible, phase, daysLeft } = useTrialBannerVisible();
  const { canManageBilling } = useCanManageBilling();
  const organizationId = useOrganizationId();

  const [isDismissed, setIsDismissed] = useState(false);

  if (!visible || !phase || daysLeft === null || isDismissed) {
    return null;
  }

  const config = getPhaseConfig(phase, daysLeft, canManageBilling);

  const handleDismiss = () => {
    if (organizationId) {
      try {
        sessionStorage.setItem(getDismissKey(phase, organizationId), '1');
      } catch {
        // sessionStorage unavailable
      }
    }
    setIsDismissed(true);
  };

  return (
    <div
      className={cn(
        'relative flex w-full items-center justify-center px-4 py-2 text-sm animate-in fade-in duration-300',
        config.containerClasses,
      )}
    >
      <div className="flex items-center gap-2">
        {config.icon}
        <p className="text-center">
          <span>{config.copy}</span>
          {canManageBilling && config.adminCta && (
            <>
              {' '}
              <NavLink to="/settings" className={config.ctaClasses}>
                {config.adminCta}
              </NavLink>
            </>
          )}
          {config.memberCopy && (
            <span className="ml-1 opacity-75">{config.memberCopy}</span>
          )}
        </p>
      </div>
      {config.dismissible && (
        <button
          type="button"
          onClick={handleDismiss}
          className={cn(
            'absolute right-3 rounded-sm p-0.5 transition-colors',
            config.dismissClasses,
          )}
          aria-label="Dismiss trial banner"
        >
          <IconX className="size-4" />
        </button>
      )}
    </div>
  );
};
