import { timingSafeEqual } from 'node:crypto';
import { getComposer, getPrompt, getSnippet } from '../authoring/reads.server';
import { mcpConnectionPropsSchema } from '../validations/mcp';
import {
  type ExternalMcpServer,
  externalMcpReadSchema,
  externalMcpRequestSchema,
} from '../validations/mcp-external';
import { toMcpAuthoringError } from './authoring.server';
import {
  getMcpOrigin,
  isMcpAuthoringEnabled,
  isMcpEnabled,
} from './config.server';
import { McpConnectionError } from './connections.server';
import { authorizeExternalMcpConnection } from './external-access.server';
import { getExternalMcpServers } from './external-config.server';
import { getMcpOAuthApi } from './oauth.server';
import {
  checkMcpExternalRateLimit,
  checkMcpRateLimit,
  recordMcpToolCall,
} from './usage.server';

const json = (value: unknown, status = 200, headers: HeadersInit = {}) =>
  Response.json(value, {
    status,
    headers: { ...headers, 'Cache-Control': 'no-store' },
  });
const result = <T extends Record<string, unknown>>(value: T) => ({
  content: [{ type: 'text' as const, text: JSON.stringify(value) }],
  structuredContent: value,
});

const authenticatedService = async (
  request: Request,
  server: ExternalMcpServer,
) => {
  const authorization = request.headers.get('Authorization');
  if (!authorization?.startsWith('Bearer ') || authorization.length > 1024)
    return false;
  const [received, expected] = await Promise.all([
    crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(authorization.slice(7)),
    ),
    crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(server.sharedSecret),
    ),
  ]);
  return timingSafeEqual(new Uint8Array(received), new Uint8Array(expected));
};

const introspect = async (
  env: Env,
  server: ExternalMcpServer,
  token: string,
  resource: string,
) => {
  if (resource !== server.resource) return { active: false as const };
  try {
    const unwrapped = await getMcpOAuthApi(
      env,
      server.resource,
    ).unwrapToken<unknown>(token);
    if (
      !unwrapped ||
      unwrapped.audience !== server.resource ||
      unwrapped.expiresAt * 1000 <= Date.now()
    )
      return { active: false as const };
    const props = mcpConnectionPropsSchema.safeParse(unwrapped.grant.props);
    if (
      !props.success ||
      props.data.externalServerId !== server.id ||
      props.data.userId !== unwrapped.userId ||
      props.data.clientId !== unwrapped.grant.clientId
    )
      return { active: false as const };
    const access = await authorizeExternalMcpConnection(
      env,
      server,
      props.data,
    );
    if (access.connection.grantId !== unwrapped.grantId)
      return { active: false as const };
    const scopes = access.scopes.filter(
      (scope) =>
        props.data.scopes.includes(scope) && unwrapped.scope.includes(scope),
    );
    if (!scopes.includes('mcp:read')) return { active: false as const };
    return {
      active: true as const,
      userId: props.data.userId,
      organizationId: access.workspace.organizationId,
      connectionId: access.connection.id,
      scopes,
      expiresAt: unwrapped.expiresAt * 1000,
    };
  } catch {
    return { active: false as const };
  }
};

const handleExternalMcpRequest = async (
  request: Request,
  env: Env,
  serverId: string,
) => {
  const url = new URL(request.url);
  if (url.protocol !== 'https:' || url.origin !== getMcpOrigin(env))
    return json({ error: 'invalid_request' }, 400);
  if (request.method !== 'POST')
    return json({ error: 'method_not_allowed' }, 405, { Allow: 'POST' });
  if (!isMcpEnabled(env)) return json({ error: 'unavailable' }, 403);
  const retryAfter = await checkMcpExternalRateLimit(
    env.promptly,
    request.headers.get('CF-Connecting-IP') ?? 'unknown',
  );
  if (retryAfter)
    return json({ error: 'rate_limited' }, 429, {
      'Retry-After': String(retryAfter),
    });
  const server = getExternalMcpServers(env).find(
    (item) => item.id === serverId,
  );
  if (!server || !(await authenticatedService(request, server)))
    return json({ error: 'invalid_client' }, 401);
  if (
    request.headers.get('Content-Type')?.split(';')[0].trim().toLowerCase() !==
    'application/json'
  )
    return json({ error: 'invalid_request' }, 415);
  const reader = request.body?.getReader();
  if (!reader) return json({ error: 'invalid_request' }, 400);
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > 16 * 1024) {
      await reader.cancel();
      return json({ error: 'request_too_large' }, 413);
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  let submitted: unknown;
  try {
    submitted = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return json({ error: 'invalid_request' }, 400);
  }
  const parsed = externalMcpRequestSchema.safeParse(submitted);
  if (!parsed.success) return json({ error: 'invalid_request' }, 400);
  if (parsed.data.action === 'introspect')
    return json(
      await introspect(env, server, parsed.data.token, parsed.data.resource),
    );
  try {
    const access = await authorizeExternalMcpConnection(
      env,
      server,
      parsed.data.subject,
    );
    const retryAfter = await checkMcpRateLimit(
      env.promptly,
      access.connection.id,
      server.organizationId,
    );
    if (retryAfter)
      return json({ error: 'rate_limited' }, 429, {
        'Retry-After': String(retryAfter),
      });
    const read = externalMcpReadSchema.safeParse({
      tool: parsed.data.tool,
      arguments: parsed.data.arguments,
    });
    if (!read.success) return json({ error: 'invalid_request' }, 400);
    const authoringAvailable = isMcpAuthoringEnabled(env);
    if (read.data.tool !== 'get_connection' && !authoringAvailable)
      return json({ error: 'unavailable' }, 403);
    const value =
      read.data.tool === 'get_connection'
        ? {
            workspaceId: access.workspace.organizationId,
            scopes: access.scopes,
            authoringAvailable,
            canRunTests: access.scopes.includes('mcp:run'),
          }
        : await {
            get_prompt: getPrompt,
            get_composer: getComposer,
            get_snippet: getSnippet,
          }[read.data.tool](env.promptly, {
            ...read.data.arguments,
            organizationId: access.workspace.organizationId,
          });
    await recordMcpToolCall(
      env.promptly,
      server.organizationId,
      read.data.tool,
    );
    return json(result(value));
  } catch (error) {
    if (error instanceof McpConnectionError)
      return json({ error: 'access_denied' }, 403);
    return json({ ...result(toMcpAuthoringError(error)), isError: true });
  }
};

export const handleExternalMcpBridge = async (
  request: Request,
  env: Env,
  serverId: string,
) => {
  try {
    return await handleExternalMcpRequest(request, env, serverId);
  } catch {
    return json({ error: 'service_unavailable' }, 503);
  }
};
