import {
  createSaveCoordinator,
  type DraftPublishRequest,
  type DraftSaveRequest,
  type SavedDocument,
  type SaveTransportResult,
} from '../../app/lib/authoring/save-coordinator';
import { expect, test } from '../fixtures/base';

type Fields = {
  name: string;
  content: string;
  description: string | null;
  config: { temperature: number; model: string | null };
  references: string[];
};
type Publication = { version: string };

const initial: Fields = {
  name: 'Original',
  content: 'Original content',
  description: 'Description',
  config: { temperature: 0.5, model: null },
  references: [],
};

const document = (
  revision: string,
  fields: Partial<Fields> = {},
): SavedDocument<Fields> => ({
  revision,
  definition: { ...initial, ...fields },
});

const setup = () => {
  const calls: {
    request: DraftSaveRequest<Fields> | DraftPublishRequest<Publication>;
    deferred: ReturnType<
      typeof Promise.withResolvers<SaveTransportResult<Fields>>
    >;
  }[] = [];
  const transport = (
    request: DraftSaveRequest<Fields> | DraftPublishRequest<Publication>,
  ) => {
    const deferred = Promise.withResolvers<SaveTransportResult<Fields>>();
    calls.push({ request, deferred });
    return deferred.promise;
  };
  let key = 0;
  const coordinator = createSaveCoordinator<Fields, Publication>({
    initial: document('r0'),
    transport: { save: transport, publish: transport },
    createRequestKey: () => `request-${++key}`,
  });
  return {
    coordinator,
    calls,
    saveAt: (index: number) => {
      const request = calls[index].request;
      if (request.kind !== 'save') throw new Error('Expected a draft save.');
      return request;
    },
    ack: async (index: number, saved: SavedDocument<Fields>) => {
      calls[index].deferred.resolve({ status: 'saved', document: saved });
      await Promise.resolve();
    },
  };
};

test('coordinator coalesces all authoring fields and snapshots mutable input', async () => {
  const { coordinator, calls, saveAt, ack } = setup();
  const config = { temperature: 0.7, model: 'chosen-model' };
  const references = ['snippet-a', 'snippet-b'];
  coordinator.stage({ content: 'First wording', config });
  coordinator.stage({ name: 'Renamed', references });
  coordinator.stage({ content: 'Final wording', description: null });
  coordinator.stage({ name: undefined });
  config.temperature = 1;
  references.reverse();
  expect(calls).toHaveLength(0);

  const flushed = coordinator.flush();
  expect(saveAt(0)).toEqual({
    kind: 'save',
    expectedRevision: 'r0',
    requestKey: 'request-1',
    patch: {
      name: 'Renamed',
      content: 'Final wording',
      description: null,
      config: { temperature: 0.7, model: 'chosen-model' },
      references: ['snippet-a', 'snippet-b'],
    },
  });
  expect(coordinator.getSnapshot().dirty).toBe(true);
  await ack(0, document('r1', saveAt(0).patch));
  expect(await flushed).toEqual({
    status: 'saved',
    document: document('r1', saveAt(0).patch),
  });
  expect(coordinator.getSnapshot().dirty).toBe(false);
});

test('coordinator serializes overlapping flushes without losing later edits', async () => {
  const { coordinator, calls, saveAt, ack } = setup();
  coordinator.stage({ content: 'First' });
  const firstFlush = coordinator.flush();
  coordinator.stage({ content: 'Latest' });
  coordinator.stage({ config: { temperature: 0.8, model: null } });
  const secondFlush = coordinator.flush();
  expect(calls).toHaveLength(1);
  await ack(0, document('r1', { content: 'Normalized first' }));
  expect(calls).toHaveLength(2);
  expect(saveAt(1)).toMatchObject({
    expectedRevision: 'r1',
    requestKey: 'request-2',
    patch: { content: 'Latest', config: { temperature: 0.8, model: null } },
  });
  expect(coordinator.getSnapshot().definition.content).toBe('Latest');
  expect(coordinator.getSnapshot().dirty).toBe(true);
  await ack(1, document('r2', saveAt(1).patch));
  expect((await firstFlush).status).toBe('saved');
  expect((await secondFlush).status).toBe('saved');
  expect(coordinator.getSnapshot().revision).toBe('r2');
  expect(coordinator.getSnapshot().dirty).toBe(false);
  expect(calls).toHaveLength(2);
});

