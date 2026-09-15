import { useCallback, useMemo, useSyncExternalStore } from 'react';
import type { BrowserAuthoringDocument } from '~/lib/authoring/browser-types';
import {
  attachBrowserEditorSession,
  getBrowserEditorSession,
} from '~/lib/authoring/editor-session';
import { subscribeToPresenceEvents } from './use-presence';

export const useBrowserAuthoring = (
  document: BrowserAuthoringDocument,
  readOnly: boolean,
) => {
  const session = useMemo(() => getBrowserEditorSession(document), [document]);
  const snapshot = useSyncExternalStore(
    session.subscribe,
    session.getSnapshot,
    session.getSnapshot,
  );
  const editorRef = useCallback(
    (node: HTMLElement | null) => {
      if (!node || readOnly) return;
      session.receiveRemote(document);
      const detach = attachBrowserEditorSession(session);
      const unsubscribe = subscribeToPresenceEvents(document.id, {
        onSavedRevision: (event) => {
          if (event.kind === document.kind) void session.refresh();
        },
        onConnected: () => {
          void session.refresh();
        },
      });
      return () => {
        unsubscribe();
        detach();
      };
    },
    [session, document, readOnly],
  );
  return { session, snapshot, editorRef };
};

const subscribeIdle = () => () => {};
const getIdle = () => null;

export const useBrowserAuthoringState = (
  document: BrowserAuthoringDocument | undefined,
) => {
  const session = useMemo(
    () => (document ? getBrowserEditorSession(document) : null),
    [document],
  );
  return useSyncExternalStore(
    session?.subscribe ?? subscribeIdle,
    session?.getSnapshot ?? getIdle,
    session?.getSnapshot ?? getIdle,
  );
};
