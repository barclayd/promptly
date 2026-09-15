import { useComposerEditorStore } from '~/stores/composer-editor-store';
import { usePromptEditorStore } from '~/stores/prompt-editor-store';
import type { SchemaField } from '../schema-types';
import type {
  BrowserAuthoringDocument,
  BrowserAuthoringFields,
  BrowserAuthoringKind,
  BrowserAuthoringResponse,
} from './browser-types';
import {
  createSaveCoordinator,
  type SaveCoordinatorResult,
  type SaveTransportResult,
} from './save-coordinator';

type Command =
  | { operation: 'publish' | 'delete'; version?: string }
  | { operation: 'restore'; changeId: string; phase: 'before' | 'after' };

let initializingStore = false;

export const initializeAuthoringStore = (initialize: () => void) => {
  initializingStore = true;
  try {
    initialize();
  } finally {
    initializingStore = false;
  }
};

const createEditorSession = (initial: BrowserAuthoringDocument) => {
  const documents = new Map([[initial.revision, initial]]);
  const listeners = new Set<() => void>();
  let bound = 0;
  let applying = false;
  let deleted = false;
  let command: Command | null = null;
  let refreshError: string | null = null;
  let lastSavedAt: number | null = null;
  let refreshSequence = 0;
  let remoteGeneration = 0;
  let debounce: ReturnType<typeof setTimeout> | undefined;
  let unsubscribeStore: (() => void) | undefined;
  let appliedRevision = initial.revision;

  const request = async (
    operation: 'save' | 'publish' | 'delete' | 'restore',
    fields: Record<string, string>,
  ): Promise<SaveTransportResult<BrowserAuthoringFields>> => {
    const form = new FormData();
    for (const [key, value] of Object.entries({
      kind: initial.kind,
      id: initial.id,
      [`${initial.kind}Id`]: initial.id,
      ...fields,
    }))
      form.set(key, value);
    const endpoint =
      operation === 'save' || operation === 'restore'
        ? `/api/authoring/${operation}`
        : `/api/${initial.kind}s/${operation}`;
    const response = await fetch(endpoint, { method: 'POST', body: form });
    const result = (await response.json()) as BrowserAuthoringResponse;
    if (result.status === 'conflict') return { status: 'conflict' };
    if (result.status === 'rejected')
      return {
        status: 'rejected',
        message: [
          result.error,
          ...(result.diagnostics?.map((diagnostic) => diagnostic.message) ??
            []),
        ].join(' '),
      };
    if (result.status === 'deleted' && operation === 'delete') {
      deleted = true;
      lastSavedAt = Date.now();
      return {
        status: 'saved',
        document: {
          revision: result.revision,
          definition: coordinator.getSnapshot().definition,
        },
      };
    }
    if (!response.ok || result.status !== 'saved')
      throw new Error('Unconfirmed authoring request');
    const document = result.document;
    if (
      document.id !== initial.id ||
      document.kind !== initial.kind ||
      document.userId !== initial.userId ||
      document.organizationId !== initial.organizationId
    ) {
      throw new Error('Authoring response identity mismatch');
    }
    documents.set(document.revision, document);
    refreshError = null;
    lastSavedAt = Date.now();
    return { status: 'saved', document };
  };

  const coordinator = createSaveCoordinator<BrowserAuthoringFields, Command>({
    initial,
    transport: {
      save: ({ expectedRevision, requestKey, patch }) =>
        request('save', {
          expectedRevision: expectedRevision ?? '',
          requestKey,
          patch: JSON.stringify(patch),
        }),
      publish: ({ expectedRevision, requestKey, input }) =>
        request(input.operation, {
          expectedRevision: expectedRevision ?? '',
          requestKey,
          ...(input.operation === 'restore'
            ? { changeId: input.changeId, phase: input.phase }
            : input.version
              ? { version: input.version }
              : {}),
        }),
    },
  });

  const isDeleting = () => {
    const active = coordinator.getSnapshot().inFlight;
    return (
      command?.operation === 'delete' ||
      (active?.kind === 'publish' && active.input.operation === 'delete')
    );
  };

  const buildSnapshot = () => ({
    ...coordinator.getSnapshot(),
    document: documents.get(coordinator.getSnapshot().revision) ?? initial,
    deleted,
    attached: bound > 0,
    isDeleting: isDeleting(),
    refreshError,
    lastSavedAt,
    remoteGeneration,
  });
  let snapshot = buildSnapshot();
  const emit = () => {
    const state = coordinator.getSnapshot();
    for (const revision of documents.keys()) {
      if (
        revision !== state.revision &&
        revision !== state.conflict?.remote?.revision
      )
        documents.delete(revision);
    }
    snapshot = buildSnapshot();
    for (const listener of [...listeners]) listener();
  };

  const applyToStore = () => {
    if (!bound) return;
    applying = true;
    const definition = coordinator.getSnapshot().definition;
    try {
      if (initial.kind === 'prompt' && 'systemMessage' in definition) {
        const store = usePromptEditorStore.getState();
        if (store._promptId !== initial.id) return;
        const temporal = usePromptEditorStore.temporal.getState();
        temporal.pause();
        try {
          usePromptEditorStore.setState({
            systemMessage: definition.systemMessage,
            userMessage: definition.userMessage,
            schemaFields: definition.config.schema as SchemaField[],
            model: definition.config.model,
            temperature: definition.config.temperature,
            inputData: definition.config.inputData,
            inputDataRootName: definition.config.inputDataRootName,
            attachedSnippets: definition.snippets.map((ref) => {
              const existing = store.attachedSnippets.find(
                (item) => item.snippetId === ref.snippetId,
              );
              return {
                id: existing?.id ?? ref.snippetId,
                snippetId: ref.snippetId,
                snippetName: existing?.snippetName ?? ref.snippetId,
                snippetVersionId: ref.snippetVersionId,
                snippetVersionLabel:
                  existing?.snippetVersionId === ref.snippetVersionId
                    ? existing.snippetVersionLabel
                    : null,
                sortOrder: ref.sortOrder,
                isDeleted: false,
              };
            }),
          });
        } finally {
          temporal.resume();
        }
      } else if (initial.kind === 'composer' && 'content' in definition) {
        if (useComposerEditorStore.getState()._composerId !== initial.id)
          return;
        const temporal = useComposerEditorStore.temporal.getState();
        temporal.pause();
        try {
          useComposerEditorStore.setState({
            content: definition.content,
            schemaFields: definition.config.schema as SchemaField[],
            inputData: definition.config.inputData,
            inputDataRootName: definition.config.inputDataRootName,
          });
        } finally {
          temporal.resume();
        }
      }
    } finally {
      applying = false;
    }
  };

  coordinator.subscribe(() => {
    if (appliedRevision !== coordinator.getSnapshot().revision) {
      appliedRevision = coordinator.getSnapshot().revision;
      applyToStore();
    }
    emit();
  });

  const clearDebounce = () => {
    if (debounce !== undefined) clearTimeout(debounce);
    debounce = undefined;
  };

  const stage = (patch: Partial<BrowserAuthoringFields>) => {
    if (deleted || isDeleting()) return;
    coordinator.stage(patch);
    clearDebounce();
    debounce = setTimeout(() => {
      debounce = undefined;
      void flush();
    }, 1000);
  };

  const observeStore = () =>
    initial.kind === 'prompt'
      ? usePromptEditorStore.subscribe((state, previous) => {
          if (
            applying ||
            initializingStore ||
            state._promptId !== initial.id ||
            previous._promptId !== initial.id
          )
            return;
          const changes: Record<string, unknown> = {};
          if (state.systemMessage !== previous.systemMessage)
            changes.systemMessage = state.systemMessage;
          if (state.userMessage !== previous.userMessage)
            changes.userMessage = state.userMessage;
          if (state.attachedSnippets !== previous.attachedSnippets)
            changes.snippets = state.attachedSnippets.map(
              ({ snippetId, snippetVersionId, sortOrder }) => ({
                snippetId,
                snippetVersionId,
                sortOrder,
              }),
            );
          if (
            state.schemaFields !== previous.schemaFields ||
            state.model !== previous.model ||
            state.temperature !== previous.temperature ||
            state.inputData !== previous.inputData ||
            state.inputDataRootName !== previous.inputDataRootName
          ) {
            changes.config = {
              ...coordinator.getSnapshot().definition.config,
              schema: state.schemaFields,
              model: state.model,
              temperature: state.temperature,
              inputData: state.inputData,
              inputDataRootName: state.inputDataRootName,
            };
          }
          if (Object.keys(changes).length) stage(changes);
        })
      : useComposerEditorStore.subscribe((state, previous) => {
          if (
            applying ||
            initializingStore ||
            state._composerId !== initial.id ||
            previous._composerId !== initial.id
          )
            return;
          const changes: Record<string, unknown> = {};
          if (state.content !== previous.content)
            changes.content = state.content;
          if (
            state.schemaFields !== previous.schemaFields ||
            state.inputData !== previous.inputData ||
            state.inputDataRootName !== previous.inputDataRootName
          ) {
            changes.config = {
              ...coordinator.getSnapshot().definition.config,
              schema: state.schemaFields,
              inputData: state.inputData,
              inputDataRootName: state.inputDataRootName,
            };
          }
          if (Object.keys(changes).length) stage(changes);
        });

  const receiveRemoteDocument = (document: BrowserAuthoringDocument) => {
    if (
      document.id !== initial.id ||
      document.kind !== initial.kind ||
      document.userId !== initial.userId ||
      document.organizationId !== initial.organizationId
    )
      return;
    const previousRevision = coordinator.getSnapshot().revision;
    documents.set(document.revision, document);
    coordinator.receiveRemote(document);
    if (coordinator.getSnapshot().revision !== previousRevision)
      remoteGeneration++;
    emit();
  };

  const refresh = async () => {
    const sequence = ++refreshSequence;
    try {
      const url = new URL('/api/authoring/read', window.location.origin);
      url.searchParams.set('kind', initial.kind);
      url.searchParams.set('id', initial.id);
      const response = await fetch(url);
      if (!response.ok)
        throw new Error(
          'The current document is unavailable. Check your access and try again.',
        );
      const document = (await response.json()) as BrowserAuthoringDocument;
      if (sequence !== refreshSequence) return;
      if (
        document.id !== initial.id ||
        document.kind !== initial.kind ||
        document.userId !== initial.userId ||
        document.organizationId !== initial.organizationId
      )
        throw new Error('Your workspace session changed. Reload to continue.');
      refreshError = null;
      receiveRemoteDocument(document);
    } catch (error) {
      if (sequence !== refreshSequence) return;
      refreshError =
        error instanceof Error
          ? error.message
          : 'Unable to read the current document.';
      emit();
    }
  };

  const flush = async (): Promise<
    SaveCoordinatorResult<BrowserAuthoringFields>
  > => {
    clearDebounce();
    const result = await coordinator.flush();
    if (result.status === 'blocked' && result.reason === 'conflict')
      void refresh();
    return result;
  };

  const operate = async (input: Command) => {
    if (deleted) return { status: 'blocked', reason: 'rejected' } as const;
    if (command) return { status: 'blocked', reason: 'busy' } as const;
    clearDebounce();
    command = input;
    emit();
    try {
      const result = await coordinator.publish(input);
      if (result.status === 'blocked' && result.reason === 'conflict')
        void refresh();
      return result;
    } finally {
      command = null;
      emit();
    }
  };

  return {
    id: initial.id,
    kind: initial.kind,
    getSnapshot: () => snapshot,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    stage,
    flush,
    publish: (version?: string) =>
      operate({ operation: 'publish', ...(version ? { version } : {}) }),
    delete: () => operate({ operation: 'delete' }),
    restore: (input: { changeId: string; phase: 'before' | 'after' }) =>
      operate({ operation: 'restore', ...input }),
    retry: async () => {
      const result = await coordinator.retry();
      if (result.status === 'blocked' && result.reason === 'conflict')
        void refresh();
      return result;
    },
    refresh,
    receiveRemote: receiveRemoteDocument,
    acceptRemote: () => {
      clearDebounce();
      const resolved = coordinator.acceptRemote();
      if (resolved) {
        remoteGeneration++;
        emit();
      }
      return resolved;
    },
    reapplyLocal: () => {
      const resolved = coordinator.reapplyLocal();
      if (resolved) {
        remoteGeneration++;
        emit();
      }
      return resolved;
    },
    attach: () => {
      bound++;
      if (bound === 1) {
        applyToStore();
        unsubscribeStore = observeStore();
      }
      emit();
      return () => {
        bound--;
        if (bound === 0) {
          unsubscribeStore?.();
          unsubscribeStore = undefined;
          clearDebounce();
          if (!deleted) void flush();
        }
        emit();
      };
    },
  };
};

