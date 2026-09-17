import {
  IconCheck,
  IconCopy,
  IconExternalLink,
  IconPlugConnected,
} from '@tabler/icons-react';
import { useState } from 'react';
import { Link, useFetcher } from 'react-router';
import { Badge } from '~/components/ui/badge';
import { Button } from '~/components/ui/button';
import type { McpPermission } from '~/lib/validations/mcp';

export type McpSettingsConnection = {
  id: string;
  clientName: string;
  clientId: string;
  userName: string;
  userEmail: string;
  permission: McpPermission;
  grantId: string | null;
  createdAt: number;
  lastUsedAt: number | null;
  revokedAt: number | null;
  canRevoke: boolean;
};

export type McpSettingsProps = {
  serverUrl: string;
  enabled: boolean;
  authoringEnabled?: boolean;
  connections: McpSettingsConnection[];
  canManageWorkspaceConnections: boolean;
  setupHref?: string;
  error?: string;
  notice?: string;
};

const permissionLabels: Record<McpPermission, string> = {
  read: 'Read only',
  edit: 'Create and edit drafts',
  publish: 'Create, edit, and publish',
};

const formatDate = (timestamp: number | null): string => {
  if (timestamp === null) return 'Not used yet';
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(timestamp);
};

const McpCopyButton = ({ value, label }: { value: string; label: string }) => {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setError(false);
    } catch {
      setError(true);
      setCopied(false);
    }
  };

  return (
    <div className="flex shrink-0 flex-col items-end gap-1">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={handleCopy}
        aria-label={copied ? `${label} copied` : `Copy ${label.toLowerCase()}`}
      >
        {copied ? (
          <IconCheck className="size-4" aria-hidden="true" />
        ) : (
          <IconCopy className="size-4" aria-hidden="true" />
        )}
        <span aria-live="polite">{copied ? 'Copied' : 'Copy'}</span>
      </Button>
      {error && (
        <span role="alert" className="max-w-48 text-xs text-destructive">
          Select and copy the text manually.
        </span>
      )}
    </div>
  );
};

const McpConnection = ({
  connection,
}: {
  connection: McpSettingsConnection;
}) => {
  const fetcher = useFetcher<{ error?: string }>();
  const isRevoking = fetcher.state !== 'idle';
  const isRevoked = connection.revokedAt !== null;
  const isAwaitingClient = connection.grantId === null;
  const status = isRevoked
    ? 'Revoked'
    : isAwaitingClient
      ? 'Awaiting client'
      : 'Connected';

  return (
    <li className="p-4 sm:p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="min-w-0 break-words text-sm font-medium">
              {connection.clientName}
            </span>
            <Badge variant="outline">{status}</Badge>
          </div>
          <p className="mt-1 break-all text-sm text-muted-foreground">
            {connection.userName}
            {connection.userName && ' · '}
            {connection.userEmail}
          </p>
          <p className="mt-3 text-sm">
            {permissionLabels[connection.permission]}
          </p>
          <dl className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground">
            <div className="flex gap-1">
              <dt>{isAwaitingClient ? 'Approved' : 'Connected'}</dt>
              <dd>{formatDate(connection.createdAt)}</dd>
            </div>
            <div className="flex gap-1">
              <dt>Last used</dt>
              <dd>{formatDate(connection.lastUsedAt)}</dd>
            </div>
            {isRevoked && (
              <div className="flex gap-1">
                <dt>Revoked</dt>
                <dd>{formatDate(connection.revokedAt)}</dd>
              </div>
            )}
          </dl>
          <details className="mt-3 text-xs text-muted-foreground">
            <summary className="w-fit cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring">
              Client details
            </summary>
            <p className="mt-2 break-all">{connection.clientId}</p>
          </details>
        </div>
        {!isRevoked && connection.canRevoke && (
          <fetcher.Form method="post" action="/api/mcp/revoke">
            <input type="hidden" name="connectionId" value={connection.id} />
            <Button
              type="submit"
              variant="outline"
              size="sm"
              disabled={isRevoking}
              aria-label={`Revoke ${connection.clientName} connection for ${connection.userEmail}`}
            >
              {isRevoking ? 'Revoking…' : 'Revoke access'}
            </Button>
          </fetcher.Form>
        )}
      </div>
      {fetcher.data?.error && (
        <p role="alert" className="mt-3 text-sm text-destructive">
          {fetcher.data.error}
        </p>
      )}
    </li>
  );
};

