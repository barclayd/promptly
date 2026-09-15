import { data, redirect } from 'react-router';
import { cloudflareContext, userContext } from '~/context';
import { requireMcpSameOrigin } from '~/lib/mcp/config.server';
import {
  McpConnectionError,
  revokeMcpConnection,
} from '~/lib/mcp/connections.server';
import { getMcpOAuthApi } from '~/lib/mcp/oauth.server';
import { revokeMcpConnectionSchema } from '~/lib/validations/mcp';
import type { Route } from './+types/mcp.revoke';

export const action = async ({ request, context }: Route.ActionArgs) => {
  const { env, ctx } = context.get(cloudflareContext);
  requireMcpSameOrigin(request, env);
  const user = context.get(userContext);
  const parsed = revokeMcpConnectionSchema.safeParse(
    Object.fromEntries(await request.formData()),
  );
  if (!parsed.success)
    return data({ error: 'Invalid connection.' }, { status: 400 });
  try {
    const connection = await revokeMcpConnection(env.promptly, {
      ...parsed.data,
      userId: user.id,
    });
    if (connection.grantId) {
      ctx.waitUntil(
        getMcpOAuthApi(env)
          .revokeGrant(connection.grantId, connection.userId)
          .catch(() => {
            console.error(
              JSON.stringify({
                event: 'mcp_grant_cleanup_failed',
                connectionId: connection.id,
              }),
            );
          }),
      );
    }
    return redirect('/settings?tab=mcp&notice=revoked');
  } catch (error) {
    if (!(error instanceof McpConnectionError)) throw error;
    return data({ error: error.message }, { status: error.status });
  }
};
