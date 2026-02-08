import { IconInfoCircle, IconX } from '@tabler/icons-react';
import { useState } from 'react';
import { useCanManageBilling } from '~/hooks/use-can-manage-billing';
import { useOrganizationId } from '~/hooks/use-organization-id';
import { dismissExpiredBanner } from '~/hooks/use-trial-expired';

interface TrialExpiredBannerProps {
  visible: boolean;
  onReactivate?: () => void;
}

export const TrialExpiredBanner = ({
  visible,
  onReactivate,
}: TrialExpiredBannerProps) => {
  const { canManageBilling } = useCanManageBilling();
  const organizationId = useOrganizationId();
  const [isDismissed, setIsDismissed] = useState(false);

  if (!visible || isDismissed) return null;

  const handleDismiss = () => {
    if (organizationId) dismissExpiredBanner(organizationId);
    setIsDismissed(true);
  };

  return (
    <div
      data-slot="trial-expired-banner"
      className="relative flex w-full items-center justify-center gap-2 px-8 py-1.5 text-xs sm:text-sm bg-muted/80 text-muted-foreground border-b border-border animate-in fade-in duration-300"
    >
      <IconInfoCircle className="size-4 shrink-0" />
      <p>
        <span className="sm:hidden">Now on Free plan.</span>
        <span className="hidden sm:inline">
          Your Pro trial has ended. You're now on the Free plan.
        </span>
        {canManageBilling && (
          <>
            {' '}
            <button
              type="button"
              onClick={onReactivate}
              className="text-indigo-600 underline underline-offset-2 font-medium hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300"
            >
              Reactivate Pro
            </button>
          </>
        )}
        {!canManageBilling && (
          <span className="ml-1 opacity-75">Contact your admin</span>
        )}
      </p>
      <button
        type="button"
        onClick={handleDismiss}
        className="absolute right-2 top-1/2 -translate-y-1/2 rounded-sm p-0.5 transition-colors text-muted-foreground/60 hover:text-muted-foreground"
        aria-label="Dismiss expired trial banner"
      >
        <IconX className="size-3.5" />
      </button>
    </div>
  );
};
