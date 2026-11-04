import { IconAlertTriangle, IconPlus, IconServer } from '@tabler/icons-react';
import { useState } from 'react';
import { useFetcher } from 'react-router';
import { McpCopyButton } from '~/components/mcp-copy-button';
import { Button } from '~/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '~/components/ui/dialog';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import type { ExternalMcpServerListItem } from '~/lib/mcp/external-servers.server';

type ServerActionData = {
  error?: string;
  intent?: 'create' | 'rotate' | 'delete';
  name?: string;
  key?: string;
  bridgeUrl?: string;
};

const formatDate = (timestamp: number) =>
  new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(timestamp);

const toServerId = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^[-_]+|-+$/g, '')
    .slice(0, 64);

const FormError = ({ error }: { error?: string }) =>
  error ? (
    <p role="alert" className="text-sm text-destructive">
      {error}
    </p>
  ) : null;

const CopyField = ({ label, value }: { label: string; value: string }) => (
  <div className="space-y-1.5">
    <p className="text-sm font-medium">{label}</p>
    <div className="flex items-start gap-2 rounded-lg border bg-muted/40 p-3">
      <code className="min-w-0 flex-1 break-all text-sm">{value}</code>
      <McpCopyButton value={value} label={label} />
    </div>
  </div>
);

// Shown once, straight after the key is made: only its hash is kept.
const IssuedKey = ({
  data,
}: {
  data: Required<Pick<ServerActionData, 'name' | 'key' | 'bridgeUrl'>> & {
    intent: 'create' | 'rotate';
  };
}) => (
  <>
    <DialogHeader>
      <DialogTitle>
        {data.intent === 'create'
          ? `${data.name} added`
          : `New key for ${data.name}`}
      </DialogTitle>
      <DialogDescription>
        Give the service this key. It sends it to the bridge URL to check who
        has signed in.
      </DialogDescription>
    </DialogHeader>
    <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950/20">
      <IconAlertTriangle
        className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400"
        aria-hidden="true"
      />
      <p className="text-sm leading-relaxed text-amber-800 dark:text-amber-200">
        This is the only time you’ll see this key. If it’s lost, rotate it.
      </p>
    </div>
    <CopyField label="Key" value={data.key} />
    <CopyField label="Bridge URL" value={data.bridgeUrl} />
    <DialogFooter>
      <DialogClose asChild>
        <Button type="button">Done</Button>
      </DialogClose>
    </DialogFooter>
  </>
);

const issuedKey = (data: ServerActionData | undefined) =>
  data?.key &&
  data.name &&
  data.bridgeUrl &&
  (data.intent === 'create' || data.intent === 'rotate')
    ? {
        intent: data.intent,
        name: data.name,
        key: data.key,
        bridgeUrl: data.bridgeUrl,
      }
    : undefined;

// Lives inside the dialog, so each opening starts with a fresh fetcher.
const AddServerForm = () => {
  const fetcher = useFetcher<ServerActionData>();
  const [name, setName] = useState('');
  const [id, setId] = useState('');
  const [idEdited, setIdEdited] = useState(false);
  const issued = issuedKey(fetcher.data);
  if (issued) return <IssuedKey data={issued} />;

  return (
    <fetcher.Form
      method="post"
      action="/api/mcp/servers"
      className="grid gap-5"
    >
      <input type="hidden" name="intent" value="create" />
      <DialogHeader>
        <DialogTitle>Add an MCP server</DialogTitle>
        <DialogDescription>
          Let workspace members sign in to one of your own MCP servers with
          Promptly.
        </DialogDescription>
      </DialogHeader>
      <div className="grid gap-2">
        <Label htmlFor="mcp-server-name">Name</Label>
        <Input
          id="mcp-server-name"
          name="name"
          required
          maxLength={200}
          placeholder="e.g. Pagentic"
          value={name}
          onChange={(event) => {
            setName(event.target.value);
            if (!idEdited) setId(toServerId(event.target.value));
          }}
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="mcp-server-id">ID</Label>
        <Input
          id="mcp-server-id"
          name="id"
          required
          maxLength={64}
          pattern="[a-z0-9][a-z0-9_\-]*"
          aria-describedby="mcp-server-id-hint"
          value={id}
          onChange={(event) => {
            setId(event.target.value);
            setIdEdited(true);
          }}
        />
        <p id="mcp-server-id-hint" className="text-xs text-muted-foreground">
          Lowercase letters, numbers, hyphens and underscores. It’s part of the
          bridge URL, so it can’t change later.
        </p>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="mcp-server-resource">MCP URL</Label>
        <Input
          id="mcp-server-resource"
          name="resource"
          type="url"
          required
          placeholder="https://example.com/mcp"
          aria-describedby="mcp-server-resource-hint"
        />
        <p
          id="mcp-server-resource-hint"
          className="text-xs text-muted-foreground"
        >
          The exact URL people add to their assistant.
        </p>
      </div>
      <FormError error={fetcher.data?.error} />
      <DialogFooter>
        <DialogClose asChild>
          <Button type="button" variant="ghost">
            Cancel
          </Button>
        </DialogClose>
        <Button type="submit" disabled={fetcher.state !== 'idle'}>
          {fetcher.state !== 'idle' ? 'Adding…' : 'Add server'}
        </Button>
      </DialogFooter>
    </fetcher.Form>
  );
};