const McpClientGuides = ({
  serverUrl,
  authoringEnabled,
}: {
  serverUrl: string;
  authoringEnabled: boolean;
}) => {
  const scopes = authoringEnabled
    ? ['mcp:read', 'mcp:write', 'mcp:publish']
    : ['mcp:read'];
  const clients = [
    {
      name: 'Codex',
      steps:
        'Add Promptly using the commands below, then sign in to Promptly in your browser. If Promptly is already configured, run codex mcp logout promptly and repeat only the login command.',
      code: `codex mcp add promptly --url ${serverUrl}\ncodex mcp login promptly --scopes ${scopes.join(',')}`,
      docs: 'https://developers.openai.com/codex/mcp',
    },
    {
      name: 'Claude Code',
      steps:
        'Run this command, then open /mcp in Claude Code. Select Promptly and follow the sign-in flow. If Promptly is already in your local configuration, run claude mcp remove promptly before adding it again. Use Reconnect in /mcp to refresh the tools after signing in.',
      code: `claude mcp add-json promptly '${JSON.stringify({
        type: 'http',
        url: serverUrl,
        oauth: { scopes: scopes.join(' ') },
      })}'`,
      docs: 'https://code.claude.com/docs/en/mcp',
    },
    {
      name: 'Cursor',
      steps:
        'Use Register a client below, or open /settings/mcp/clients. Enter these three callback URLs, one per line: cursor://anysphere.cursor-mcp/oauth/callback, http://localhost:8787/callback, and https://www.cursor.com/agents/mcp/oauth/callback. Choose No — public client. Replace YOUR_PROMPTLY_CLIENT_ID below with the returned client ID, then add the entry to .cursor/mcp.json. Enable Promptly in Cursor and sign in.',
      code: JSON.stringify(
        {
          mcpServers: {
            promptly: {
              url: serverUrl,
              auth: {
                CLIENT_ID: 'YOUR_PROMPTLY_CLIENT_ID',
                scopes,
              },
            },
          },
        },
        null,
        2,
      ),
      docs: 'https://cursor.com/docs/mcp',
    },
    {
      name: 'ChatGPT',
      steps:
        'Enable developer mode, then open Plugins > Create app. Enter the Promptly server URL and select OAuth. Under Advanced OAuth settings, keep the detected default (CIMD). Create the app, then sign in to Promptly. If the actions list is initially empty, select Refresh actions. Workspace access may need to be enabled by your administrator.',
      docs: 'https://help.openai.com/en/articles/12584461-developer-mode-and-mcp-apps-in-chatgpt-beta',
    },
    {
      name: 'Claude',
      steps:
        'Open Customize > Connectors and add a custom connector with the Promptly server URL. Connect it and sign in to Promptly. On Team and Enterprise plans, a workspace owner first adds the connector for the organization.',
      docs: 'https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp',
    },
  ];

  return (
    <div className="overflow-hidden rounded-xl border bg-card divide-y">
      {clients.map((client) => (
        <details key={client.name} className="group p-4 sm:p-5">
          <summary className="cursor-pointer text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring">
            {client.name}
          </summary>
          <div className="mt-3 space-y-3">
            <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
              {client.steps}
            </p>
            {client.code && (
              <div className="space-y-2 rounded-lg border bg-muted/40 p-3">
                <div className="flex justify-end">
                  <McpCopyButton
                    value={client.code}
                    label={`${client.name} setup`}
                  />
                </div>
                <pre className="overflow-x-auto whitespace-pre-wrap break-all text-xs leading-relaxed">
                  <code>{client.code}</code>
                </pre>
              </div>
            )}
            <a
              href={client.docs}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm underline underline-offset-4 hover:text-muted-foreground focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
            >
              {client.name} setup guide
              <IconExternalLink className="size-3.5" aria-hidden="true" />
              <span className="sr-only"> (opens in a new tab)</span>
            </a>
          </div>
        </details>
      ))}
    </div>
  );
};

