import { useSyncExternalStore } from 'react';
import { useComposerEditorStore } from '~/stores/composer-editor-store';

let composerListenerSetup = false;

const setupUndoRedoListener = () => {
  if (typeof window === 'undefined') return;
  if (composerListenerSetup) return;
  composerListenerSetup = true;

  document.addEventListener(
    'beforeinput',
    (e) => {
      if (e.inputType !== 'historyUndo' && e.inputType !== 'historyRedo')
        return;

      const target = e.target as HTMLElement;

      // Skip when focus is inside the Tiptap editor — let ProseMirror handle natively
      if (target.closest('.ProseMirror')) return;

      const isManagedUndo = target.dataset.managedUndo !== undefined;

      if (!isManagedUndo) return;

      e.preventDefault();

      const temporal = useComposerEditorStore.temporal.getState();
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

      // Skip when focus is inside the Tiptap editor — let ProseMirror handle natively
      if (target.closest('.ProseMirror')) return;

      const isTextInput =
        target.tagName === 'INPUT' || target.tagName === 'TEXTAREA';
      const isManagedUndo = target.dataset.managedUndo !== undefined;

      if (isTextInput && !isManagedUndo) return;
      if (!isManagedUndo) return;

      e.preventDefault();

      const temporal = useComposerEditorStore.temporal.getState();
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
  return useComposerEditorStore.temporal.subscribe(callback);
};

const getCanUndo = () => {
  const state = useComposerEditorStore.temporal.getState();
  return state.pastStates.length > 0;
};

const getCanRedo = () => {
  const state = useComposerEditorStore.temporal.getState();
  return state.futureStates.length > 0;
};

export const useComposerUndoRedo = () => {
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
    useComposerEditorStore.temporal.getState().undo();
  };

  const redo = () => {
    useComposerEditorStore.temporal.getState().redo();
  };

  return { canUndo, canRedo, undo, redo };
};
