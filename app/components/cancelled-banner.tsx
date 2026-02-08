import { IconInfoCircle, IconX } from '@tabler/icons-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { useCanManageBilling } from '~/hooks/use-can-manage-billing';
import { dismissCancelledBanner } from '~/hooks/use-cancelled-banner';
import { useOrganizationId } from '~/hooks/use-organization-id';
import { authClient } from '~/lib/auth.client';

const formatDate = (timestamp: number | null): string => {
  if (!timestamp) return '';
  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    day: 'numeric',
  }).format(new Date(timestamp));
};

interface CancelledBannerProps {
  visible: boolean;
  periodEnd: number | null;
  canDismiss: boolean;
}

export const CancelledBanner = ({
  visible,
  periodEnd,
  canDismiss,
}: CancelledBannerProps) => {
  const { canManageBilling } = useCanManageBilling();
  const organizationId = useOrganizationId();
  const [isDismissed, setIsDismissed] = useState(false);
  const [isReactivating, setIsReactivating] = useState(false);

  if (!visible || isDismissed) return null;

  const handleDismiss = () => {
    if (organizationId) dismissCancelledBanner(organizationId);
    setIsDismissed(true);
  };

  const handleReactivate = async () => {
    setIsReactivating(true);
    try {
      const { error } = await authClient.subscription.reactivate();
      if (error) {
        toast.error('Failed to reactivate. Please try again.');
        return;
      }
      toast.success('Your Pro plan has been reactivated.');
      window.location.reload();
    } catch {
      toast.error('Failed to reactivate. Please try again.');
    } finally {
      setIsReactivating(false);
    }
  };

  return (
    <div
      data-slot="cancelled-banner"
      className="relative flex w-full items-center justify-center gap-2 px-8 py-1.5 text-xs sm:text-sm bg-muted/80 text-muted-foreground border-b border-border animate-in fade-in duration-300"
    >
      <IconInfoCircle className="size-4 shrink-0" />
      <p>
        <span className="sm:hidden">Pro cancels {formatDate(periodEnd)}.</span>
        <span className="hidden sm:inline">
          Your Pro plan cancels on {formatDate(periodEnd)}. You'll retain all
          features until then.
        </span>
        {canManageBilling && (
          <>
            {' '}
            <button
              type="button"
              onClick={handleReactivate}
              disabled={isReactivating}
              className="text-indigo-600 underline underline-offset-2 font-medium hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300 disabled:opacity-50 disabled:pointer-events-none"
            >
              {isReactivating ? 'Reactivating...' : 'Reactivate Pro'}
            </button>
          </>
        )}
        {!canManageBilling && (
          <span className="ml-1 opacity-75">Contact your admin</span>
        )}
      </p>
      {canDismiss && (
        <button
          type="button"
          onClick={handleDismiss}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-sm p-0.5 transition-colors text-muted-foreground/60 hover:text-muted-foreground"
          aria-label="Dismiss cancellation banner"
        >
          <IconX className="size-3.5" />
        </button>
      )}
    </div>
  );
};
