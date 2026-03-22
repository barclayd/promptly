import { create } from 'zustand';
import type { SchemaField } from '~/lib/schema-types';

type PromptSchemaEntry = {
  promptId: string;
  promptName: string;
  versionId: string;
  schema: SchemaField[];
  fetchedAt: number;
};

type PromptSchemaCacheState = {
  entries: Record<string, PromptSchemaEntry>;
};

type PromptSchemaCacheActions = {
  set: (promptId: string, entry: PromptSchemaEntry) => void;
  get: (promptId: string) => PromptSchemaEntry | undefined;
  remove: (promptId: string) => void;
  clear: () => void;
};

type PromptSchemaCacheStore = PromptSchemaCacheState & PromptSchemaCacheActions;

const initialState: PromptSchemaCacheState = {
  entries: {},
};

export const usePromptSchemaCacheStore = create<PromptSchemaCacheStore>()(
  (set, get) => ({
    ...initialState,
    set: (promptId, entry) =>
      set((state) => ({
        entries: { ...state.entries, [promptId]: entry },
      })),
    get: (promptId) => get().entries[promptId],
    remove: (promptId) =>
      set((state) => {
        const { [promptId]: _, ...rest } = state.entries;
        return { entries: rest };
      }),
    clear: () => set(initialState),
  }),
);

export const fetchPromptSchema = async (
  promptId: string,
  versionId?: string | null,
): Promise<PromptSchemaEntry | null> => {
  const cached = usePromptSchemaCacheStore.getState().get(promptId);

  if (cached && (!versionId || cached.versionId === versionId)) {
    return cached;
  }

  try {
    const params = new URLSearchParams({ promptId });
    if (versionId) {
      params.set('versionId', versionId);
    }

    const response = await fetch(`/api/prompt-schema?${params.toString()}`);

    if (!response.ok) {
      return null;
    }

    const data = (await response.json()) as {
      promptId: string;
      promptName: string;
      versionId: string | null;
      schema: SchemaField[];
    };

    const entry: PromptSchemaEntry = {
      promptId: data.promptId,
      promptName: data.promptName,
      versionId: data.versionId ?? '',
      schema: data.schema,
      fetchedAt: Date.now(),
    };

    usePromptSchemaCacheStore.getState().set(promptId, entry);

    return entry;
  } catch {
    return null;
  }
};