export type BrowserEditorSession = ReturnType<typeof createEditorSession>;
const sessions = new Map<string, BrowserEditorSession>();
const activeSessions = new Map<string, BrowserEditorSession>();
let unloadListenerInstalled = false;
const installUnloadListener = () => {
  if (unloadListenerInstalled) return;
  window.addEventListener('beforeunload', (event) => {
    if (
      [...sessions.values()].some((session) => {
        const state = session.getSnapshot();
        return state.dirty || Boolean(state.inFlight);
      })
    ) {
      event.preventDefault();
      event.returnValue = '';
    }
  });
  unloadListenerInstalled = true;
};

export const getBrowserEditorSession = (
  document: BrowserAuthoringDocument,
): BrowserEditorSession => {
  if (typeof window === 'undefined') return createEditorSession(document);
  installUnloadListener();
  const key = `${document.userId}:${document.organizationId}:${document.kind}:${document.id}`;
  let session = sessions.get(key);
  if (!session) {
    session = createEditorSession(document);
    sessions.set(key, session);
  }
  return session;
};

export const getActiveEditorSession = (
  kind: BrowserAuthoringKind,
  id: string,
) => activeSessions.get(`${kind}:${id}`);

export const attachBrowserEditorSession = (session: BrowserEditorSession) => {
  const key = `${session.kind}:${session.id}`;
  activeSessions.set(key, session);
  const detach = session.attach();
  return () => {
    if (activeSessions.get(key) === session) activeSessions.delete(key);
    detach();
  };
};

export const getOrLoadEditorSession = async (
  kind: BrowserAuthoringKind,
  id: string,
): Promise<BrowserEditorSession> => {
  const active = getActiveEditorSession(kind, id);
  if (active) return active;
  const url = new URL('/api/authoring/read', window.location.origin);
  url.searchParams.set('kind', kind);
  url.searchParams.set('id', id);
  const response = await fetch(url);
  if (!response.ok)
    throw new Error(
      'This document is unavailable. Refresh the page and check your access.',
    );
  const document = (await response.json()) as BrowserAuthoringDocument;
  if (document.kind !== kind || document.id !== id)
    throw new Error('The requested document could not be confirmed.');
  const session = getBrowserEditorSession(document);
  session.receiveRemote(document);
  return session;
};
