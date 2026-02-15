import { useRouteLoaderData } from 'react-router';
import type { ResourceCounts } from '~/lib/subscription.server';
import type { SubscriptionStatus } from '~/plugins/trial-stripe/types';
import type { loader as rootLoader } from '~/root';

export const useResourceLimits = () => {
  const rootData = useRouteLoaderData<typeof rootLoader>('root');
  const subscription = (rootData?.subscription ??
    null) as SubscriptionStatus | null;
  const resourceCounts = (rootData?.resourceCounts ??
    null) as ResourceCounts | null;

  const promptLimit = subscription?.limits.prompts ?? 3;
  const memberLimit = subscription?.limits.teamMembers ?? 1;
  const apiCallLimit = subscription?.limits.apiCalls ?? 5000;
  const promptCount = resourceCounts?.promptCount ?? 0;
  const memberCount = resourceCounts?.memberCount ?? 0;
  const apiCallCount = resourceCounts?.apiCallCount ?? 0;

  return {
    canCreatePrompt: promptLimit === -1 || promptCount < promptLimit,
    canInviteMember: memberLimit === -1 || memberCount < memberLimit,
    canMakeApiCalls: apiCallLimit === -1 || apiCallCount < apiCallLimit,
    promptCount,
    promptLimit,
    memberCount,
    memberLimit,
    apiCallCount,
    apiCallLimit,
    plan: subscription?.plan ?? 'free',
  };
};
