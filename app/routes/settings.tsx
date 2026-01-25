import { IconKey } from '@tabler/icons-react';
import { ApiKeysEmptyState } from '~/components/api-keys-empty-state';
import { ApiKeysTable } from '~/components/api-keys-table';
import { CreateApiKeyDialog } from '~/components/create-api-key-dialog';
import { Button } from '~/components/ui/button';
import { orgContext, userContext } from '~/context';
import { getAuth } from '~/lib/auth.server';
import type { Route } from './+types/settings';

type ApiKey = {
  id: string;
  name: string | null;
  start: string | null;
  prefix: string | null;
  userId: string;
  createdAt: number;
  updatedAt: number;
  lastRequest: number | null;
  permissions: string | null;
  metadata: string | null;
};

// biome-ignore lint/correctness/noEmptyPattern: react router default
export const meta = ({}: Route.MetaArgs) => [
  { title: 'Settings | Promptly' },
  {
    name: 'description',
    content: 'Manage your Promptly account settings and API keys',
  },
];

export const loader = async ({ request, context }: Route.LoaderArgs) => {
  const org = context.get(orgContext);
  const currentUser = context.get(userContext);

  if (!org || !currentUser) {
    throw new Response('Unauthorized', { status: 403 });
  }

  const auth = getAuth(context);

  // Get API keys for the current user
  const apiKeysResponse = await auth.api.listApiKeys({
    headers: request.headers,
    asResponse: true,
  });

  let allApiKeys: ApiKey[] = [];

  if (apiKeysResponse.ok) {
    const apiKeysData = await apiKeysResponse.json();
    allApiKeys = Array.isArray(apiKeysData) ? apiKeysData : [];
  }

  // Filter API keys by organization
  const organizationApiKeys = allApiKeys.filter((key) => {
    if (!key.metadata) return false;
    try {
      const metadata = typeof key.metadata === 'string'
        ? JSON.parse(key.metadata)
        : key.metadata;
      return metadata.organizationId === org.organizationId;
    } catch {
      return false;
    }
  });

  // Transform to the format expected by the table
  const transformedKeys = organizationApiKeys.map((key) => ({
    id: key.id,
    name: key.name,
    start: key.start,
    prefix: key.prefix,
    createdAt: key.createdAt,
    lastRequest: key.lastRequest,
    permissions: key.permissions ? (
      typeof key.permissions === 'string'
        ? JSON.parse(key.permissions)
        : key.permissions
    ) : null,
  }));

  return {
    apiKeys: transformedKeys,
    organizationId: org.organizationId,
    organizationName: org.organizationName,
  };
};

const Settings = ({ loaderData }: Route.ComponentProps) => {
  const { apiKeys } = loaderData;

  const hasApiKeys = apiKeys.length > 0;

  return (
    <div className="flex flex-1 flex-col">
      <div className="@container/main flex flex-1 flex-col gap-2 bg-gray-100">
        <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
          <div className="px-4 lg:px-6">
            {/* Header */}
            <div className="flex items-start justify-between mb-6">
              <div>
                <h1 className="text-2xl font-semibold text-gray-900">Settings</h1>
                <p className="text-gray-500 text-sm mt-1">
                  Manage your Promptly account
                </p>
              </div>
              {hasApiKeys && (
                <CreateApiKeyDialog>
                  <Button className="gap-2 shadow-sm">
                    <IconKey className="size-4" />
                    Add API Key
                  </Button>
                </CreateApiKeyDialog>
              )}
            </div>

            {/* API Keys Section */}
            <div className="space-y-8">
              {hasApiKeys ? (
                <div className="space-y-3">
                  <div className="text-sm font-medium text-gray-700">
                    API Keys
                  </div>
                  <ApiKeysTable apiKeys={apiKeys} />
                </div>
              ) : (
                <div className="flex min-h-[60vh] items-center justify-center">
                  <ApiKeysEmptyState />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;
