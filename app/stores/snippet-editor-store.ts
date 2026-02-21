import { temporal } from 'zundo';
import { create } from 'zustand';

export type SnippetEditorState = {
  content: string;
  model: string | null;
  testUserMessage: string;
  testModel: string | null;
  testVersionOverride: string | null;
  lastOutputTokens: number | null;
  lastSystemInputTokens: number | null;
  _snippetId: string | null;
  _initialized: boolean;
};

type InitializeData = {
  snippetId: string;
  content: string;
  model: string | null;
  testUserMessage: string;
  lastOutputTokens: number | null;
  lastSystemInputTokens: number | null;
};

export type SnippetEditorActions = {
  initialize: (data: InitializeData) => void;
  reset: () => void;
  setContent: (value: string) => void;
  setContentFromRemote: (value: string) => void;
  setModel: (model: string | null) => void;
  setTestUserMessage: (message: string) => void;
  setTestModel: (model: string | null) => void;
  setTestVersionOverride: (version: string | null) => void;
  setLastOutputTokens: (tokens: number | null) => void;
  setLastSystemInputTokens: (tokens: number | null) => void;
};

type SnippetEditorStore = SnippetEditorState & SnippetEditorActions;

const initialState: SnippetEditorState = {
  content: '',
  model: null,
  testUserMessage: '',
  testModel: null,
  testVersionOverride: null,
  lastOutputTokens: null,
  lastSystemInputTokens: null,
  _snippetId: null,
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

export const useSnippetEditorStore = create<SnippetEditorStore>()(
  temporal(
    (set) => ({
      ...initialState,

      initialize: (data) => {
        set({
          content: data.content,
          model: data.model,
          testUserMessage: data.testUserMessage,
          testModel: null,
          testVersionOverride: null,
          lastOutputTokens: data.lastOutputTokens,
          lastSystemInputTokens: data.lastSystemInputTokens,
          _snippetId: data.snippetId,
          _initialized: true,
        });
        useSnippetEditorStore.temporal.getState().clear();
      },

      reset: () => {
        set(initialState);
        useSnippetEditorStore.temporal.getState().clear();
      },

      setContent: (value) => set({ content: value }),

      setContentFromRemote: (value) => {
        useSnippetEditorStore.temporal.getState().pause();
        set({ content: value });
        useSnippetEditorStore.temporal.getState().resume();
      },

      setModel: (model) => set({ model }),

      setTestUserMessage: (message) => set({ testUserMessage: message }),

      setTestModel: (model) => set({ testModel: model }),

      setTestVersionOverride: (version) =>
        set({ testVersionOverride: version }),

      setLastOutputTokens: (tokens) => set({ lastOutputTokens: tokens }),

      setLastSystemInputTokens: (tokens) =>
        set({ lastSystemInputTokens: tokens }),
    }),
    {
      partialize: (state) => ({
        content: state.content,
        model: state.model,
        testUserMessage: state.testUserMessage,
        testModel: state.testModel,
        testVersionOverride: state.testVersionOverride,
        lastOutputTokens: state.lastOutputTokens,
        lastSystemInputTokens: state.lastSystemInputTokens,
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
