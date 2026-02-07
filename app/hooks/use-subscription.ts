import { useRevalidator, useRouteLoaderData } from 'react-router';
import type { SubscriptionStatus } from '~/plugins/trial-stripe/types';
import type { loader as rootLoader } from '~/root';

export const useSubscription = () => {
  const rootData = useRouteLoaderData<typeof rootLoader>('root');
  const revalidator = useRevalidator();

  return {
    subscription: (rootData?.subscription ?? null) as SubscriptionStatus | null,
    refetch: () => revalidator.revalidate(),
    isRevalidating: revalidator.state === 'loading',
  };
};
