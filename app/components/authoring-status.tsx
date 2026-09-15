import { IconAlertTriangle, IconCheck, IconRefresh } from '@tabler/icons-react';
import { useSyncExternalStore } from 'react';
import { Button } from '~/components/ui/button';
import type { BrowserEditorSession } from '~/lib/authoring/editor-session';

export const AuthoringStatus = ({
  session,
}: {
  session: BrowserEditorSession;
}) => {
  const state = useSyncExternalStore(
    session.subscribe,
    session.getSnapshot,
    session.getSnapshot,
  );
  const conflict = state.conflict;
  const reviewBlocked = !conflict?.remote || Boolean(state.inFlight);
  const error = state.error?.message ?? state.refreshError;
  if (!conflict && !error) {
    return (
      <div
        role="status"
        className="flex items-center gap-2 px-4 py-2 text-xs text-muted-foreground lg:px-6"
      >
        {state.isSaving ? (
          <IconRefresh className="size-3.5 animate-spin" aria-hidden="true" />
        ) : (
          <IconCheck className="size-3.5" aria-hidden="true" />
        )}
        {state.isDeleting
          ? 'Deleting…'
          : state.isSaving
            ? 'Saving…'
            : state.dirty
              ? 'Changes waiting to save'
              : 'All changes saved'}
      </div>
    );
  }
  return (
    <section
      aria-label="Draft save status"
      className="m-4 space-y-3 rounded-lg border border-amber-500/40 bg-amber-50 p-4 text-sm text-amber-950 dark:bg-amber-500/10 dark:text-amber-100 lg:mx-6"
    >
      <div className="flex gap-2">
        <IconAlertTriangle
          className="mt-0.5 size-4 shrink-0"
          aria-hidden="true"
        />
        <div className="min-w-0 space-y-1">
          <p role="status" className="font-medium">
            {conflict
              ? 'This draft changed elsewhere'
              : 'Your changes haven’t been saved'}
          </p>
          <p>
            {conflict
              ? 'Your edits are preserved here. Review the saved version before choosing which changes to keep.'
              : error}
          </p>
          {conflict && error && <p>{error}</p>}
        </div>
      </div>
      {conflict?.remote && (
        <details className="rounded-md border border-current/15 p-3">
          <summary className="cursor-pointer font-medium">
            Review local and saved changes
          </summary>
          <div className="mt-3 grid min-w-0 gap-4 md:grid-cols-2">
            {[
              ['Your local draft', state.definition],
              ['Saved version', conflict.remote.definition],
            ].map(([label, definition]) => (
              <div key={String(label)} className="min-w-0">
                <h3 className="mb-2 font-medium">{String(label)}</h3>
                <pre className="max-h-72 overflow-auto whitespace-pre-wrap break-words rounded bg-background p-3 text-xs text-foreground">
                  {JSON.stringify(definition, null, 2)}
                </pre>
              </div>
            ))}
          </div>
        </details>
      )}
      <div className="flex flex-wrap gap-2">
        {state.error && (
          <Button
            size="sm"
            variant="outline"
            disabled={state.isSaving}
            onClick={() => {
              void session.retry();
            }}
          >
            Retry save
          </Button>
        )}
        {conflict && (
          <>
            <Button
              size="sm"
              variant="outline"
              disabled={reviewBlocked}
              onClick={() => session.acceptRemote()}
            >
              Use saved version
            </Button>
            <Button
              size="sm"
              disabled={reviewBlocked}
              onClick={() => {
                if (session.reapplyLocal()) void session.flush();
              }}
            >
              Reapply my changes
            </Button>
          </>
        )}
        {(state.refreshError || (conflict && !conflict.remote)) && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              void session.refresh();
            }}
          >
            Load saved version
          </Button>
        )}
      </div>
      {state.inFlight && state.error?.kind === 'network' && (
        <p className="text-xs">
          Retry to confirm the previous request before resolving this draft.
        </p>
      )}
    </section>
  );
};
