import { useSyncExternalStore } from 'react';
import { usePromptEditorStore } from '~/stores/prompt-editor-store';

let listenerSetup = false;

const setupUndoRedoListener = () => {
  if (typeof window === 'undefined') return;
  if (listenerSetup) return;
  listenerSetup = true;

  // Use beforeinput to intercept undo/redo before native handling (for real user Cmd+Z)
  document.addEventListener(
    'beforeinput',
    (e) => {
      if (e.inputType !== 'historyUndo' && e.inputType !== 'historyRedo') return;

      const target = e.target as HTMLElement;
      const isManagedUndo = target.dataset.managedUndo !== undefined;

      if (!isManagedUndo) {
        return;
      }

      e.preventDefault();

      const temporal = usePromptEditorStore.temporal.getState();
      if (e.inputType === 'historyRedo') {
        temporal.redo();
      } else {
        temporal.undo();
      }
    },
    true,
  );

  // Handle keydown for all contexts - both managed text inputs and elsewhere
  document.addEventListener(
    'keydown',
    (e) => {
      // Only handle Cmd/Ctrl+Z
      if (!((e.metaKey || e.ctrlKey) && e.key === 'z')) return;

      const target = e.target as HTMLElement;
      const isTextInput =
        target.tagName === 'INPUT' || target.tagName === 'TEXTAREA';
      const isManagedUndo = target.dataset.managedUndo !== undefined;

      // For unmanaged text inputs, let native undo work
      if (isTextInput && !isManagedUndo) {
        return;
      }

      // For managed inputs and non-text contexts, use store undo/redo
      e.preventDefault();

      const temporal = usePromptEditorStore.temporal.getState();
      if (e.shiftKey) {
        temporal.redo();
      } else {
        temporal.undo();
      }
    },
    true,
  );
};

// Subscribe to temporal state for canUndo/canRedo
const subscribeToTemporal = (callback: () => void) => {
  return usePromptEditorStore.temporal.subscribe(callback);
};

const getCanUndo = () => {
  const state = usePromptEditorStore.temporal.getState();
  return state.pastStates.length > 0;
};

const getCanRedo = () => {
  const state = usePromptEditorStore.temporal.getState();
  return state.futureStates.length > 0;
};

export const useUndoRedo = () => {
  setupUndoRedoListener();

  const canUndo = useSyncExternalStore(subscribeToTemporal, getCanUndo, () => false);
  const canRedo = useSyncExternalStore(subscribeToTemporal, getCanRedo, () => false);

  const undo = () => {
    usePromptEditorStore.temporal.getState().undo();
  };

  const redo = () => {
    usePromptEditorStore.temporal.getState().redo();
  };

  return { canUndo, canRedo, undo, redo };
};