const RotateKeyForm = ({ server }: { server: ExternalMcpServerListItem }) => {
  const fetcher = useFetcher<ServerActionData>();
  const issued = issuedKey(fetcher.data);
  if (issued) return <IssuedKey data={issued} />;

  return (
    <fetcher.Form
      method="post"
      action="/api/mcp/servers"
      className="grid gap-5"
    >
      <input type="hidden" name="intent" value="rotate" />
      <input type="hidden" name="id" value={server.id} />
      <DialogHeader>
        <DialogTitle>Rotate the key for {server.name}?</DialogTitle>
        <DialogDescription>
          The current key stops working straight away. Sign-ins to {server.name}{' '}
          fail until the service has the new one.
        </DialogDescription>
      </DialogHeader>
      <FormError error={fetcher.data?.error} />
      <DialogFooter>
        <DialogClose asChild>
          <Button type="button" variant="ghost">
            Cancel
          </Button>
        </DialogClose>
        <Button type="submit" disabled={fetcher.state !== 'idle'}>
          {fetcher.state !== 'idle' ? 'Rotating…' : 'Rotate key'}
        </Button>
      </DialogFooter>
    </fetcher.Form>
  );
};

const RemoveServerForm = ({
  server,
}: {
  server: ExternalMcpServerListItem;
}) => {
  const fetcher = useFetcher<ServerActionData>();

  return (
    <fetcher.Form
      method="post"
      action="/api/mcp/servers"
      className="grid gap-5"
    >
      <input type="hidden" name="intent" value="delete" />
      <input type="hidden" name="id" value={server.id} />
      <DialogHeader>
        <DialogTitle>Remove {server.name}?</DialogTitle>
        <DialogDescription>
          Its key stops working and everyone connected to it through Promptly
          loses access.
        </DialogDescription>
      </DialogHeader>
      <FormError error={fetcher.data?.error} />
      <DialogFooter>
        <DialogClose asChild>
          <Button type="button" variant="ghost">
            Cancel
          </Button>
        </DialogClose>
        <Button
          type="submit"
          variant="destructive"
          disabled={fetcher.state !== 'idle'}
        >
          {fetcher.state !== 'idle' ? 'Removing…' : 'Remove server'}
        </Button>
      </DialogFooter>
    </fetcher.Form>
  );
};

const McpServer = ({ server }: { server: ExternalMcpServerListItem }) => (
  <li className="p-4 sm:p-5">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0 flex-1">
        <p className="break-words text-sm font-medium">{server.name}</p>
        <p className="mt-1 break-all text-sm text-muted-foreground">
          {server.resource}
        </p>
        <dl className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground">
          <div className="flex gap-1">
            <dt>ID</dt>
            <dd>
              <code>{server.id}</code>
            </dd>
          </div>
          <div className="flex gap-1">
            <dt>Key</dt>
            <dd>
              <code>{server.keyStart}…</code>
            </dd>
          </div>
          <div className="flex gap-1">
            <dt>Added</dt>
            <dd>{formatDate(server.createdAt)}</dd>
          </div>
          {server.keyCreatedAt !== server.createdAt && (
            <div className="flex gap-1">
              <dt>Key rotated</dt>
              <dd>{formatDate(server.keyCreatedAt)}</dd>
            </div>
          )}
        </dl>
      </div>
      <div className="flex shrink-0 gap-2">
        <Dialog>
          <DialogTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="sm"
              aria-label={`Rotate the key for ${server.name}`}
            >
              Rotate key
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <RotateKeyForm server={server} />
          </DialogContent>
        </Dialog>
        <Dialog>
          <DialogTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="sm"
              aria-label={`Remove ${server.name}`}
            >
              Remove
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <RemoveServerForm server={server} />
          </DialogContent>
        </Dialog>
      </div>
    </div>
  </li>
);

export const McpServers = ({
  servers,
}: {
  servers: ExternalMcpServerListItem[];
}) => (
  <section aria-labelledby="mcp-servers-heading" className="space-y-3">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h3 id="mcp-servers-heading" className="text-sm font-medium">
          Your MCP servers
        </h3>
        <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Let workspace members sign in to your own MCP servers with Promptly.
          Each server gets a key for checking who has signed in.
        </p>
      </div>
      <Dialog>
        <DialogTrigger asChild>
          <Button type="button" variant="outline" size="sm">
            <IconPlus aria-hidden="true" />
            Add server
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-lg">
          <AddServerForm />
        </DialogContent>
      </Dialog>
    </div>
    {servers.length > 0 ? (
      <ul className="overflow-hidden rounded-xl border bg-card divide-y">
        {servers.map((server) => (
          <McpServer key={server.id} server={server} />
        ))}
      </ul>
    ) : (
      <div className="flex flex-col items-start gap-3 rounded-xl border bg-card p-6">
        <IconServer
          className="size-6 text-muted-foreground"
          aria-hidden="true"
        />
        <p className="text-sm text-muted-foreground">No MCP servers yet.</p>
      </div>
    )}
  </section>
);
