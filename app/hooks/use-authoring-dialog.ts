import { useCallback, useRef, useState, useSyncExternalStore } from 'react';
import { useRevalidator } from 'react-router';
import type { BrowserAuthoringKind } from '~/lib/authoring/browser-types';
import {
  type BrowserEditorSession,
  getOrLoadEditorSession,
} from '~/lib/authoring/editor-session';

const subscribeNothing = () => () => {};
const emptySnapshot = () => null;
const conflictMessage =
  'This document changed while you were editing. Your entries are preserved. Open the editor to review the current draft before trying again.';

export const useAuthoringDialog = (kind: BrowserAuthoringKind, id: string) => {
  const [session, setSession] = useState<BrowserEditorSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const opened = useRef<{ name: string; description: string } | null>(null);
  const openedRemoteGeneration = useRef(0);
  const revalidator = useRevalidator();
  const snapshot = useSyncExternalStore(
    session?.subscribe ?? subscribeNothing,
    session?.getSnapshot ?? emptySnapshot,
    emptySnapshot,
  );

  const mount = useCallback(
    (node: HTMLDivElement | null) => {
      if (!node) return;
      let mounted = true;
      setLoading(true);
      setError(null);
      setSession(null);
      opened.current = null;
      void getOrLoadEditorSession(kind, id)
        .then((current) => {
          if (!mounted) return;
          opened.current = {
            name: current.getSnapshot().definition.name,
            description: current.getSnapshot().definition.description,
          };
          openedRemoteGeneration.current =
            current.getSnapshot().remoteGeneration;
          setSession(current);
          setLoading(false);
        })
        .catch(() => {
          if (!mounted) return;
          setError(
            'Unable to load this document. Close and reopen to try again.',
          );
          setLoading(false);
        });
      return () => {
        mounted = false;
      };
    },
    [kind, id],
  );

  const perform = async (
    operation: 'save' | 'publish' | 'delete' | 'restore',
    input?:
      | { name: string; description: string }
      | { changeId: string; phase: 'before' | 'after' }
      | string,
  ): Promise<boolean> => {
    if (!session || busy) return false;
    setBusy(true);
    setError(null);
    try {
      const state = session.getSnapshot();
      if (
        (operation === 'restore' ||
          operation === 'publish' ||
          operation === 'delete') &&
        state.remoteGeneration !== openedRemoteGeneration.current &&
        state.error?.kind !== 'network'
      ) {
        setError(
          'The current draft changed after you opened this dialog. Close and reopen it to review the latest state before continuing.',
        );
        return false;
      }
      const pending = state.inFlight;
      const sameCommand =
        pending?.kind === 'publish' &&
        pending.input.operation === operation &&
        (pending.input.operation === 'restore'
          ? typeof input === 'object' &&
            'changeId' in input &&
            input.changeId === pending.input.changeId &&
            input.phase === pending.input.phase
          : pending.input.operation !== 'publish' ||
            pending.input.version === input);
      if (
        state.error?.kind === 'network' &&
        pending?.kind === 'publish' &&
        !sameCommand
      ) {
        setError(
          'An earlier operation is still awaiting confirmation. Open the editor and retry that request before starting a different change.',
        );
        return false;
      }
      if (
        operation === 'save' &&
        typeof input === 'object' &&
        'name' in input
      ) {
        const baseline = opened.current;
        if (
          !baseline ||
          (['name', 'description'] as const).some(
            (key) =>
              state.definition[key] !== baseline[key] &&
              state.definition[key] !== input[key],
          )
        ) {
          setError(conflictMessage);
          return false;
        }
        session.stage(input);
      }
      let result: Awaited<ReturnType<BrowserEditorSession['flush']>>;
      if (state.error?.kind === 'network') {
        result = await session.retry();
        if (result.status === 'blocked') {
          setError(
            result.reason === 'conflict'
              ? conflictMessage
              : (session.getSnapshot().error?.message ??
                  'Unable to finish the request.'),
          );
          return false;
        }
        if (operation === 'save' || sameCommand) {
          void revalidator.revalidate();
          return true;
        }
      }
      result =
        operation === 'save'
          ? await session.flush()
          : operation === 'delete'
            ? await session.delete()
            : operation === 'restore' &&
                typeof input === 'object' &&
                'changeId' in input
              ? await session.restore(input)
              : await session.publish(
                  typeof input === 'string' ? input : undefined,
                );
      if (result.status === 'saved') {
        void revalidator.revalidate();
        return true;
      }
      setError(
        result.reason === 'conflict'
          ? conflictMessage
          : (session.getSnapshot().error?.message ??
              'Another request is still finishing. Try again shortly.'),
      );
      return false;
    } catch {
      setError(
        'The outcome could not be confirmed. Retry to check the same request.',
      );
      return false;
    } finally {
      setBusy(false);
    }
  };

  return {
    mount,
    snapshot,
    loading,
    busy,
    disabled:
      loading ||
      !session ||
      busy ||
      (Boolean(snapshot?.conflict) && snapshot?.error?.kind !== 'network'),
    retrying: snapshot?.error?.kind === 'network',
    error:
      error ??
      (snapshot?.conflict ? conflictMessage : snapshot?.error?.message),
    initialDetails: opened.current,
    saveDetails: (details: { name: string; description: string }) =>
      perform('save', details),
    publish: (version: string) => perform('publish', version),
    delete: () => perform('delete'),
    restore: (input: { changeId: string; phase: 'before' | 'after' }) =>
      perform('restore', input),
  };
};
