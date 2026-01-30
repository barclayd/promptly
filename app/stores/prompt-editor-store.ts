import { temporal } from 'zundo';
import { create } from 'zustand';
import type { SchemaField } from '~/lib/schema-types';

export type PromptEditorState = {
  systemMessage: string;
  userMessage: string;
  schemaFields: SchemaField[];
  model: string | null;
  temperature: number;
  inputData: unknown;
  inputDataRootName: string | null;
  testModel: string | null;
  testTemperature: number | null;
  testVersionOverride: string | null;
  lastOutputTokens: number | null;
  _promptId: string | null;
  _initialized: boolean;
};

type InitializeData = {
  systemMessage: string;
  userMessage: string;
  schemaFields: SchemaField[];
  model: string | null;
  temperature: number;
  inputData: unknown;
  inputDataRootName: string | null;
  testModel: string | null;
  testTemperature: number | null;
  testVersionOverride: string | null;
  lastOutputTokens: number | null;
  promptId: string | null;
};

export type PromptEditorActions = {
  initialize: (data: InitializeData) => void;
  reset: () => void;
  setSystemMessage: (value: string) => void;
  setUserMessage: (value: string) => void;
  setSystemMessageFromRemote: (value: string) => void;
  setUserMessageFromRemote: (value: string) => void;
  setSchemaFields: (fields: SchemaField[]) => void;
  addSchemaField: (field: SchemaField) => void;
  updateSchemaField: (id: string, updates: Partial<SchemaField>) => void;
  deleteSchemaField: (id: string) => void;
  setModel: (model: string | null) => void;
  setTemperature: (temp: number) => void;
  setInputData: (data: unknown, rootName?: string | null) => void;
  setTestModel: (model: string | null) => void;
  setTestTemperature: (temp: number | null) => void;
  setTestVersionOverride: (version: string | null) => void;
  setLastOutputTokens: (tokens: number | null) => void;
};

type PromptEditorStore = PromptEditorState & PromptEditorActions;

const initialState: PromptEditorState = {
  systemMessage: '',
  userMessage: '',
  schemaFields: [],
  model: null,
  temperature: 0.5,
  inputData: null,
  inputDataRootName: null,
  testModel: null,
  testTemperature: null,
  testVersionOverride: null,
  lastOutputTokens: null,
  _promptId: null,
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

export const usePromptEditorStore = create<PromptEditorStore>()(
  temporal(
    (set) => ({
      ...initialState,

      initialize: (data) => {
        set({
          systemMessage: data.systemMessage,
          userMessage: data.userMessage,
          schemaFields: data.schemaFields,
          model: data.model,
          temperature: data.temperature,
          inputData: data.inputData,
          inputDataRootName: data.inputDataRootName,
          testModel: data.testModel,
          testTemperature: data.testTemperature,
          testVersionOverride: data.testVersionOverride,
          lastOutputTokens: data.lastOutputTokens,
          _promptId: data.promptId,
          _initialized: true,
        });
        // Clear history after initialization so the initial state becomes the baseline
        usePromptEditorStore.temporal.getState().clear();
      },

      reset: () => {
        set(initialState);
        usePromptEditorStore.temporal.getState().clear();
      },

      setSystemMessage: (value) => set({ systemMessage: value }),

      setUserMessage: (value) => set({ userMessage: value }),

      setSystemMessageFromRemote: (value) => {
        // Pause Zundo so remote updates don't add to undo history
        usePromptEditorStore.temporal.getState().pause();
        set({ systemMessage: value });
        usePromptEditorStore.temporal.getState().resume();
      },

      setUserMessageFromRemote: (value) => {
        // Pause Zundo so remote updates don't add to undo history
        usePromptEditorStore.temporal.getState().pause();
        set({ userMessage: value });
        usePromptEditorStore.temporal.getState().resume();
      },

      setSchemaFields: (fields) => set({ schemaFields: fields }),

      addSchemaField: (field) =>
        set((state) => ({ schemaFields: [...state.schemaFields, field] })),

      updateSchemaField: (id, updates) =>
        set((state) => ({
          schemaFields: state.schemaFields.map((field) =>
            field.id === id ? { ...field, ...updates } : field,
          ),
        })),

      deleteSchemaField: (id) =>
        set((state) => ({
          schemaFields: state.schemaFields.filter((field) => field.id !== id),
        })),

      setModel: (model) => set({ model }),

      setTemperature: (temp) => set({ temperature: temp }),

      setInputData: (data, rootName) =>
        set((state) => ({
          inputData: data,
          inputDataRootName:
            rootName !== undefined ? rootName : state.inputDataRootName,
        })),

      setTestModel: (model) => set({ testModel: model }),

      setTestTemperature: (temp) => set({ testTemperature: temp }),

      setTestVersionOverride: (version) =>
        set({ testVersionOverride: version }),

      setLastOutputTokens: (tokens) => set({ lastOutputTokens: tokens }),
    }),
    {
      partialize: (state) => ({
        systemMessage: state.systemMessage,
        userMessage: state.userMessage,
        schemaFields: state.schemaFields,
        model: state.model,
        temperature: state.temperature,
        inputData: state.inputData,
        inputDataRootName: state.inputDataRootName,
        testModel: state.testModel,
        testTemperature: state.testTemperature,
        testVersionOverride: state.testVersionOverride,
        lastOutputTokens: state.lastOutputTokens,
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