test('uncertain network retries reuse the immutable request despite later edits and own notifications', async () => {
  const { coordinator, calls, saveAt, ack } = setup();
  coordinator.stage({ content: 'Sent once' });
  const failed = coordinator.flush();
  calls[0].deferred.reject(new Error('Response lost after commit'));
  expect(await failed).toEqual({ status: 'blocked', reason: 'network' });
  coordinator.stage({ content: 'Next edit' });
  coordinator.receiveRemote({
    ...document('r1', { content: 'Sent once' }),
    requestKey: saveAt(0).requestKey,
  });
  expect(coordinator.getSnapshot().revision).toBe('r0');
  expect(coordinator.getSnapshot().conflict).toBeNull();
  expect(await coordinator.flush()).toEqual({
    status: 'blocked',
    reason: 'network',
  });
  expect(calls).toHaveLength(1);
  const retried = coordinator.retry();
  expect(saveAt(1)).toBe(saveAt(0));
  expect(saveAt(1).patch).toEqual({ content: 'Sent once' });
  expect(saveAt(1).expectedRevision).toBe('r0');
  await ack(1, document('r1', { content: 'Sent once' }));
  expect(saveAt(2)).toMatchObject({
    expectedRevision: 'r1',
    requestKey: 'request-2',
    patch: { content: 'Next edit' },
  });
  await ack(2, document('r2', { content: 'Next edit' }));
  expect((await retried).status).toBe('saved');
});

test('stale saves preserve local work and reapply only edited fields after explicit resolution', async () => {
  const { coordinator, calls, saveAt, ack } = setup();
  coordinator.stage({ content: 'Local content' });
  const flushed = coordinator.flush();
  coordinator.stage({ name: 'Local name' });
  calls[0].deferred.resolve({
    status: 'conflict',
    remote: document('remote', {
      content: 'Remote content',
      description: 'Remote description',
    }),
  });
  expect(await flushed).toEqual({ status: 'blocked', reason: 'conflict' });
  coordinator.stage({ references: ['snippet-a'] });
  expect(await coordinator.retry()).toEqual({
    status: 'blocked',
    reason: 'conflict',
  });
  expect(calls).toHaveLength(1);
  expect(coordinator.getSnapshot().definition).toMatchObject({
    content: 'Local content',
    name: 'Local name',
    references: ['snippet-a'],
  });
  expect(coordinator.reapplyLocal()).toBe(true);
  expect(calls).toHaveLength(1);
  expect(coordinator.getSnapshot().definition.description).toBe(
    'Remote description',
  );
  const reapplied = coordinator.flush();
  expect(saveAt(1)).toMatchObject({
    expectedRevision: 'remote',
    requestKey: 'request-2',
    patch: {
      content: 'Local content',
      name: 'Local name',
      references: ['snippet-a'],
    },
  });
  await ack(
    1,
    document('r2', {
      ...saveAt(1).patch,
      description: 'Remote description',
    }),
  );
  expect((await reapplied).status).toBe('saved');
});

test('conflicts without content require a fresh read before accepting remote', async () => {
  const { coordinator, calls } = setup();
  coordinator.stage({ content: 'Local content' });
  const flushed = coordinator.flush();
  calls[0].deferred.resolve({ status: 'conflict' });
  await flushed;
  expect(coordinator.acceptRemote()).toBe(false);
  expect(coordinator.reapplyLocal()).toBe(false);
  coordinator.receiveRemote(document('remote', { content: 'Remote content' }));
  expect(coordinator.acceptRemote()).toBe(true);
  expect(coordinator.getSnapshot()).toMatchObject({
    revision: 'remote',
    definition: { content: 'Remote content' },
    pending: {},
    dirty: false,
    conflict: null,
  });
  expect(calls).toHaveLength(1);
});

