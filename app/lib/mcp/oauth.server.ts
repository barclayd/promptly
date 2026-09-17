import {
  GrantType,
  getOAuthApi,
  OAuthError,
  OAuthProvider,
  type OAuthProviderOptions,
} from '@cloudflare/workers-oauth-provider';
import {
  mcpConnectionPropsSchema,
  mcpScopeSchema,
} from '~/lib/validations/mcp';
import {
  getMcpOrigin,
  getMcpUrl,
  isMcpAuthoringEnabled,
  isMcpEnabled,
} from './config.server';
import {
  authorizeMcpConnection,
  claimMcpGrant,
  McpConnectionError,
} from './connections.server';
import { handleMcpApi } from './protocol.server';
import {
  isMcpRevocationRequest,
  withMcpRevocationKv,
} from './revocation.server';
import { checkMcpRegistrationRateLimit } from './usage.server';

const oauthOptions = (env: Env): OAuthProviderOptions<Env> => ({
  apiRoute: '/mcp',
  apiHandler: { fetch: handleMcpApi },
  defaultHandler: { fetch: () => new Response('Not found', { status: 404 }) },
  authorizeEndpoint: `${getMcpOrigin(env)}/oauth/authorize`,
  tokenEndpoint: `${getMcpOrigin(env)}/oauth/token`,
  clientRegistrationEndpoint:
    env.MCP_ALLOW_DCR.toLowerCase() === 'true'
      ? `${getMcpOrigin(env)}/oauth/register`
      : undefined,
  clientIdMetadataDocumentEnabled: true,
  clientRegistrationTTL: 60 * 60 * 24 * 30,
  allowImplicitFlow: false,
  allowPlainPKCE: false,
  accessTokenTTL: 3600,
  refreshTokenTTL: 60 * 60 * 24 * 30,
  scopesSupported: ['mcp:read', 'mcp:write', 'mcp:publish'],
  resourceMetadata: {
    resource: getMcpUrl(env),
    scopes_supported: isMcpAuthoringEnabled(env)
      ? ['mcp:read', 'mcp:write', 'mcp:publish']
      : ['mcp:read'],
    resource_name: 'Promptly',
  },
  tokenExchangeCallback: async ({
    props,
    userId,
    clientId,
    grantId,
    grantType,
    requestedScope,
  }) => {
    const parsed = mcpConnectionPropsSchema.safeParse(props);
    if (
      !parsed.success ||
      parsed.data.userId !== userId ||
      parsed.data.clientId !== clientId ||
      !isMcpEnabled(env)
    ) {
      throw new OAuthError('invalid_grant', {
        description: 'This Promptly connection is no longer available.',
      });
    }
    try {
      if (grantType === GrantType.AUTHORIZATION_CODE) {
        await claimMcpGrant(env.promptly, {
          connectionId: parsed.data.connectionId,
          userId,
          grantId,
        });
      }
      const access = await authorizeMcpConnection(env.promptly, {
        ...parsed.data,
        tokenScopes: parsed.data.scopes,
      });
      if (
        access.workspace.organizationId !== parsed.data.organizationId ||
        access.connection.grantId !== grantId
      ) {
        throw new OAuthError('invalid_grant', {
          description: 'This Promptly connection is no longer available.',
        });
      }
    } catch (error) {
      if (!(error instanceof McpConnectionError)) throw error;
      throw new OAuthError('invalid_grant', {
        description: 'This Promptly connection is no longer available.',
      });
    }
    const scopes = requestedScope.filter(
      (scope) =>
        mcpScopeSchema.safeParse(scope).success &&
        parsed.data.scopes.includes(mcpScopeSchema.parse(scope)),
    );
    return {
      accessTokenProps: { ...parsed.data, scopes },
      accessTokenScope: scopes,
    };
  },
});

export const getMcpOAuthApi = (env: Env) => getOAuthApi(oauthOptions(env), env);

export const handleMcpOAuth = async (
  request: Request,
  env: Env,
  ctx: ExecutionContext,
) => {
  const canonicalOrigin = getMcpOrigin(env);
  if (new URL(request.url).origin !== canonicalOrigin) {
    return Response.json(
      {
        error: 'invalid_request',
        error_description: 'Use the configured Promptly MCP server URL.',
      },
      { status: 400 },
    );
  }
  if (
    new URL(request.url).pathname === '/oauth/register' &&
    request.method === 'POST' &&
    env.MCP_ALLOW_DCR.toLowerCase() === 'true'
  ) {
    const retryAfter = await checkMcpRegistrationRateLimit(
      env.promptly,
      request.headers.get('CF-Connecting-IP') ?? 'unknown',
    );
    if (retryAfter) {
      return Response.json(
        {
          error: 'temporarily_unavailable',
          error_description:
            'Too many client registrations. Try again shortly.',
        },
        {
          status: 429,
          headers: {
            'Retry-After': String(retryAfter),
            'Cache-Control': 'no-store',
          },
        },
      );
    }
  }
  if (request.body) {
    const maximumRequestBytes =
      new URL(request.url).pathname === '/mcp' && isMcpAuthoringEnabled(env)
        ? 1024 * 1024
        : 128 * 1024;
    const reader = request.body.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maximumRequestBytes) {
        await reader.cancel();
        return Response.json({ error: 'request_too_large' }, { status: 413 });
      }
      chunks.push(value);
    }
    const body = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      body.set(chunk, offset);
      offset += chunk.byteLength;
    }
    request = new Request(request, { body });
  }
  const provider = new OAuthProvider(oauthOptions(env));
  const providerEnv = (await isMcpRevocationRequest(request))
    ? { ...env, OAUTH_KV: withMcpRevocationKv(env.promptly, env.OAUTH_KV) }
    : env;
  const response = await provider.fetch(request, providerEnv, ctx);
  const headers = new Headers(response.headers);
  headers.set('Cache-Control', 'no-store');
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
};
