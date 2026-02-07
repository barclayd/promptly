import { useRouteLoaderData } from 'react-router';
import type { MemberRole } from '~/lib/subscription.server';
import type { loader as rootLoader } from '~/root';

export const useCanManageBilling = () => {
  const rootData = useRouteLoaderData<typeof rootLoader>('root');
  const memberRole = (rootData?.memberRole ?? null) as MemberRole;

  return {
    canManageBilling: memberRole === 'owner' || memberRole === 'admin',
    memberRole,
  };
};
