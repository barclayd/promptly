import type { AuthInstance } from '~/context';

type Organization = {
  id: string;
  name: string;
  slug: string;
};

export const getActiveOrganizationWithAuth = async (
  auth: AuthInstance,
  headers: Headers,
): Promise<Organization | null> => {
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
