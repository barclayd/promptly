import { useRouteLoaderData } from 'react-router';
import type { loader as rootLoader } from '~/root';

export const useEnabledModels = () => {
  const rootData = useRouteLoaderData<typeof rootLoader>('root');
  return (rootData?.enabledModels ?? []) as string[];
};
