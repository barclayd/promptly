import {
  AuthorizationError,
  type AuthRequest,
  CimdFetchError,
} from '@cloudflare/workers-oauth-provider';
import { IconAlertCircle, IconPlugConnected } from '@tabler/icons-react';
import { nanoid } from 'nanoid';
import { data, isRouteErrorResponse, Link, redirect } from 'react-router';
import { McpConsent } from '~/components/mcp-consent';
import { Button } from '~/components/ui/button';
import { cloudflareContext, sessionContext } from '~/context';
import {
  getMcpOrigin,
  requireMcpEnabled,
  requireMcpSameOrigin,
} from '~/lib/mcp/config.server';
import {
  createMcpConnection,
  getMcpWorkspace,
  revokeMcpConnection,
} from '~/lib/mcp/connections.server';
import { getMcpOAuthApi } from '~/lib/mcp/oauth.server';
import {
  type McpPermission,
  mcpPermissionSchema,
  mcpScopeSchema,
  scopesForMcpPermission,
} from '~/lib/validations/mcp';
import type { Route } from './+types/oauth.authorize';

export const meta = () => [{ title: 'Connect to Promptly' }];
export const headers = () => ({
  'Cache-Control': 'no-store',
  'Referrer-Policy': 'same-origin',
  'X-Frame-Options': 'DENY',
});

const clientMetadataUnavailable =
  'Promptly could not load this client’s connection details.';

const publicAuthorizationErrors = new Set([
  'Connect using OAuth with S256 PKCE.',
  'The client requested unsupported permissions.',
  'This authorization request is invalid. Start the connection again from your client.',
  'Unknown OAuth client.',
  'The client must request read access with authoring or testing permissions.',
  'Sign in again to connect.',
  'This connection request expired or has already been used. Start again from your client.',
  'The chosen permissions exceed what this client requested.',
  'Your workspace membership changed. Start the connection again.',
  'MCP is currently disabled.',
  'Invalid request origin.',
  clientMetadataUnavailable,
]);

const parseAuthorization = async (request: Request, env: Env) => {
  try {
    const parsed = await getMcpOAuthApi(env).parseAuthRequest(request);
    if (!parsed.codeChallenge || parsed.codeChallengeMethod !== 'S256') {
      throw new Response('Connect using OAuth with S256 PKCE.', {
        status: 400,
      });
    }
    if (
      parsed.scope.some(
        (scope) =>
          scope !== 'offline_access' &&
          !mcpScopeSchema.safeParse(scope).success,
      )
    ) {
      throw new Response('The client requested unsupported permissions.', {
        status: 400,
      });
    }
    return parsed;
  } catch (error) {
    if (error instanceof CimdFetchError) {
      throw new Response(clientMetadataUnavailable, { status: 503 });
    }
    if (error instanceof AuthorizationError) {
      throw new Response(
        'This authorization request is invalid. Start the connection again from your client.',
        { status: 400 },
      );
    }
    throw error;
  }
};

const allowedPermissions = (request: AuthRequest): McpPermission[] => {
  const requested = request.scope.filter((scope) => scope !== 'offline_access');
  return (['read', 'edit', 'publish'] as const).filter(
    (permission) =>
      requested.length === 0 ||
      scopesForMcpPermission(permission).every((scope) =>
        requested.includes(scope),
      ),
  );
};

