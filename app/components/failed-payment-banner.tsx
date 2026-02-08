import { IconAlertTriangle } from '@tabler/icons-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { useCanManageBilling } from '~/hooks/use-can-manage-billing';
import { authClient } from '~/lib/auth.client';
import { NotifyAdminButton } from './notify-admin-button';

interface FailedPaymentBannerProps {
  visible: boolean;
}

export const FailedPaymentBanner = ({ visible }: FailedPaymentBannerProps) => {
  const { canManageBilling } = useCanManageBilling();
  const [isRedirecting, setIsRedirecting] = useState(false);

  if (!visible) return null;

  const handleUpdatePayment = async () => {
    setIsRedirecting(true);
    try {
      const { data, error } = await authClient.subscription.portal({
        returnUrl: window.location.href,
      });
      if (error || !data?.url) {
        toast.error('Could not open billing portal. Please try again.');
        return;
      }
      window.location.href = data.url;
    } catch {
      toast.error('Could not open billing portal. Please try again.');
    } finally {
      setIsRedirecting(false);
    }
  };

  return (
    <div
      data-slot="failed-payment-banner"
      className="flex w-full items-center justify-center gap-2 px-4 py-1.5 text-xs sm:text-sm bg-red-50 dark:bg-red-950/50 text-red-800 dark:text-red-200 border-b border-red-200 dark:border-red-900/50 animate-in fade-in duration-300"
    >
      <IconAlertTriangle className="size-4 shrink-0" />
      <p>
        {canManageBilling ? (
          <>
            <span className="sm:hidden">
              Payment failed.{' '}
              <button
                type="button"
                onClick={handleUpdatePayment}
                disabled={isRedirecting}
                className="text-red-900 dark:text-red-100 underline underline-offset-2 font-medium hover:text-red-950 dark:hover:text-red-50 disabled:opacity-50 disabled:pointer-events-none"
              >
                {isRedirecting ? 'Redirecting...' : 'Update payment method'}
              </button>
            </span>
            <span className="hidden sm:inline">
              Your last payment didn't go through.{' '}
              <button
                type="button"
                onClick={handleUpdatePayment}
                disabled={isRedirecting}
                className="text-red-900 dark:text-red-100 underline underline-offset-2 font-medium hover:text-red-950 dark:hover:text-red-50 disabled:opacity-50 disabled:pointer-events-none"
              >
                {isRedirecting ? 'Redirecting...' : 'Update payment method'}
              </button>{' '}
              to keep Pro features.
            </span>
          </>
        ) : (
          <>
            <span className="sm:hidden">Payment issue.</span>
            <span className="hidden sm:inline">
              Your workspace has a payment issue.
            </span>
            <NotifyAdminButton variant="inline" context="payment_failed" />
          </>
        )}
      </p>
    </div>
  );
};
