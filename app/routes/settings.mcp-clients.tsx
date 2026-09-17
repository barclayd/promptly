import { IconArrowLeft } from '@tabler/icons-react';
import { data, Form, Link, useNavigation } from 'react-router';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { Textarea } from '~/components/ui/textarea';
import { cloudflareContext, userContext } from '~/context';
import {
  requireMcpEnabled,
  requireMcpSameOrigin,
} from '~/lib/mcp/config.server';
import { getMcpWorkspace } from '~/lib/mcp/connections.server';
import { getMcpOAuthApi } from '~/lib/mcp/oauth.server';
import { mcpClientRegistrationSchema } from '~/lib/validations/mcp';
import type { Route } from './+types/settings.mcp-clients';

export const meta = () => [{ title: 'Register MCP client | Promptly' }];
export const headers = () => ({
  'Cache-Control': 'no-store',
  'Referrer-Policy': 'same-origin',
});

export const loader = async ({ context }: Route.LoaderArgs) => {
  const { env } = context.get(cloudflareContext);
  await getMcpWorkspace(env.promptly, context.get(userContext).id);
  requireMcpEnabled(env);
  return null;
};

export const action = async ({ request, context }: Route.ActionArgs) => {
  const { env } = context.get(cloudflareContext);
  requireMcpSameOrigin(request, env);
  await getMcpWorkspace(env.promptly, context.get(userContext).id);
  requireMcpEnabled(env);
  const parsed = mcpClientRegistrationSchema.safeParse(
    Object.fromEntries(await request.formData()),
  );
  if (!parsed.success)
    return data(
      {
        error: parsed.error.issues[0]?.message ?? 'Check the client details.',
        client: null,
      },
      { status: 400 },
    );
  const client = await getMcpOAuthApi(env).createClient({
    clientName: parsed.data.name,
    redirectUris: parsed.data.redirects,
    tokenEndpointAuthMethod: parsed.data.authentication,
    grantTypes: ['authorization_code', 'refresh_token'],
    responseTypes: ['code'],
  });
  return data(
    {
      error: null,
      client: { id: client.clientId, secret: client.clientSecret ?? null },
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
};

const McpClientRegistration = ({ actionData }: Route.ComponentProps) => {
  const navigation = useNavigation();
  return (
    <div className="mx-auto w-full max-w-2xl space-y-6 px-4 py-8 sm:px-6">
      <Button variant="ghost" size="sm" asChild>
        <Link to="/settings?tab=mcp">
          <IconArrowLeft className="size-4" />
          MCP connections
        </Link>
      </Button>
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">Register a client</h1>
        <p className="text-sm text-muted-foreground">
          For clients that ask for an OAuth client ID. Copy the callback URL
          from your client’s connection setup. You’ll grant workspace access
          when you connect.
        </p>
      </div>
      {actionData?.client ? (
        <div
          className="space-y-4 rounded-lg border bg-background p-5"
          role="status"
        >
          <p className="font-medium">Client registered</p>
          <div className="space-y-2">
            <Label htmlFor="client-id">Client ID</Label>
            <Input id="client-id" value={actionData.client.id} readOnly />
          </div>
          {actionData.client.secret && (
            <div className="space-y-2">
              <Label htmlFor="client-secret">Client secret</Label>
              <Input
                id="client-secret"
                type="password"
                value={actionData.client.secret}
                readOnly
              />
              <p className="text-sm text-muted-foreground">
                Copy this secret into your client now. It is shown only on this
                page.
              </p>
            </div>
          )}
          <p className="text-sm text-muted-foreground">
            Return to your client, enter these details, and connect to Promptly.
          </p>
        </div>
      ) : (
        <Form method="post" className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="client-name">Client name</Label>
            <Input
              id="client-name"
              name="name"
              placeholder="My coding assistant"
              required
              maxLength={100}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="client-redirects">Callback URLs</Label>
            <Textarea
              id="client-redirects"
              name="redirects"
              placeholder="http://127.0.0.1:8787/callback"
              required
              rows={3}
              maxLength={4000}
            />
            <p className="text-sm text-muted-foreground">
              One URL per line, exactly as supplied by your client.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="client-authentication">
              Does your client require a secret?
            </Label>
            <select
              id="client-authentication"
              name="authentication"
              defaultValue="none"
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="none">No — public client</option>
              <option value="client_secret_post">
                Yes — client ID and secret
              </option>
            </select>
          </div>
          {actionData?.error && (
            <p role="alert" className="text-sm text-destructive">
              {actionData.error}
            </p>
          )}
          <Button type="submit" disabled={navigation.state === 'submitting'}>
            Register client
          </Button>
        </Form>
      )}
    </div>
  );
};

export default McpClientRegistration;