test('an uncertain save that definitively loses a revision race can be resolved safely', async () => {
  const { coordinator, calls, saveAt, ack } = setup();
  coordinator.stage({ content: 'Uncertain local content' });
  const flushed = coordinator.flush();
  coordinator.stage({ name: 'Later local name' });
  coordinator.receiveRemote(document('remote', { content: 'Remote content' }));
  expect(coordinator.acceptRemote()).toBe(false);
  expect(coordinator.reapplyLocal()).toBe(false);
  calls[0].deferred.reject(new Error('Connection lost'));
  await Promise.resolve();
  expect((await flushed).status).toBe('blocked');
  expect(coordinator.acceptRemote()).toBe(false);
  const retried = coordinator.retry();
  expect(saveAt(1)).toBe(saveAt(0));
  calls[1].deferred.resolve({ status: 'conflict' });
  expect(await retried).toEqual({ status: 'blocked', reason: 'conflict' });
  expect(coordinator.getSnapshot().definition).toMatchObject({
    name: 'Later local name',
    content: 'Uncertain local content',
  });
  expect(coordinator.reapplyLocal()).toBe(true);
  const reapplied = coordinator.flush();
  expect(saveAt(2)).toMatchObject({
    expectedRevision: 'remote',
    requestKey: 'request-2',
    patch: { name: 'Later local name', content: 'Uncertain local content' },
  });
  await ack(2, document('r2', saveAt(2).patch));
  expect((await reapplied).status).toBe('saved');
});

test('publication drains all staged edits and serializes edits made while publishing', async () => {
  const { coordinator, calls, saveAt, ack } = setup();
  coordinator.stage({ content: 'First content' });
  const input = { version: '1.0.0' };
  const published = coordinator.publish(input);
  input.version = '2.0.0';
  coordinator.stage({ config: { temperature: 0.7, model: 'model' } });
  expect(coordinator.getSnapshot().queuedPublish).toBe(true);
  await ack(0, document('r1', { content: 'First content' }));
  expect(saveAt(1).expectedRevision).toBe('r1');
  expect(calls).toHaveLength(2);
  const beforePublish = document('r2', {
    content: 'First content',
    config: { temperature: 0.7, model: 'model' },
  });
  await ack(1, beforePublish);
  expect(calls[2].request).toEqual({
    kind: 'publish',
    expectedRevision: 'r2',
    requestKey: 'request-3',
    input: { version: '1.0.0' },
  });
  coordinator.stage({ content: 'Next draft' });
  const flushed = coordinator.flush();
  expect(calls).toHaveLength(3);
  expect(await coordinator.publish({ version: '2.0.0' })).toEqual({
    status: 'blocked',
    reason: 'busy',
  });
  await ack(2, { ...beforePublish, revision: 'r3' });
  expect((await published).status).toBe('saved');
  expect(saveAt(3)).toMatchObject({
    expectedRevision: 'r3',
    patch: { content: 'Next draft' },
  });
  await ack(3, {
    revision: 'r4',
    definition: { ...beforePublish.definition, content: 'Next draft' },
  });
  expect((await flushed).status).toBe('saved');
  expect(coordinator.getSnapshot().dirty).toBe(false);
});

test('a remote conflict cancels queued publication without discarding pending edits', async () => {
  const { coordinator, calls, saveAt, ack } = setup();
  coordinator.stage({ content: 'Local content' });
  const published = coordinator.publish({ version: '1.0.0' });
  coordinator.stage({ name: 'Local name' });
  coordinator.receiveRemote(document('remote', { content: 'Foreign edit' }));
  expect(coordinator.getSnapshot().queuedPublish).toBe(true);
  calls[0].deferred.resolve({ status: 'conflict' });
  expect(await published).toEqual({ status: 'blocked', reason: 'conflict' });
  expect(coordinator.getSnapshot().queuedPublish).toBe(false);
  expect(coordinator.reapplyLocal()).toBe(true);
  const flushed = coordinator.flush();
  expect(saveAt(1).patch).toEqual({
    content: 'Local content',
    name: 'Local name',
  });
  await ack(1, document('r2', saveAt(1).patch));
  expect((await flushed).status).toBe('saved');
  expect(calls.map(({ request }) => request.kind)).toEqual(['save', 'save']);
});

