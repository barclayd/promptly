import { IconArrowLeft, IconHistory } from '@tabler/icons-react';
import { useState } from 'react';
import { Link, useLoaderData } from 'react-router';
import { toast } from 'sonner';
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
import { cloudflareContext, orgContext, sessionContext } from '~/context';
import { useAuthoringDialog } from '~/hooks/use-authoring-dialog';
import {
  type AuthoringChange,
  getAuthoringChange,
  listAuthoringChanges,
} from '~/lib/authoring/history.server';
import { parseAuthoringValue } from '~/lib/authoring/normalize';
import { AuthoringError } from '~/lib/authoring/types';
import { authoringHistoryListInputSchema } from '~/lib/validations/authoring-history';
import type { Route } from './+types/activity';

export const meta = () => [{ title: 'Activity | Promptly' }];
export const headers = () => ({ 'Cache-Control': 'private, no-store' });

export const loader = async ({ request, context }: Route.LoaderArgs) => {
  const org = context.get(orgContext);
  const session = context.get(sessionContext);
  if (!org || !session?.user)
    throw new Response('Unauthorized', { status: 403 });
  const db = context.get(cloudflareContext).env.promptly;
  const principal = {
    source: 'browser' as const,
    userId: session.user.id,
    organizationId: org.organizationId,
  };
  const params = new URL(request.url).searchParams;
  try {
    const filter = parseAuthoringValue(authoringHistoryListInputSchema, {
      ...(params.has('kind') ? { kind: params.get('kind') } : {}),
      ...(params.has('id') ? { id: params.get('id') } : {}),
      offset: Number(params.get('offset') ?? 0),
      limit: 25,
    });
    const changes = await listAuthoringChanges(db, principal, filter);
    const changeId = params.get('change');
    const selected = changeId
      ? await getAuthoringChange(db, principal, { changeId })
      : null;
    return { changes, selected, filter };
  } catch (error) {
    if (error instanceof AuthoringError)
      throw new Response(error.message, {
        status:
          error.code === 'access_denied'
            ? 403
            : error.code === 'change_not_found'
              ? 404
              : 400,
      });
    throw error;
  }
};

const dateLabel = (timestamp: number) =>
  new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'UTC',
  }).format(timestamp);

const sourceLabel = (actor: AuthoringChange['change']['actor']) =>
  actor.source === 'mcp' ? actor.clientName || 'MCP client' : 'Promptly';

const operationLabel = (operation: string) => {
  const verb = operation.split(/[_.]/)[0] ?? operation;
  return (
    (
      {
        create: 'Created',
        update: 'Edited',
        publish: 'Published',
        restore: 'Restored',
        delete: 'Deleted',
      } as Record<string, string>
    )[verb] ?? verb
  );
};

