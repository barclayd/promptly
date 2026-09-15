import { McpServer } from '@modelcontextprotocol/server';
import { createMcpHandler } from 'agents/mcp/server';
import { mcpConnectionPropsSchema } from '~/lib/validations/mcp';
import {
  mcpConnectionToolInputSchema,
  mcpConnectionToolOutputSchema,
  mcpSearchToolInputSchema,
  mcpSearchToolOutputSchema,
} from '~/lib/validations/mcp-protocol';
import { registerPromptlyAuthoring } from './authoring.server';
import {
  getMcpOrigin,
  isMcpAuthoringEnabled,
  isMcpWorkspaceEnabled,
} from './config.server';
import {
  authorizeMcpConnection,
  McpConnectionError,
} from './connections.server';
import { cachedMcpSchema } from './schema.server';
import { searchMcpContent } from './search.server';
import { checkMcpRateLimit, recordMcpToolCall } from './usage.server';

const readAnnotations = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
};

const jsonResult = <T extends Record<string, unknown>>(value: T) => ({
  content: [{ type: 'text' as const, text: JSON.stringify(value) }],
  structuredContent: value,
});

export const handleMcpApi = async (
  request: Request,
  env: Env,
  ctx: ExecutionContext,
): Promise<Response> => {
  const challenge = (error: 'invalid_token' | 'insufficient_scope') => ({
    'WWW-Authenticate': `Bearer error="${error}", resource_metadata="${getMcpOrigin(env)}/.well-known/oauth-protected-resource/mcp"${error === 'insufficient_scope' ? ', scope="mcp:read"' : ''}`,
  });
  const props = mcpConnectionPropsSchema.safeParse(ctx.props);
  if (!props.success) {
    return Response.json(
      { error: 'invalid_token' },
      { status: 401, headers: challenge('invalid_token') },
    );
  }
  try {
    const access = await authorizeMcpConnection(env.promptly, {
      ...props.data,
      tokenScopes: props.data.scopes,
      requiredScope: 'mcp:read',
    });
    if (
      access.workspace.organizationId !== props.data.organizationId ||
      !isMcpWorkspaceEnabled(env, props.data.organizationId)
    ) {
      return Response.json(
        {
          error: 'access_denied',
          error_description: 'MCP is not enabled for this workspace.',
        },
        { status: 403 },
      );
    }
    const retryAfter = await checkMcpRateLimit(
      env.promptly,
      props.data.connectionId,
      props.data.organizationId,
    );
    if (retryAfter) {
      return Response.json(
        { error: 'rate_limited' },
        { status: 429, headers: { 'Retry-After': String(retryAfter) } },
      );
    }
    const origin = getMcpOrigin(env);
    const authoringAvailable = isMcpAuthoringEnabled(env);
    const createServer = () => {
      const server = new McpServer(
        { name: 'Promptly', version: '0.1.0' },
        {
          instructions: authoringAvailable
            ? 'Promptly manages prompts, snippets and composers in your connected workspace. Search for stable IDs, read an explicit draft/working/latest/published version, then author shared drafts using expectedRevision and a requestKey. Reuse the same request key after an uncertain mutation; retries are protected for 24 hours. Never replace a stale revision without rereading and reviewing changes. Draft saves never publish; dedicated publish tools act immediately when authorized. Publish dependent prompts before their composer. Validation and previews do not execute LLMs. Snippets can be read/reused but not authored here. Native prompt menus expose published prompts using explicitly supplied JSON input; saved model settings do not change the host model. Detailed definitions/history are opt-in read tools.'
            : 'Promptly manages prompts and composers in your connected workspace. This pilot currently supports connection checks and content discovery. Creating, editing, and publishing tools are not available yet. Search returns stable IDs and links, not complete definitions.',
        },
      );
      server.registerTool(
        'get_connection',
        {
          title: 'Check Promptly connection',
          description:
            'Inspect the connected Promptly workspace and this connection’s granted permissions.',
          inputSchema: cachedMcpSchema(mcpConnectionToolInputSchema),
          annotations: readAnnotations,
          outputSchema: cachedMcpSchema(mcpConnectionToolOutputSchema),
        },
        async () => {
          await recordMcpToolCall(
            env.promptly,
            props.data.organizationId,
            'get_connection',
          );
          return jsonResult({
            workspaceId: props.data.organizationId,
            scopes: access.scopes,
            authoringAvailable,
          });
        },
      );
      server.registerTool(
        'search_content',
        {
          title: 'Find Promptly content',
          description:
            'Find prompts, composers, and snippets by name or description in the connected workspace. Returns IDs and links; includes items with drafts. Use the returned ID to identify an item, since names may repeat.',
          inputSchema: cachedMcpSchema(mcpSearchToolInputSchema),
          outputSchema: cachedMcpSchema(mcpSearchToolOutputSchema),
          annotations: readAnnotations,
        },
        async ({ query, type, offset, limit }) => {
          const org = props.data.organizationId;
          const result = await searchMcpContent(env.promptly, {
            organizationId: org,
            query,
            type,
            offset,
            limit,
          });
          await recordMcpToolCall(env.promptly, org, 'search_content');
          return jsonResult({
            items: result.items.map((item) => ({
              ...item,
              url: `${origin}/${item.type}s/${encodeURIComponent(item.id)}`,
            })),
            nextOffset: result.nextOffset,
          });
        },
      );
      if (authoringAvailable)
        registerPromptlyAuthoring(server, env, ctx, props.data);
      return server;
    };
    return createMcpHandler(createServer, {
      route: '/mcp',
      legacy: 'stateless',
      allowedHostnames: [new URL(origin).hostname],
      allowedOriginHostnames: [
        new URL(origin).hostname,
        'chatgpt.com',
        'claude.ai',
        'cursor.com',
      ],
    })(request, env, ctx);
  } catch (error) {
    if (error instanceof McpConnectionError) {
      return Response.json(
        {
          error: error.status === 401 ? 'invalid_token' : error.code,
          error_description: error.message,
        },
        {
          status: error.status,
          headers:
            error.status === 401
              ? challenge('invalid_token')
              : error.code === 'insufficient_scope'
                ? challenge('insufficient_scope')
                : undefined,
        },
      );
    }
    throw error;
  }
};
