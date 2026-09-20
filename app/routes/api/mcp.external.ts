import { cloudflareContext } from '~/context';
import { handleExternalMcpBridge } from '~/lib/mcp/external.server';
import type { Route } from './+types/mcp.external';

export const action = ({ request, context, params }: Route.ActionArgs) =>
  handleExternalMcpBridge(
    request,
    context.get(cloudflareContext).env,
    params.serverId,
  );

export const loader = () =>
  Response.json(
    { error: 'method_not_allowed' },
    {
      status: 405,
      headers: { Allow: 'POST', 'Cache-Control': 'no-store' },
    },
  );