test('a newer foreign notification stays conflicted after an in-flight publication succeeds', async () => {
  const { coordinator, calls, saveAt, ack } = setup();
  const published = coordinator.publish({ version: '1.0.0' });
  coordinator.stage({ content: 'Next local draft' });
  coordinator.receiveRemote(
    document('remote-after-publish', { name: 'Foreign name' }),
  );
  expect(coordinator.acceptRemote()).toBe(false);
  await ack(0, document('published-revision'));
  expect((await published).status).toBe('saved');
  expect(coordinator.getSnapshot().conflict?.remote?.revision).toBe(
    'remote-after-publish',
  );
  expect(calls).toHaveLength(1);
  expect(coordinator.reapplyLocal()).toBe(true);
  const flushed = coordinator.flush();
  expect(saveAt(1)).toMatchObject({
    expectedRevision: 'remote-after-publish',
    patch: { content: 'Next local draft' },
  });
  await ack(
    1,
    document('r3', { name: 'Foreign name', content: 'Next local draft' }),
  );
  expect((await flushed).status).toBe('saved');
});

test('a successful save followed by a foreign notification adopts only when clean', async () => {
  const { coordinator, saveAt, ack } = setup();
  coordinator.stage({ content: 'Local saved content' });
  const flushed = coordinator.flush();
  await ack(0, document('r1', { content: 'Local saved content' }));
  await flushed;
  coordinator.receiveRemote(document('remote', { content: 'Foreign content' }));
  expect(coordinator.getSnapshot()).toMatchObject({
    revision: 'remote',
    dirty: false,
    conflict: null,
    definition: { content: 'Foreign content' },
  });
  coordinator.receiveRemote({
    ...document('r1', { content: 'Local saved content' }),
    requestKey: saveAt(0).requestKey,
  });
  expect(coordinator.getSnapshot().revision).toBe('remote');
  coordinator.stage({ name: 'Next local name' });
  coordinator.receiveRemote(document('remote-2', { name: 'Foreign name' }));
  expect(coordinator.getSnapshot().definition.name).toBe('Next local name');
  expect(coordinator.getSnapshot().conflict?.remote?.revision).toBe('remote-2');
});

test('a transport acknowledgement recognizes an own notification without advancing early', async () => {
  const { coordinator, calls, ack } = setup();
  coordinator.stage({ content: 'Local content' });
  const flushed = coordinator.flush();
  coordinator.receiveRemote(document('r1', { content: 'Local content' }));
  expect(coordinator.getSnapshot().revision).toBe('r0');
  expect(coordinator.getSnapshot().conflict).not.toBeNull();
  await ack(0, document('r1', { content: 'Local content' }));
  expect((await flushed).status).toBe('saved');
  expect(coordinator.getSnapshot()).toMatchObject({
    revision: 'r1',
    dirty: false,
    conflict: null,
  });
  expect((await coordinator.flush()).status).toBe('saved');
  expect(calls).toHaveLength(1);
});

test('an own revision notification before acknowledgement preserves the publication barrier', async () => {
  const { coordinator, calls, saveAt, ack } = setup();
  coordinator.stage({ content: 'Local content' });
  const published = coordinator.publish({ version: '1.0.0' });
  coordinator.stage({ name: 'Later local name' });
  coordinator.receiveRemote(document('r1', { content: 'Local content' }));
  expect(calls).toHaveLength(1);
  expect(coordinator.getSnapshot().conflict).not.toBeNull();
  await ack(0, document('r1', { content: 'Local content' }));
  expect(coordinator.getSnapshot().conflict).toBeNull();
  expect(saveAt(1)).toMatchObject({
    expectedRevision: 'r1',
    patch: { name: 'Later local name' },
  });
  const saved = document('r2', {
    content: 'Local content',
    name: 'Later local name',
  });
  await ack(1, saved);
  expect(calls[2].request).toMatchObject({
    kind: 'publish',
    expectedRevision: 'r2',
  });
  await ack(2, { ...saved, revision: 'r3' });
  expect((await published).status).toBe('saved');
});

test('an uncertain publication retries its original revision and input before saving newer edits', async () => {
  const { coordinator, calls, saveAt, ack } = setup();
  const published = coordinator.publish({ version: '1.0.0' });
  coordinator.stage({ content: 'New draft' });
  calls[0].deferred.reject(new Error('Publication response lost'));
  expect(await published).toEqual({ status: 'blocked', reason: 'network' });
  expect(await coordinator.publish({ version: '2.0.0' })).toEqual({
    status: 'blocked',
    reason: 'network',
  });
  const retried = coordinator.retry();
  expect(calls[1].request).toBe(calls[0].request);
  expect(calls[1].request).toMatchObject({
    kind: 'publish',
    expectedRevision: 'r0',
    input: { version: '1.0.0' },
  });
  await ack(1, document('r1'));
  expect(saveAt(2)).toMatchObject({
    expectedRevision: 'r1',
    requestKey: 'request-2',
    patch: { content: 'New draft' },
  });
  await ack(2, document('r2', { content: 'New draft' }));
  expect((await retried).status).toBe('saved');
});