export const loader = async ({ request, context }: Route.LoaderArgs) => {
  const { env } = context.get(cloudflareContext);
  const session = context.get(sessionContext);
  if (!session?.user) throw redirect('/login');
  const workspace = await getMcpWorkspace(env.promptly, session.user.id);
  requireMcpEnabled(env);
  const authorization = await parseAuthorization(request, env);
  const client = await getMcpOAuthApi(env).lookupClient(authorization.clientId);
  if (!client) throw new Response('Unknown OAuth client.', { status: 400 });
  const permissions = allowedPermissions(authorization);
  if (!permissions.length)
    throw new Response(
      'The client must request read access with authoring or testing permissions.',
      { status: 400 },
    );
  const requestId = nanoid(32);
  const now = Date.now();
  await env.promptly.batch([
    env.promptly
      .prepare(
        'DELETE FROM mcp_authorization_request WHERE id IN (SELECT id FROM mcp_authorization_request WHERE expires_at < ? LIMIT 100)',
      )
      .bind(now),
    env.promptly
      .prepare(
        'INSERT INTO mcp_authorization_request (id, user_id, session_id, organization_id, membership_id, request_url, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      )
      .bind(
        requestId,
        session.user.id,
        session.session.id,
        workspace.organizationId,
        workspace.membershipId,
        request.url,
        now + 10 * 60_000,
      ),
  ]);
  const redirectUrl = new URL(authorization.redirectUri);
  return {
    requestId,
    clientName: client.clientName || 'MCP client',
    clientId: client.clientId,
    redirectOrigin:
      redirectUrl.origin === 'null'
        ? authorization.redirectUri
        : redirectUrl.origin,
    workspaceName: workspace.organizationName,
    email: session.user.email,
    allowedPermissions: permissions,
    testingRequested: authorization.scope.includes('mcp:run'),
    defaultPermission: permissions.includes('edit')
      ? ('edit' as const)
      : ('read' as const),
  };
};

export const action = async ({ request, context }: Route.ActionArgs) => {
  const { env } = context.get(cloudflareContext);
  requireMcpSameOrigin(request, env);
  const session = context.get(sessionContext);
  if (!session?.user)
    throw new Response('Sign in again to connect.', { status: 401 });
  const workspace = await getMcpWorkspace(env.promptly, session.user.id);
  requireMcpEnabled(env);
  const form = await request.formData();
  const requestId = form.get('requestId');
  const permission = mcpPermissionSchema.safeParse(form.get('permission'));
  const testingChoice = form.get('allowTesting');
  const allowTesting = testingChoice === 'true';
  const decision = form.get('decision');
  if (
    typeof requestId !== 'string' ||
    !permission.success ||
    (testingChoice !== null && testingChoice !== 'true') ||
    (decision !== 'allow' && decision !== 'deny')
  ) {
    return data(
      { error: 'Choose a permission level and connect or cancel.' },
      { status: 400 },
    );
  }
  const pending = await env.promptly
    .prepare(
      'DELETE FROM mcp_authorization_request WHERE id = ? AND user_id = ? AND session_id = ? AND organization_id = ? AND membership_id = ? AND expires_at > ? RETURNING request_url',
    )
    .bind(
      requestId,
      session.user.id,
      session.session.id,
      workspace.organizationId,
      workspace.membershipId,
      Date.now(),
    )
    .first<{ request_url: string }>();
  if (!pending)
    throw new Response(
      'This connection request expired or has already been used. Start again from your client.',
      { status: 400 },
    );
  const authorization = await parseAuthorization(
    new Request(pending.request_url),
    env,
  );
  if (decision === 'deny') {
    const destination = new URL(authorization.redirectUri);
    destination.searchParams.set('error', 'access_denied');
    destination.searchParams.set('state', authorization.state);
    destination.searchParams.set('iss', getMcpOrigin(env));
    return redirect(destination.toString());
  }
  if (
    !allowedPermissions(authorization).includes(permission.data) ||
    (allowTesting && !authorization.scope.includes('mcp:run'))
  ) {
    throw new Response(
      'The chosen permissions exceed what this client requested.',
      { status: 400 },
    );
  }
  const api = getMcpOAuthApi(env);
  const client = await api.lookupClient(authorization.clientId);
  if (!client) throw new Response('Unknown OAuth client.', { status: 400 });
  const connection = await createMcpConnection(env.promptly, {
    userId: session.user.id,
    clientId: client.clientId,
    clientName: client.clientName || 'MCP client',
    permission: permission.data,
    allowTesting,
  });
  try {
    if (
      connection.organizationId !== workspace.organizationId ||
      connection.membershipId !== workspace.membershipId
    ) {
      throw new Response(
        'Your workspace membership changed. Start the connection again.',
        { status: 409 },
      );
    }
    const result = await api.completeAuthorization({
      request: authorization,
      userId: session.user.id,
      scope: connection.scopes,
      metadata: {
        connectionId: connection.id,
        clientName: connection.clientName,
      },
      props: {
        connectionId: connection.id,
        userId: connection.userId,
        organizationId: connection.organizationId,
        clientId: connection.clientId,
        scopes: connection.scopes,
      },
      revokeExistingGrants: false,
    });
    return redirect(result.redirectTo);
  } catch (error) {
    await revokeMcpConnection(env.promptly, {
      connectionId: connection.id,
      userId: session.user.id,
    });
    throw error;
  }
};

const Authorize = ({ loaderData, actionData }: Route.ComponentProps) => (
  <McpConsent {...loaderData} error={actionData?.error} />
);

export const ErrorBoundary = ({ error }: Route.ErrorBoundaryProps) => {
  const message =
    isRouteErrorResponse(error) &&
    typeof error.data === 'string' &&
    publicAuthorizationErrors.has(error.data)
      ? error.data
      : 'The connection could not be completed. Start a new connection from your assistant.';
  const metadataUnavailable = message === clientMetadataUnavailable;

  return (
    <main className="min-h-svh bg-muted/40 px-4 py-8 text-foreground sm:py-12 dark:bg-background">
      <div className="mx-auto w-full max-w-lg">
        <div className="mb-6 flex items-center gap-2 text-lg font-semibold tracking-tight">
          <IconPlugConnected className="size-5" aria-hidden="true" />
          Promptly
        </div>
        <div className="space-y-5 rounded-xl border bg-card p-5 shadow-sm sm:p-7">
          <IconAlertCircle
            className="size-7 text-muted-foreground"
            aria-hidden="true"
          />
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold tracking-tight">
              {metadataUnavailable
                ? 'Client details unavailable'
                : 'Unable to connect'}
            </h1>
            <p role="alert" className="text-sm leading-relaxed">
              {message}
            </p>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {metadataUnavailable
                ? 'Try connecting again from your assistant. If this continues, register it with its exact callback URL and use that client ID to connect.'
                : 'Open MCP Settings for your assistant’s setup instructions, then try connecting again.'}
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <Button asChild>
              <Link to="/settings?tab=mcp">MCP Settings</Link>
            </Button>
            {metadataUnavailable && (
              <Button asChild variant="outline">
                <Link to="/settings/mcp/clients">Register a client</Link>
              </Button>
            )}
          </div>
        </div>
      </div>
    </main>
  );
};

export default Authorize;
