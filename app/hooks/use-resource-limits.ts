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
  const promptCount = resourceCounts?.promptCount ?? 0;
  const memberCount = resourceCounts?.memberCount ?? 0;

  return {
    canCreatePrompt: promptLimit === -1 || promptCount < promptLimit,
    canInviteMember: memberLimit === -1 || memberCount < memberLimit,
    promptCount,
    promptLimit,
    memberCount,
    memberLimit,
    plan: subscription?.plan ?? 'free',
  };
};
