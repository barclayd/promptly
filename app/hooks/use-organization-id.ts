import { useRouteLoaderData } from 'react-router';
import type { loader as rootLoader } from '~/root';

export const useOrganizationId = () => {
  const rootData = useRouteLoaderData<typeof rootLoader>('root');
  return rootData?.organizationId ?? null;
};