const RestoreDraft = ({
  change,
  phase,
}: {
  change: AuthoringChange;
  phase: 'before' | 'after';
}) => {
  const [open, setOpen] = useState(false);
  const authoring = useAuthoringDialog(
    change.change.document.kind,
    change.change.document.id,
  );
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" disabled={!change[phase]}>
          Restore {phase} as draft
        </Button>
      </DialogTrigger>
      <DialogContent ref={authoring.mount} className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Restore {change.change.document.name}</DialogTitle>
          <DialogDescription>
            The state {phase} this change will become the shared draft.
            Published versions stay in the version history.
          </DialogDescription>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          {operationLabel(change.change.operation)} by{' '}
          {change.change.actor.name} · {dateLabel(change.change.createdAt)} UTC
        </p>
        {authoring.error && (
          <p role="alert" className="text-sm text-destructive">
            {authoring.error}
          </p>
        )}
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline">
              Cancel
            </Button>
          </DialogClose>
          <Button
            disabled={authoring.disabled}
            onClick={async () => {
              if (
                await authoring.restore({ changeId: change.change.id, phase })
              ) {
                toast.success('Restored as draft');
                setOpen(false);
              }
            }}
          >
            {authoring.busy
              ? 'Restoring…'
              : authoring.retrying
                ? 'Retry restore'
                : 'Restore draft'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const ChangeDetails = ({ selected }: { selected: AuthoringChange }) => {
  const before = selected.before
    ? { ...selected.before.definition, folderId: selected.before.folderId }
    : null;
  const after = {
    ...selected.after.definition,
    folderId: selected.after.folderId,
  };
  const entries = Object.entries(after).filter(
    ([key, value]) =>
      JSON.stringify(before?.[key as keyof typeof before]) !==
      JSON.stringify(value),
  );
  return (
    <section
      aria-label="Change details"
      className="min-w-0 space-y-5 rounded-xl border bg-card p-4 sm:p-6"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="break-words text-lg font-semibold">
            {selected.change.document.name}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {operationLabel(selected.change.operation)} by{' '}
            {selected.change.actor.name} via{' '}
            {sourceLabel(selected.change.actor)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {dateLabel(selected.change.createdAt)} UTC
          </p>
        </div>
        <Button asChild size="sm" variant="outline">
          <Link
            to={`/${selected.change.document.kind}s/${selected.change.document.id}`}
          >
            Open editor
          </Link>
        </Button>
      </div>
      <div className="flex flex-wrap gap-2">
        <RestoreDraft change={selected} phase="before" />
        <RestoreDraft change={selected} phase="after" />
      </div>
      {entries.length ? (
        entries.map(([key, value]) => (
          <section
            key={key}
            aria-label={`${key} changes`}
            className="space-y-2"
          >
            <h3 className="text-sm font-medium">
              {(
                {
                  systemMessage: 'System message',
                  userMessage: 'User message',
                  config: 'Configuration',
                  snippets: 'Snippet references',
                  folderId: 'Folder',
                  content: 'Content',
                  name: 'Name',
                  description: 'Description',
                } as Record<string, string>
              )[key] ?? key}
            </h3>
            <div className="grid min-w-0 gap-3 lg:grid-cols-2">
              {(['Before', 'After'] as const).map((label) => {
                const content =
                  label === 'Before'
                    ? before?.[key as keyof typeof before]
                    : value;
                return (
                  <div key={label} className="min-w-0 rounded-lg border">
                    <h4 className="border-b bg-muted/40 px-3 py-2 text-xs font-medium">
                      {label}
                    </h4>
                    <pre className="max-h-80 overflow-auto whitespace-pre-wrap break-words p-3 text-xs leading-relaxed">
                      {content === undefined
                        ? 'Not present'
                        : typeof content === 'string'
                          ? content || '(empty)'
                          : JSON.stringify(content, null, 2)}
                    </pre>
                  </div>
                );
              })}
            </div>
          </section>
        ))
      ) : (
        <p className="text-sm text-muted-foreground">
          No saved definition fields changed. This action updated publication or
          revision information.
        </p>
      )}
    </section>
  );
};

const Activity = () => {
  const { changes, selected, filter } = useLoaderData<typeof loader>();
  const href = (values: { change?: string; offset?: number } = {}) => {
    const params = new URLSearchParams();
    if (filter.kind) params.set('kind', filter.kind);
    if (filter.id) params.set('id', filter.id);
    if (values.change) params.set('change', values.change);
    if (values.offset) params.set('offset', String(values.offset));
    return `/activity?${params}`;
  };
  return (
    <main className="min-w-0 space-y-6 p-4 md:p-6 lg:p-8">
      <header>
        <div className="flex items-center gap-2">
          <IconHistory className="size-5" aria-hidden="true" />
          <h1 className="text-xl font-semibold">Activity</h1>
        </div>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Review prompt and composer changes from Promptly and connected
          assistants. Changes and restorable drafts are kept for 90 days.
        </p>
      </header>
      {selected ? (
        <>
          <Button asChild variant="ghost" size="sm">
            <Link to={href({ offset: filter.offset })}>
              <IconArrowLeft className="size-4" />
              All changes
            </Link>
          </Button>
          <ChangeDetails key={selected.change.id} selected={selected} />
        </>
      ) : (
        <>
          <nav aria-label="Activity filters" className="flex flex-wrap gap-2">
            {[
              ['All changes', '/activity', !filter.kind],
              ['Prompts', '/activity?kind=prompt', filter.kind === 'prompt'],
              [
                'Composers',
                '/activity?kind=composer',
                filter.kind === 'composer',
              ],
            ].map(([label, url, active]) => (
              <Button
                key={String(label)}
                asChild
                size="sm"
                variant={active ? 'secondary' : 'ghost'}
              >
                <Link
                  to={String(url)}
                  aria-current={active ? 'page' : undefined}
                >
                  {label}
                </Link>
              </Button>
            ))}
          </nav>
          {changes.items.length ? (
            <ul className="divide-y overflow-hidden rounded-xl border bg-card">
              {changes.items.map((change) => (
                <li key={change.id}>
                  <Link
                    to={href({ change: change.id, offset: filter.offset })}
                    className="block space-y-1 px-4 py-4 hover:bg-muted/40 focus-visible:outline-2 focus-visible:outline-ring sm:px-5"
                  >
                    <p className="break-words text-sm font-medium">
                      {change.document.name}{' '}
                      <span className="font-normal text-muted-foreground">
                        · {operationLabel(change.operation)}
                      </span>
                    </p>
                    <p className="break-words text-xs text-muted-foreground">
                      {change.actor.name} via {sourceLabel(change.actor)} ·{' '}
                      {dateLabel(change.createdAt)} UTC
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="rounded-xl border bg-card p-6 text-sm text-muted-foreground">
              No changes recorded in the last 90 days.
            </p>
          )}
          <nav
            aria-label="Activity pages"
            className="flex justify-between gap-3"
          >
            {filter.offset > 0 ? (
              <Button asChild variant="outline" size="sm">
                <Link to={href({ offset: Math.max(0, filter.offset - 25) })}>
                  Newer changes
                </Link>
              </Button>
            ) : (
              <span />
            )}
            {changes.nextOffset !== null && (
              <Button asChild variant="outline" size="sm">
                <Link to={href({ offset: changes.nextOffset })}>
                  Older changes
                </Link>
              </Button>
            )}
          </nav>
        </>
      )}
    </main>
  );
};

export default Activity;
