import { nanoid } from 'nanoid';

export type SavedDocument<T> = {
  revision: string | null;
  definition: T;
};

export type DraftSaveRequest<T> = {
  kind: 'save';
  expectedRevision: string | null;
  requestKey: string;
  patch: Partial<T>;
};

export type DraftPublishRequest<P> = {
  kind: 'publish';
  expectedRevision: string | null;
  requestKey: string;
  input: P;
};

export type SaveTransportResult<T> =
  | { status: 'saved'; document: SavedDocument<T> }
  | { status: 'conflict'; remote?: SavedDocument<T> }
  | { status: 'rejected'; message: string };

export type SaveCoordinatorResult<T> =
  | { status: 'saved'; document: SavedDocument<T> }
  | {
      status: 'blocked';
      reason: 'conflict' | 'network' | 'rejected' | 'busy';
    };

export type SaveCoordinatorSnapshot<T, P> = {
  revision: string | null;
  definition: Readonly<T>;
  pending: Readonly<Partial<T>>;
  inFlight: Readonly<DraftSaveRequest<T> | DraftPublishRequest<P>> | null;
  isSaving: boolean;
  dirty: boolean;
  queuedPublish: boolean;
  conflict: {
    remote: SavedDocument<T> | null;
    localPatch: Readonly<Partial<T>>;
  } | null;
  error: { kind: 'network' | 'rejected'; message: string } | null;
};

export type SaveCoordinatorOptions<T, P> = {
  initial: SavedDocument<T>;
  transport: {
    save: (request: DraftSaveRequest<T>) => Promise<SaveTransportResult<T>>;
    publish: (
      request: DraftPublishRequest<P>,
    ) => Promise<SaveTransportResult<T>>;
  };
  createRequestKey?: () => string;
};

