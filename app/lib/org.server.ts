import type { RouterContextProvider } from 'react-router';
import { getAuth } from '~/lib/auth.server';

type Organization = {
  id: string;
  name: string;
  slug: string;
};

export const getActiveOrganization = async (
  context: RouterContextProvider,
  headers: Headers,
): Promise<Organization | null> => {
  const auth = getAuth(context);

  const activeOrgResponse = await auth.api.getFullOrganization({
    headers,
    asResponse: true,
  });

  if (activeOrgResponse.ok) {
    const activeOrg = (await activeOrgResponse.json()) as Organization | null;
    if (activeOrg?.id) {
      return { id: activeOrg.id, name: activeOrg.name, slug: activeOrg.slug };
    }
  }

  const orgsResponse = await auth.api.listOrganizations({
    headers,
    asResponse: true,
  });

  if (!orgsResponse.ok) {
    return null;
  }

  const orgs = (await orgsResponse.json()) as Organization[];

  if (!orgs || orgs.length === 0) {
    return null;
  }

  return orgs[0];
};
