import { data } from 'react-router';
import { cloudflareContext, userContext } from '~/context';
import {
  requireMcpEnabled,
  requireMcpSameOrigin,
} from '~/lib/mcp/config.server';
import { McpConnectionError } from '~/lib/mcp/connections.server';
import {
  createExternalMcpServer,
  deleteExternalMcpServer,
  getExternalMcpBridgeUrl,
  rotateExternalMcpServerKey,
} from '~/lib/mcp/external-servers.server';
import { getMcpOAuthApi } from '~/lib/mcp/oauth.server';
import { externalMcpServerFormSchema } from '~/lib/validations/mcp-external';
import type { Route } from './+types/mcp.servers';

// The response can carry a key, which must never be cached.
const noStore = { 'Cache-Control': 'no-store' };

export const action = async ({ request, context }: Route.ActionArgs) => {
  const { env, ctx } = context.get(cloudflareContext);
  requireMcpSameOrigin(request, env);
  requireMcpEnabled(env);
  const user = context.get(userContext);
  const parsed = externalMcpServerFormSchema.safeParse(
    Object.fromEntries(await request.formData()),
  );
  if (!parsed.success)
    return data(
      {
        error:
          parsed.error.issues[0]?.message ?? 'Check the MCP server details.',
      },
      { status: 400, headers: noStore },
    );
  const form = parsed.data;
  try {
    if (form.intent === 'delete') {
      const revoked = await deleteExternalMcpServer(env, user.id, form.id);
      ctx.waitUntil(
        Promise.all(
          revoked.flatMap((connection) =>
            connection.grant_id
              ? [
                  getMcpOAuthApi(env)
                    .revokeGrant(connection.grant_id, connection.user_id)
                    .catch(() => {
                      console.error(
                        JSON.stringify({
                          event: 'mcp_grant_cleanup_failed',
                          connectionId: connection.id,
                        }),
                      );
                    }),
                ]
              : [],
          ),
        ),
      );
      return data({ intent: form.intent, id: form.id }, { headers: noStore });
    }
    const { server, key } =
      form.intent === 'create'
        ? await createExternalMcpServer(env, user.id, form)
        : await rotateExternalMcpServerKey(env, user.id, form.id);
    return data(
      {
        intent: form.intent,
        id: server.id,
        name: server.name,
        key,
        bridgeUrl: getExternalMcpBridgeUrl(env, server.id),
      },
      { headers: noStore },
    );
  } catch (error) {
    if (!(error instanceof McpConnectionError)) throw error;
    return data(
      { error: error.message },
      { status: error.status, headers: noStore },
    );
  }
};