const freeze = <T>(value: T): T => {
  if (value !== null && typeof value === 'object') {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
};

const copy = <T>(value: T): T => freeze(structuredClone(value));
const hasFields = (patch: object): boolean => Object.keys(patch).length > 0;

export const createSaveCoordinator = <T extends object, P = unknown>(
  options: SaveCoordinatorOptions<T, P>,
) => {
  let acknowledged = copy(options.initial);
  let pending: Partial<T> = {};
  let active: DraftSaveRequest<T> | DraftPublishRequest<P> | null = null;
  let isSaving = false;
  let draining = false;
  let error: SaveCoordinatorSnapshot<T, P>['error'] = null;
  let conflict: {
    remote: SavedDocument<T> | null;
    localPatch: Partial<T>;
    definition: T;
  } | null = null;
  let publication: {
    input: P;
    resolve: (result: SaveCoordinatorResult<T>) => void;
  } | null = null;
  const listeners = new Set<() => void>();
  const waiters = new Set<(result: SaveCoordinatorResult<T>) => void>();
  const knownRevisions = new Set([acknowledged.revision]);
  const acknowledgedKeys = new Map<string, string | null>();
  const requestKeys = new Set<string>();

  const localPatch = (): Partial<T> => ({
    ...(active?.kind === 'save' ? active.patch : {}),
    ...pending,
  });

  let rejectedOperation: 'save' | 'publish' | null = null;

  const definition = (): T =>
    conflict?.definition ?? { ...acknowledged.definition, ...localPatch() };

  const buildSnapshot = (): SaveCoordinatorSnapshot<T, P> =>
    freeze({
      revision: acknowledged.revision,
      definition: freeze(definition()),
      pending: freeze(pending),
      inFlight: active,
      isSaving,
      dirty:
        hasFields(pending) ||
        active?.kind === 'save' ||
        (conflict !== null && hasFields(conflict.localPatch)),
      queuedPublish: publication !== null && active?.kind !== 'publish',
      conflict: conflict
        ? { remote: conflict.remote, localPatch: conflict.localPatch }
        : null,
      error,
    });

  let snapshot = buildSnapshot();
  const emit = () => {
    snapshot = buildSnapshot();
    for (const listener of [...listeners]) listener();
  };

  const blocked = (): SaveCoordinatorResult<T> | null => {
    if (conflict) return { status: 'blocked', reason: 'conflict' };
    if (error) return { status: 'blocked', reason: error.kind };
    return null;
  };

  const settleWaiters = (result: SaveCoordinatorResult<T>) => {
    const current = [...waiters];
    waiters.clear();
    for (const resolve of current) resolve(result);
  };

  const stop = (result: SaveCoordinatorResult<T>) => {
    draining = false;
    if (publication && active?.kind !== 'publish') {
      publication.resolve(result);
      publication = null;
    }
    settleWaiters(result);
  };

  const preserveConflict = (remote: SavedDocument<T> | null) => {
    if (conflict) {
      conflict = { ...conflict, remote: remote ?? conflict.remote };
    } else {
      conflict = {
        remote,
        localPatch: localPatch(),
        definition: definition(),
      };
    }
  };

  const createRequestKey = () => {
    const key = (options.createRequestKey ?? nanoid)();
    if (!key || requestKeys.has(key)) {
      throw new Error('Save request keys must be unique and nonempty.');
    }
    requestKeys.add(key);
    return key;
  };

  const send = async (
    request: DraftSaveRequest<T> | DraftPublishRequest<P>,
  ) => {
    isSaving = true;
    emit();
    let result: SaveTransportResult<T>;
    try {
      result =
        request.kind === 'save'
          ? await options.transport.save(request)
          : await options.transport.publish(request);
    } catch {
      isSaving = false;
      error = {
        kind: 'network',
        message: 'The save outcome is unknown. Retry the same request.',
      };
      const outcome = blocked() ?? { status: 'blocked', reason: 'network' };
      if (request.kind === 'publish' && publication) {
        publication.resolve(outcome);
        publication = null;
      }
      stop(outcome);
      emit();
      return;
    }

    isSaving = false;
    error = null;
    if (result.status === 'saved') {
      acknowledged = copy(result.document);
      knownRevisions.add(acknowledged.revision);
      acknowledgedKeys.set(request.requestKey, acknowledged.revision);
      active = null;
      if (conflict?.remote?.revision === acknowledged.revision) {
        conflict = null;
      }
      if (request.kind === 'publish' && publication) {
        publication.resolve({ status: 'saved', document: acknowledged });
        publication = null;
      }
    } else {
      if (result.status === 'conflict') {
        preserveConflict(
          conflict?.remote ?? (result.remote ? copy(result.remote) : null),
        );
      } else {
        error = { kind: 'rejected', message: result.message };
        rejectedOperation = request.kind;
      }
      if (request.kind === 'save') {
        pending = { ...request.patch, ...pending };
      }
      active = null;
    }
    emit();
    pump();
  };

  const pump = () => {
    if (active) return;
    const reason = blocked();
    if (reason) {
      stop(reason);
      emit();
      return;
    }
    if (!draining) return;
    if (hasFields(pending)) {
      active = copy({
        kind: 'save',
        expectedRevision: acknowledged.revision,
        requestKey: createRequestKey(),
        patch: pending,
      });
      pending = {};
      void send(active);
      return;
    }
    if (publication) {
      active = copy({
        kind: 'publish',
        expectedRevision: acknowledged.revision,
        requestKey: createRequestKey(),
        input: publication.input,
      });
      void send(active);
      return;
    }
    draining = false;
    settleWaiters({ status: 'saved', document: acknowledged });
  };

  const flush = (): Promise<SaveCoordinatorResult<T>> => {
    const reason = blocked();
    if (reason) return Promise.resolve(reason);
    return new Promise((resolve) => {
      waiters.add(resolve);
      draining = true;
      pump();
    });
  };

  const resolveConflict = (reapply: boolean): boolean => {
    if (active || !conflict?.remote) return false;
    acknowledged = conflict.remote;
    knownRevisions.add(acknowledged.revision);
    pending = reapply ? conflict.localPatch : {};
    conflict = null;
    error = null;
    draining = false;
    emit();
    return true;
  };

  return {
    getSnapshot: () => snapshot,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    stage: (patch: Partial<T>) => {
      const fields = copy(
        Object.fromEntries(
          Object.entries(patch).filter(([, value]) => value !== undefined),
        ) as Partial<T>,
      );
      if (!hasFields(fields)) return;
      pending = { ...pending, ...fields };
      if (conflict) {
        conflict = {
          ...conflict,
          localPatch: { ...conflict.localPatch, ...fields },
          definition: { ...conflict.definition, ...fields },
        };
      }
      if (error?.kind === 'rejected') error = null;
      emit();
      if (draining) pump();
    },
    flush,
    publish: (input: P): Promise<SaveCoordinatorResult<T>> => {
      if (
        error?.kind === 'rejected' &&
        rejectedOperation === 'publish' &&
        !active
      ) {
        error = null;
        rejectedOperation = null;
        emit();
      }
      const reason = blocked();
      if (reason) return Promise.resolve(reason);
      if (publication || active?.kind === 'publish') {
        return Promise.resolve({ status: 'blocked', reason: 'busy' });
      }
      return new Promise((resolve) => {
        publication = { input: copy(input), resolve };
        draining = true;
        emit();
        pump();
      });
    },
    retry: (): Promise<SaveCoordinatorResult<T>> => {
      if (error?.kind !== 'network' || !active || isSaving) return flush();
      const request = active;
      return new Promise((resolve) => {
        waiters.add(resolve);
        error = null;
        draining = true;
        void send(request);
      });
    },
    receiveRemote: (remote: SavedDocument<T> & { requestKey?: string }) => {
      if (knownRevisions.has(remote.revision)) return;
      if (
        remote.requestKey &&
        (active?.requestKey === remote.requestKey ||
          (acknowledgedKeys.has(remote.requestKey) &&
            acknowledgedKeys.get(remote.requestKey) === remote.revision))
      ) {
        return;
      }
      const document = copy({
        revision: remote.revision,
        definition: remote.definition,
      });
      if (hasFields(pending) || active || publication || conflict) {
        preserveConflict(document);
        if (!active) stop({ status: 'blocked', reason: 'conflict' });
      } else {
        acknowledged = document;
        knownRevisions.add(document.revision);
        error = null;
      }
      emit();
    },
    acceptRemote: () => resolveConflict(false),
    reapplyLocal: () => resolveConflict(true),
  };
};
