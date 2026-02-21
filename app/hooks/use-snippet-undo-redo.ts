import { useSyncExternalStore } from 'react';
import { useSnippetEditorStore } from '~/stores/snippet-editor-store';

let listenerSetup = false;

const setupUndoRedoListener = () => {
  if (typeof window === 'undefined') return;
  if (listenerSetup) return;
  listenerSetup = true;

  document.addEventListener(
    'beforeinput',
    (e) => {
      if (e.inputType !== 'historyUndo' && e.inputType !== 'historyRedo')
        return;

      const target = e.target as HTMLElement;
      const isManagedUndo = target.dataset.managedUndo !== undefined;

      if (!isManagedUndo) return;

      e.preventDefault();

      const temporal = useSnippetEditorStore.temporal.getState();
      if (e.inputType === 'historyRedo') {
        temporal.redo();
      } else {
        temporal.undo();
      }
    },
    true,
  );

  document.addEventListener(
    'keydown',
    (e) => {
      if (!((e.metaKey || e.ctrlKey) && e.key === 'z')) return;

      const target = e.target as HTMLElement;
      const isTextInput =
        target.tagName === 'INPUT' || target.tagName === 'TEXTAREA';
      const isManagedUndo = target.dataset.managedUndo !== undefined;

      if (isTextInput && !isManagedUndo) return;
      if (!isManagedUndo) return;

      e.preventDefault();

      const temporal = useSnippetEditorStore.temporal.getState();
      if (e.shiftKey) {
        temporal.redo();
      } else {
        temporal.undo();
      }
    },
    true,
  );
};

const subscribeToTemporal = (callback: () => void) => {
  return useSnippetEditorStore.temporal.subscribe(callback);
};

const getCanUndo = () => {
  const state = useSnippetEditorStore.temporal.getState();
  return state.pastStates.length > 0;
};

const getCanRedo = () => {
  const state = useSnippetEditorStore.temporal.getState();
  return state.futureStates.length > 0;
};

export const useSnippetUndoRedo = () => {
  setupUndoRedoListener();

  const canUndo = useSyncExternalStore(
    subscribeToTemporal,
    getCanUndo,
    () => false,
  );
  const canRedo = useSyncExternalStore(
    subscribeToTemporal,
    getCanRedo,
    () => false,
  );

  const undo = () => {
    useSnippetEditorStore.temporal.getState().undo();
  };

  const redo = () => {
    useSnippetEditorStore.temporal.getState().redo();
  };

  return { canUndo, canRedo, undo, redo };
};
