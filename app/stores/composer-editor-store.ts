import { temporal } from 'zundo';
import { create } from 'zustand';
import type { SchemaField } from '~/lib/schema-types';

export type ComposerEditorState = {
  content: string;
  schemaFields: SchemaField[];
  inputData: unknown;
  inputDataRootName: string | null;
  testVersionOverride: string | null;
  _composerId: string | null;
  _initialized: boolean;
};

type InitializeData = {
  composerId: string;
  content: string;
  schemaFields: SchemaField[];
  inputData: unknown;
  inputDataRootName: string | null;
};

export type ComposerEditorActions = {
  initialize: (data: InitializeData) => void;
  reset: () => void;
  setContent: (value: string) => void;
  setContentFromRemote: (value: string) => void;
  setSchemaFields: (fields: SchemaField[]) => void;
  setInputData: (data: unknown, rootName?: string | null) => void;
  setTestVersionOverride: (version: string | null) => void;
};

type ComposerEditorStore = ComposerEditorState & ComposerEditorActions;

const initialState: ComposerEditorState = {
  content: '',
  schemaFields: [],
  inputData: null,
  inputDataRootName: null,
  testVersionOverride: null,
  _composerId: null,
  _initialized: false,
};

const createThrottle = <T extends (...args: Parameters<T>) => ReturnType<T>>(
  fn: T,
  wait: number,
): ((...args: Parameters<T>) => void) => {
  let lastCall = 0;
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  return (...args: Parameters<T>) => {
    const now = Date.now();

    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    if (now - lastCall >= wait) {
      lastCall = now;
      fn(...args);
    } else {
      timeoutId = setTimeout(
        () => {
          lastCall = Date.now();
          fn(...args);
        },
        wait - (now - lastCall),
      );
    }
  };
};

export const useComposerEditorStore = create<ComposerEditorStore>()(
  temporal(
    (set) => ({
      ...initialState,

      initialize: (data) => {
        set({
          content: data.content,
          schemaFields: data.schemaFields,
          inputData: data.inputData,
          inputDataRootName: data.inputDataRootName,
          testVersionOverride: null,
          _composerId: data.composerId,
          _initialized: true,
        });
        useComposerEditorStore.temporal.getState().clear();
      },

      reset: () => {
        set(initialState);
        useComposerEditorStore.temporal.getState().clear();
      },

      setContent: (value) => set({ content: value }),

      setContentFromRemote: (value) => {
        useComposerEditorStore.temporal.getState().pause();
        set({ content: value });
        useComposerEditorStore.temporal.getState().resume();
      },

      setSchemaFields: (fields) => set({ schemaFields: fields }),

      setInputData: (data, rootName) =>
        set({
          inputData: data,
          ...(rootName !== undefined && { inputDataRootName: rootName }),
        }),

      setTestVersionOverride: (version) =>
        set({ testVersionOverride: version }),
    }),
    {
      partialize: (state) => ({
        // content removed — Tiptap's ProseMirror history handles undo/redo for editor content
        schemaFields: state.schemaFields,
        inputData: state.inputData,
        inputDataRootName: state.inputDataRootName,
      }),
      limit: 100,
      handleSet: (handleSet) =>
        createThrottle<typeof handleSet>((state) => {
          handleSet(state);
        }, 500),
      equality: (pastState, currentState) =>
        JSON.stringify(pastState) === JSON.stringify(currentState),
    },
  ),
);