test('definitive rejection preserves edits and permits a corrected request with a new key', async () => {
  const { coordinator, calls, saveAt, ack } = setup();
  coordinator.stage({ name: 'Invalid name' });
  const flushed = coordinator.flush();
  calls[0].deferred.resolve({
    status: 'rejected',
    message: 'Name unavailable.',
  });
  expect(await flushed).toEqual({ status: 'blocked', reason: 'rejected' });
  expect(await coordinator.retry()).toEqual({
    status: 'blocked',
    reason: 'rejected',
  });
  expect(coordinator.getSnapshot().definition.name).toBe('Invalid name');
  coordinator.stage({ name: 'Corrected name' });
  expect(calls).toHaveLength(1);
  const corrected = coordinator.flush();
  expect(saveAt(1)).toMatchObject({
    expectedRevision: 'r0',
    requestKey: 'request-2',
    patch: { name: 'Corrected name' },
  });
  await ack(1, document('r1', { name: 'Corrected name' }));
  expect((await corrected).status).toBe('saved');
});

test('coordinator snapshots stay stable and immutable between events', async () => {
  const { coordinator, ack } = setup();
  const first = coordinator.getSnapshot();
  expect(coordinator.getSnapshot()).toBe(first);
  let notifications = 0;
  const unsubscribe = coordinator.subscribe(() => notifications++);
  coordinator.stage({ references: ['snippet-a'] });
  const staged = coordinator.getSnapshot();
  expect(staged).not.toBe(first);
  expect(coordinator.getSnapshot()).toBe(staged);
  expect(first.definition.references).toEqual([]);
  expect(() => staged.definition.references.push('mutated')).toThrow();
  expect(notifications).toBe(1);
  unsubscribe();
  const flushed = coordinator.flush();
  await ack(0, document('r1', { references: ['snippet-a'] }));
  await flushed;
  expect(notifications).toBe(1);
  expect(staged.dirty).toBe(true);
  expect(coordinator.getSnapshot().dirty).toBe(false);
});

test('a corrected publication can follow definitive rejection without a fake draft edit', async () => {
  const { coordinator, calls, ack } = setup();
  const rejected = coordinator.publish({ version: '0.0.0' });
  calls[0].deferred.resolve({
    status: 'rejected',
    message: 'Choose a newer version.',
  });
  expect(await rejected).toEqual({ status: 'blocked', reason: 'rejected' });
  const corrected = coordinator.publish({ version: '1.0.0' });
  expect(calls).toHaveLength(2);
  expect(calls[1].request).toMatchObject({
    kind: 'publish',
    expectedRevision: 'r0',
    input: { version: '1.0.0' },
  });
  expect(calls[1].request.requestKey).not.toBe(calls[0].request.requestKey);
  await ack(1, document('r1'));
  expect((await corrected).status).toBe('saved');
});

test('a new publication cannot clear a rejected draft or an uncertain publication', async () => {
  const draft = setup();
  draft.coordinator.stage({ content: 'Invalid draft' });
  const flushed = draft.coordinator.flush();
  draft.calls[0].deferred.resolve({
    status: 'rejected',
    message: 'Invalid draft.',
  });
  await flushed;
  expect(await draft.coordinator.publish({ version: '1.0.0' })).toEqual({
    status: 'blocked',
    reason: 'rejected',
  });
  expect(draft.coordinator.getSnapshot().pending).toEqual({
    content: 'Invalid draft',
  });
  expect(draft.calls).toHaveLength(1);
  const publication = setup();
  const uncertain = publication.coordinator.publish({ version: '1.0.0' });
  publication.calls[0].deferred.reject(new Error('Response lost'));
  await uncertain;
  expect(await publication.coordinator.publish({ version: '2.0.0' })).toEqual({
    status: 'blocked',
    reason: 'network',
  });
  expect(publication.calls).toHaveLength(1);
});
