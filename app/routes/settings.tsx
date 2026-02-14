import { IconKey } from '@tabler/icons-react';
import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { ApiKeysEmptyState } from '~/components/api-keys-empty-state';
import { ApiKeysTable } from '~/components/api-keys-table';
import { BillingSection } from '~/components/billing/billing-section';
import { CreateApiKeyDialog } from '~/components/create-api-key-dialog';
import { CreateLlmApiKeyDialog } from '~/components/create-llm-api-key-dialog';
import { LlmApiKeysEmptyState } from '~/components/llm-api-keys-empty-state';
import { LlmApiKeysTable } from '~/components/llm-api-keys-table';
import { Button } from '~/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '~/components/ui/tabs';
import { orgContext, userContext } from '~/context';
import { useSubscription } from '~/hooks/use-subscription';
import { getAuth } from '~/lib/auth.server';
import { getLlmApiKeysForOrg } from '~/lib/llm-api-keys.server';
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
  const db = context.cloudflare.env.promptly;

  // Get Promptly API keys and LLM API keys in parallel
  const [apiKeysResponse, llmApiKeys] = await Promise.all([
    auth.api.listApiKeys({
      headers: request.headers,
      asResponse: true,
    }),
    getLlmApiKeysForOrg(db, org.organizationId),
  ]);

  let allApiKeys: ApiKey[] = [];

  if (apiKeysResponse.ok) {
    const apiKeysData = await apiKeysResponse.json();
    allApiKeys = Array.isArray(apiKeysData) ? apiKeysData : [];
  }

  // Filter API keys by organization
  const organizationApiKeys = allApiKeys.filter((key) => {
    if (!key.metadata) return false;
    try {
      const metadata =
        typeof key.metadata === 'string'
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
    permissions: key.permissions
      ? typeof key.permissions === 'string'
        ? JSON.parse(key.permissions)
        : key.permissions
      : null,
  }));

  return {
    apiKeys: transformedKeys,
    llmApiKeys,
    organizationId: org.organizationId,
    organizationName: org.organizationName,
  };
};

const PromptlyApiKeysContent = ({
  apiKeys,
}: {
  apiKeys: Route.ComponentProps['loaderData']['apiKeys'];
}) => {
  const hasApiKeys = apiKeys.length > 0;

  return hasApiKeys ? (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-sm font-medium text-foreground">
          Promptly API Keys
        </div>
        <CreateApiKeyDialog>
          <Button variant="outline" size="sm" className="gap-2">
            <IconKey className="size-4" />
            Add API Key
          </Button>
        </CreateApiKeyDialog>
      </div>
      <ApiKeysTable apiKeys={apiKeys} />
    </div>
  ) : (
    <div className="flex min-h-[60vh] items-center justify-center">
      <ApiKeysEmptyState />
    </div>
  );
};

const LlmApiKeysContent = ({
  llmApiKeys,
  createDialogOpen,
  onCreateDialogOpenChange,
}: {
  llmApiKeys: Route.ComponentProps['loaderData']['llmApiKeys'];
  createDialogOpen: boolean;
  onCreateDialogOpenChange: (open: boolean) => void;
}) => {
  const hasKeys = llmApiKeys.length > 0;

  return hasKeys ? (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-sm font-medium text-foreground">LLM API Keys</div>
        <Button
          variant="outline"
          size="sm"
          className="gap-2"
          onClick={() => onCreateDialogOpenChange(true)}
        >
          <IconKey className="size-4" />
          Add LLM API Key
        </Button>
      </div>
      <LlmApiKeysTable llmApiKeys={llmApiKeys} />
      <CreateLlmApiKeyDialog
        open={createDialogOpen}
        onOpenChange={onCreateDialogOpenChange}
      />
    </div>
  ) : (
    <div className="flex min-h-[60vh] items-center justify-center">
      <LlmApiKeysEmptyState onAddKey={() => onCreateDialogOpenChange(true)} />
      <CreateLlmApiKeyDialog
        open={createDialogOpen}
        onOpenChange={onCreateDialogOpenChange}
      />
    </div>
  );
};

const Settings = ({ loaderData }: Route.ComponentProps) => {
  const { apiKeys, llmApiKeys } = loaderData;
  const { subscription } = useSubscription();
  const [searchParams, setSearchParams] = useSearchParams();

  const hasBillingTab =
    subscription != null &&
    (subscription.status === 'trialing' ||
      subscription.status === 'active' ||
      subscription.status === 'past_due');

  // Default tab: 'promptly-api-keys', support 'llm-api-keys' and 'billing'
  const tabParam = searchParams.get('tab');
  const activeTab = tabParam ?? 'promptly-api-keys';

  // Auto-open create dialog when redirected from no-keys modal
  const [createLlmDialogOpen, setCreateLlmDialogOpen] = useState(
    tabParam === 'llm-api-keys' && searchParams.get('open') === 'create',
  );

  const handleTabChange = (value: string) => {
    setSearchParams(
      (prev) => {
        if (value === 'promptly-api-keys') {
          prev.delete('tab');
        } else {
          prev.set('tab', value);
        }
        prev.delete('open');
        return prev;
      },
      { replace: true },
    );
  };

  return (
    <div className="flex flex-1 flex-col">
      <div className="@container/main flex flex-1 flex-col gap-2 bg-muted/40 dark:bg-background">
        <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
          <div className="px-4 lg:px-6">
            {/* Header */}
            <div className="flex items-start justify-between mb-6">
              <div>
                <h1 className="text-2xl font-semibold text-foreground">
                  Settings
                </h1>
                <p className="text-muted-foreground text-sm mt-1">
                  Manage your Promptly account
                </p>
              </div>
            </div>

            {/* Content */}
            <Tabs value={activeTab} onValueChange={handleTabChange}>
              <TabsList>
                <TabsTrigger value="promptly-api-keys">
                  Promptly API Keys
                </TabsTrigger>
                <TabsTrigger value="llm-api-keys">LLM API Keys</TabsTrigger>
                {hasBillingTab && (
                  <TabsTrigger value="billing">Billing</TabsTrigger>
                )}
              </TabsList>
              <TabsContent value="promptly-api-keys" className="mt-6">
                <PromptlyApiKeysContent apiKeys={apiKeys} />
              </TabsContent>
              <TabsContent value="llm-api-keys" className="mt-6">
                <LlmApiKeysContent
                  llmApiKeys={llmApiKeys}
                  createDialogOpen={createLlmDialogOpen}
                  onCreateDialogOpenChange={setCreateLlmDialogOpen}
                />
              </TabsContent>
              {hasBillingTab && (
                <TabsContent value="billing" className="mt-6">
                  <BillingSection />
                </TabsContent>
              )}
            </Tabs>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;