export const McpSettings = ({
  serverUrl,
  enabled,
  authoringEnabled = false,
  connections,
  canManageWorkspaceConnections,
  setupHref,
  error,
  notice,
}: McpSettingsProps) => (
  <div className="max-w-4xl space-y-8">
    <section aria-labelledby="mcp-heading" className="space-y-4">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h2 id="mcp-heading" className="text-lg font-semibold">
            MCP connections
          </h2>
        </div>
        <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Connect your AI assistant to your Promptly workspace.
        </p>
      </div>
      <div className="rounded-lg border bg-muted/40 p-4">
        <p className="text-sm font-medium">
          {enabled
            ? authoringEnabled
              ? 'Authoring enabled'
              : 'Read-only access enabled'
            : 'MCP is currently disabled'}
        </p>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
          {enabled
            ? authoringEnabled
              ? 'Read, create, edit, validate, and publish prompts and composers from your assistant. Your selected permission level controls what each connection can change.'
              : 'Check your connection and find prompts, composers, and snippets. Authoring is currently disabled.'
            : 'New connections and existing MCP access are paused. Try again when MCP is enabled.'}
        </p>
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="text-sm text-muted-foreground">
          {notice}
        </p>
      )}
      <div className="space-y-2">
        <p id="mcp-url-label" className="text-sm font-medium">
          Server URL
        </p>
        <div className="flex flex-col gap-3 rounded-lg border bg-card p-3 sm:flex-row sm:items-center sm:justify-between">
          <code className="min-w-0 break-all text-sm">{serverUrl}</code>
          <McpCopyButton value={serverUrl} label="Server URL" />
        </div>
      </div>
    </section>

    <section aria-labelledby="mcp-setup-heading" className="space-y-3">
      <h3 id="mcp-setup-heading" className="text-sm font-medium">
        Set up your assistant
      </h3>
      <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
        {enabled && authoringEnabled
          ? 'These settings let you choose Read only, Create and edit drafts, or Create, edit, and publish when you connect. Draft editing is selected by default; publishing is enabled only if you select it.'
          : 'These settings request read-only access while authoring is unavailable for this workspace.'}
      </p>
      <McpClientGuides
        serverUrl={serverUrl}
        authoringEnabled={enabled && authoringEnabled}
      />
      <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
        Already connected? Update your assistant’s setup, clear its Promptly
        authentication, and sign in again to review permissions. Refresh or
        reconnect the server in your assistant to reload its tools. Existing
        permissions do not expand automatically.
      </p>
      {setupHref && enabled && (
        <div className="flex flex-col gap-3 rounded-lg border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium">
              Your assistant needs a client ID?
            </p>
            <p className="mt-1 max-w-xl text-sm leading-relaxed text-muted-foreground">
              Register it with the exact callback URL shown by your assistant,
              then use its client ID to connect.
            </p>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link to={setupHref}>Register a client</Link>
          </Button>
        </div>
      )}
    </section>

    <section aria-labelledby="mcp-connections-heading" className="space-y-3">
      <div>
        <h3 id="mcp-connections-heading" className="text-sm font-medium">
          {canManageWorkspaceConnections
            ? 'Workspace connections'
            : 'Your connections'}
        </h3>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
          {canManageWorkspaceConnections
            ? 'You can view and revoke any connection in this workspace.'
            : 'Manage the clients you have connected to this workspace.'}
        </p>
      </div>
      {connections.length > 0 ? (
        <ul className="overflow-hidden rounded-xl border bg-card divide-y">
          {connections.map((connection) => (
            <McpConnection key={connection.id} connection={connection} />
          ))}
        </ul>
      ) : (
        <div className="flex flex-col items-start gap-3 rounded-xl border bg-card p-6">
          <IconPlugConnected
            className="size-6 text-muted-foreground"
            aria-hidden="true"
          />
          <div>
            <p className="text-sm font-medium">No connections yet</p>
            <p className="mt-1 max-w-xl text-sm leading-relaxed text-muted-foreground">
              {enabled
                ? 'Add the server URL to your assistant, then sign in to Promptly. Your connection will appear here.'
                : 'You can connect your assistant when MCP is enabled.'}
            </p>
          </div>
        </div>
      )}
    </section>
  </div>
);
