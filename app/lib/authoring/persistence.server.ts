import { nanoid } from 'nanoid';

export const AUTHORING_RETRY_WINDOW_MS = 24 * 60 * 60 * 1000;
export const AUTHORING_HISTORY_WINDOW_MS = 90 * 24 * 60 * 60 * 1000;
export const AUTHORING_SNAPSHOT_MAX_BYTES = 786_432;
export const AUTHORING_RESULT_MAX_BYTES = 131_072;

type SqlValue = string | number | null;
type Database = Pick<D1Database, 'prepare' | 'batch'>;

export type AuthoringCommitPredicate = {
  sql: string;
  values?: readonly SqlValue[];
};

export type AuthoringCommitActor = {
  organizationId: string;
  userId: string;
  name: string;
} & (
  | { source: 'browser' }
  | {
      source: 'mcp';
      connectionId: string;
      clientId: string;
      clientName: string;
    }
);

export type AuthoringCommitIdentity = {
  actor: AuthoringCommitActor;
  operation: string;
  requestKey: string;
  requestHash: string;
};

type AuthoringTable =
  | 'prompt'
  | 'prompt_version'
  | 'prompt_version_snippet'
  | 'composer'
  | 'composer_version'
  | 'composer_version_prompt';

type ExpectedChanges = number | { min: number; max: number };

export type AuthoringWrite = { expectedChanges: ExpectedChanges } & (
  | {
      kind: 'insert';
      table: AuthoringTable;
      columns: readonly string[];
      rows: readonly (readonly SqlValue[])[];
    }
  | {
      kind: 'update';
      table: AuthoringTable;
      set: Readonly<Record<string, SqlValue>>;
      where: AuthoringCommitPredicate;
    }
  | {
      kind: 'delete';
      table: AuthoringTable;
      where: AuthoringCommitPredicate;
    }
);

export type AuthoringCommitTarget = {
  kind: 'prompt' | 'composer';
  documentId: string;
  expectedRevision: string | null;
};

export type AuthoringPreparedCommit<T> = {
  writes: readonly AuthoringWrite[];
  ensureDefaultFolder?: true;
  before: unknown | null;
  after: unknown;
  versionId: string | null;
  result: T;
  sideEffects: readonly {
    kind: 'invalidate_cache' | 'notify_editors';
    payload: unknown;
  }[];
};

export type AuthoringCommitInput<T> = AuthoringCommitIdentity & {
  target: AuthoringCommitTarget;
  guards: readonly AuthoringCommitPredicate[];
  prepare: (context: {
    revision: string;
    changeId: string;
    now: number;
  }) => AuthoringPreparedCommit<T>;
};

export type AuthoringReplay<T> =
  | { status: 'replayed'; result: T }
  | { status: 'key_conflict' }
  | { status: 'missing' };

export type AuthoringCommitResult<T> =
  | Exclude<AuthoringReplay<T>, { status: 'missing' }>
  | { status: 'committed'; result: T }
  | { status: 'not_admitted'; currentRevision: string | null };

type RequestRow = {
  id: string;
  request_hash: string;
  result_json: string;
};

const actorScope = (actor: AuthoringCommitActor) =>
  actor.source === 'mcp'
    ? `mcp:${actor.connectionId}`
    : `browser:${actor.userId}`;

const assertString = (value: string, name: string, max: number) => {
  if (typeof value !== 'string' || !value.length || value.length > max) {
    throw new Error(`Invalid authoring ${name}.`);
  }
};

const validateIdentity = (input: AuthoringCommitIdentity) => {
  assertString(input.actor.organizationId, 'workspace', 128);
  assertString(input.actor.userId, 'actor', 128);
  assertString(input.actor.name, 'actor name', 256);
  assertString(input.operation, 'operation', 128);
  assertString(input.requestKey, 'request key', 256);
  if (!/^[a-f0-9]{64}$/.test(input.requestHash)) {
    throw new Error('Authoring request hash must be a SHA-256 hex digest.');
  }
  if (input.actor.source === 'mcp') {
    assertString(input.actor.connectionId, 'connection', 128);
    assertString(input.actor.clientId, 'client', 2048);
    assertString(input.actor.clientName, 'client name', 256);
  }
};

const encodeJson = (value: unknown, max: number, name: string) => {
  const json = JSON.stringify(value);
  if (json === undefined || new TextEncoder().encode(json).length > max) {
    throw new Error(`Authoring ${name} exceeds the ${max}-byte JSON limit.`);
  }
  return json;
};

const quoteIdentifier = (value: string) => {
  if (!/^[a-z][a-z0-9_]*$/.test(value)) {
    throw new Error('Invalid authoring SQL identifier.');
  }
  return `"${value}"`;
};

const validSqlValue = (value: SqlValue) =>
  value === null ||
  typeof value === 'string' ||
  (typeof value === 'number' && Number.isFinite(value));

const prepare = (db: Database, sql: string, values: readonly SqlValue[]) => {
  if (values.length > 100 || new TextEncoder().encode(sql).length > 100_000) {
    throw new Error('Authoring statement exceeds D1 query limits.');
  }
  if (!values.every(validSqlValue)) {
    throw new Error('Invalid authoring SQL value.');
  }
  return db.prepare(sql).bind(...values);
};

const scopedRequest = (
  db: Database,
  input: AuthoringCommitIdentity,
  now: number,
) =>
  prepare(
    db,
    `SELECT id, request_hash, result_json FROM authoring_request
     WHERE organization_id = ? AND actor_scope = ? AND operation = ?
       AND request_key = ? AND expires_at > ? AND commit_state = 'complete'`,
    [
      input.actor.organizationId,
      actorScope(input.actor),
      input.operation,
      input.requestKey,
      now,
    ],
  );

const decodeReplay = <T>(
  row: RequestRow | null,
  requestHash: string,
): AuthoringReplay<T> => {
  if (!row) return { status: 'missing' };
  if (row.request_hash !== requestHash) return { status: 'key_conflict' };
  return { status: 'replayed', result: JSON.parse(row.result_json) as T };
};

export const readAuthoringReplay = async <T>(
  db: D1Database,
  input: AuthoringCommitIdentity,
  now = Date.now(),
): Promise<AuthoringReplay<T>> => {
  validateIdentity(input);
  const row = await scopedRequest(
    db.withSession('first-primary'),
    input,
    now,
  ).first<RequestRow>();
  return decodeReplay<T>(row, input.requestHash);
};

const admitted = `EXISTS (SELECT 1 FROM authoring_request WHERE id = ? AND commit_state = 'pending')`;

const assertChanges = (
  db: Database,
  attemptId: string,
  expected: ExpectedChanges,
) => {
  const { min, max } =
    typeof expected === 'number' ? { min: expected, max: expected } : expected;
  if (
    !Number.isSafeInteger(min) ||
    !Number.isSafeInteger(max) ||
    min < 0 ||
    max < min
  ) {
    throw new Error('Invalid authoring affected-row expectation.');
  }
  return prepare(
    db,
    `UPDATE authoring_request SET commit_state =
       CASE WHEN changes() BETWEEN ? AND ? THEN 'pending' ELSE 'invalid' END
     WHERE id = ? AND commit_state = 'pending'`,
    [min, max, attemptId],
  );
};

const ownership = (
  write: AuthoringWrite,
  target: AuthoringCommitTarget,
  organizationId: string,
): AuthoringCommitPredicate => {
  const versionTable = `${target.kind}_version`;
  const junctionTable =
    target.kind === 'prompt'
      ? 'prompt_version_snippet'
      : 'composer_version_prompt';
  if (![target.kind, versionTable, junctionTable].includes(write.table)) {
    throw new Error(
      'Authoring writes must belong to the target document kind.',
    );
  }
  const column = (name: string) => {
    if (write.kind !== 'insert')
      return `${quoteIdentifier(write.table)}.${quoteIdentifier(name)}`;
    const index = write.columns.indexOf(name);
    if (index < 0) throw new Error(`Authoring insert requires ${name}.`);
    return `json_extract(value, '$[${index}]')`;
  };
  if (write.table === target.kind) {
    return {
      sql: `${column('id')} = ? AND ${column('organization_id')} = ?`,
      values: [target.documentId, organizationId],
    };
  }
  if (write.table === versionTable) {
    return {
      sql: `${column(`${target.kind}_id`)} = ?`,
      values: [target.documentId],
    };
  }
  return {
    sql: `${column(`${target.kind}_version_id`)} IN
      (SELECT id FROM ${quoteIdentifier(versionTable)} WHERE ${quoteIdentifier(`${target.kind}_id`)} = ?)`,
    values: [target.documentId],
  };
};

const buildWrite = (
  db: Database,
  write: AuthoringWrite,
  attemptId: string,
  target: AuthoringCommitTarget,
  organizationId: string,
  ensureDefaultFolder: boolean,
) => {
  const table = quoteIdentifier(write.table);
  const own = ownership(write, target, organizationId);
  if (write.kind === 'insert') {
    if (
      !write.columns.length ||
      write.columns.length > 100 ||
      new Set(write.columns).size !== write.columns.length ||
      write.rows.some(
        (row) =>
          row.length !== write.columns.length || !row.every(validSqlValue),
      )
    ) {
      throw new Error('Invalid authoring insert columns or rows.');
    }
    const defaultFolder = ensureDefaultFolder && write.table === target.kind;
    if (defaultFolder && write.columns.includes('folder_id')) {
      throw new Error(
        'A default folder cannot be combined with an explicit folder.',
      );
    }
    const columns = [...write.columns, ...(defaultFolder ? ['folder_id'] : [])]
      .map(quoteIdentifier)
      .join(', ');
    const selectors = [
      ...write.columns.map((_, index) => `json_extract(value, '$[${index}]')`),
      ...(defaultFolder
        ? [
            `(SELECT id FROM ${quoteIdentifier(`${target.kind}_folder`)} WHERE organization_id = ? AND name = 'Untitled')`,
          ]
        : []),
    ].join(', ');
    return prepare(
      db,
      `INSERT INTO ${table} (${columns})
       SELECT ${selectors} FROM json_each(?) WHERE (${own.sql}) AND ${admitted}`,
      [
        ...(defaultFolder ? [organizationId] : []),
        encodeJson(write.rows, 1_572_864, 'insert'),
        ...(own.values ?? []),
        attemptId,
      ],
    );
  }
  const whereValues = write.where.values ?? [];
  if (write.kind === 'delete') {
    return prepare(
      db,
      `DELETE FROM ${table} WHERE (${write.where.sql}) AND (${own.sql}) AND ${admitted}`,
      [...whereValues, ...(own.values ?? []), attemptId],
    );
  }
  const fields = Object.entries(write.set);
  if (!fields.length) throw new Error('An authoring update needs fields.');
  const immutable = new Set([
    'id',
    'organization_id',
    'revision',
    `${target.kind}_id`,
    `${target.kind}_version_id`,
  ]);
  if (fields.some(([field]) => immutable.has(field))) {
    throw new Error(
      'Authoring updates cannot reassign document ownership or revision.',
    );
  }
  return prepare(
    db,
    `UPDATE ${table} SET ${fields.map(([field]) => `${quoteIdentifier(field)} = ?`).join(', ')}
     WHERE (${write.where.sql}) AND (${own.sql}) AND ${admitted}`,
    [
      ...fields.map(([, value]) => value),
      ...whereValues,
      ...(own.values ?? []),
      attemptId,
    ],
  );
};

export const commitAuthoringMutation = async <T>(
  db: D1Database,
  input: AuthoringCommitInput<T>,
  now = Date.now(),
): Promise<AuthoringCommitResult<T>> => {
  validateIdentity(input);
  const session = db.withSession('first-primary');
  const existing = await scopedRequest(session, input, now).first<RequestRow>();
  const replay = decodeReplay<T>(existing, input.requestHash);
  if (replay.status !== 'missing') return replay;

  assertString(input.target.documentId, 'document', 128);
  if (input.target.expectedRevision !== null) {
    assertString(input.target.expectedRevision, 'revision', 128);
  }
  const attemptId = nanoid();
  const revision = nanoid();
  const plan = input.prepare({ revision, changeId: attemptId, now });
  if (plan.ensureDefaultFolder && input.target.expectedRevision !== null) {
    throw new Error('Only document creation may ensure a default folder.');
  }
  if (!plan.writes.length || plan.writes.length > 200) {
    throw new Error('Authoring commit needs between 1 and 200 writes.');
  }
  if ((input.target.expectedRevision === null) !== (plan.before === null)) {
    throw new Error(
      'Authoring before snapshot must match create/update intent.',
    );
  }
  if (
    plan.sideEffects.length > 2 ||
    new Set(plan.sideEffects.map((effect) => effect.kind)).size !==
      plan.sideEffects.length
  ) {
    throw new Error('Authoring side effects must have distinct event kinds.');
  }
  const resultJson = encodeJson(
    plan.result,
    AUTHORING_RESULT_MAX_BYTES,
    'result',
  );
  const beforeJson =
    plan.before === null
      ? null
      : encodeJson(
          plan.before,
          AUTHORING_SNAPSHOT_MAX_BYTES,
          'before snapshot',
        );
  const afterJson = encodeJson(
    plan.after,
    AUTHORING_SNAPSHOT_MAX_BYTES,
    'after snapshot',
  );
  const table = quoteIdentifier(input.target.kind);
  const current =
    input.target.expectedRevision === null
      ? `NOT EXISTS (SELECT 1 FROM ${table} WHERE id = ?)`
      : `EXISTS (SELECT 1 FROM ${table} WHERE id = ? AND organization_id = ?
         AND deleted_at IS NULL AND revision = ?)`;
  const currentValues =
    input.target.expectedRevision === null
      ? [input.target.documentId]
      : [
          input.target.documentId,
          input.actor.organizationId,
          input.target.expectedRevision,
        ];
  const extraGuards = input.guards
    .map((guard) => `AND (${guard.sql})`)
    .join(' ');
  const statements = [
    prepare(
      session,
      `DELETE FROM authoring_request WHERE organization_id = ? AND actor_scope = ?
       AND operation = ? AND request_key = ? AND expires_at <= ?`,
      [
        input.actor.organizationId,
        actorScope(input.actor),
        input.operation,
        input.requestKey,
        now,
      ],
    ),
    prepare(
      session,
      `INSERT INTO authoring_request
       (id, organization_id, actor_scope, operation, request_key, request_hash,
        commit_state, result_json, created_at, expires_at)
       SELECT ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ? WHERE ${current} ${extraGuards}
       ON CONFLICT (organization_id, actor_scope, operation, request_key) DO NOTHING`,
      [
        attemptId,
        input.actor.organizationId,
        actorScope(input.actor),
        input.operation,
        input.requestKey,
        input.requestHash,
        resultJson,
        now,
        now + AUTHORING_RETRY_WINDOW_MS,
        ...currentValues,
        ...input.guards.flatMap((guard) => guard.values ?? []),
      ],
    ),
    ...(plan.ensureDefaultFolder
      ? [
          prepare(
            session,
            `INSERT INTO ${quoteIdentifier(`${input.target.kind}_folder`)}
         (id, name, organization_id, created_by, created_at, updated_at)
         SELECT ?, 'Untitled', ?, ?, ?, ? WHERE ${admitted}
         AND NOT EXISTS (SELECT 1 FROM ${quoteIdentifier(`${input.target.kind}_folder`)}
           WHERE organization_id = ? AND name = 'Untitled')`,
            [
              nanoid(),
              input.actor.organizationId,
              input.actor.userId,
              now,
              now,
              attemptId,
              input.actor.organizationId,
            ],
          ),
          assertChanges(session, attemptId, { min: 0, max: 1 }),
        ]
      : []),
    ...plan.writes.flatMap((write) => [
      buildWrite(
        session,
        write,
        attemptId,
        input.target,
        input.actor.organizationId,
        plan.ensureDefaultFolder === true,
      ),
      assertChanges(session, attemptId, write.expectedChanges),
    ]),
    prepare(
      session,
      `UPDATE ${table} SET revision = ? WHERE id = ? AND organization_id = ?
       ${input.target.expectedRevision === null ? '' : 'AND revision = ?'}
       AND ${admitted}`,
      [
        revision,
        input.target.documentId,
        input.actor.organizationId,
        ...(input.target.expectedRevision === null
          ? []
          : [input.target.expectedRevision]),
        attemptId,
      ],
    ),
    assertChanges(session, attemptId, 1),
    prepare(
      session,
      `INSERT INTO authoring_change
       (id, organization_id, prompt_id, composer_id, actor_user_id, actor_name, actor_scope,
        connection_id, client_id, client_name, operation, revision, version_id, created_at, expires_at)
       SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ? WHERE ${admitted}`,
      [
        attemptId,
        input.actor.organizationId,
        input.target.kind === 'prompt' ? input.target.documentId : null,
        input.target.kind === 'composer' ? input.target.documentId : null,
        input.actor.userId,
        input.actor.name,
        actorScope(input.actor),
        input.actor.source === 'mcp' ? input.actor.connectionId : null,
        input.actor.source === 'mcp' ? input.actor.clientId : null,
        input.actor.source === 'mcp' ? input.actor.clientName : null,
        input.operation,
        revision,
        plan.versionId,
        now,
        now + AUTHORING_HISTORY_WINDOW_MS,
        attemptId,
      ],
    ),
    ...[
      ...(beforeJson === null ? [] : [{ phase: 'before', json: beforeJson }]),
      { phase: 'after', json: afterJson },
    ].map((snapshot) => {
      const defaultFolder =
        plan.ensureDefaultFolder && snapshot.phase === 'after';
      return prepare(
        session,
        `INSERT INTO authoring_snapshot (change_id, phase, definition_json)
         SELECT ?, ?, ${
           defaultFolder
             ? `json_set(?, '$.folderId',
           (SELECT folder_id FROM ${table} WHERE id = ? AND organization_id = ?))`
             : '?'
}
         WHERE ${admitted}`,
        [
          attemptId,
          snapshot.phase,
          snapshot.json,
          ...(defaultFolder
            ? [input.target.documentId, input.actor.organizationId]
            : []),
          attemptId,
        ],
      );
    }),
    ...plan.sideEffects.map((effect) =>
      prepare(
        session,
        `INSERT INTO authoring_outbox
       (id, organization_id, change_id, document_kind, document_id, revision,
        event_kind, payload_json, created_at, available_at)
       SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ? WHERE ${admitted}`,
        [
          nanoid(),
          input.actor.organizationId,
          attemptId,
          input.target.kind,
          input.target.documentId,
          revision,
          effect.kind,
          encodeJson(effect.payload, 16_384, 'side effect'),
          now,
          now,
          attemptId,
        ],
      ),
    ),
    prepare(
      session,
      `UPDATE authoring_request SET commit_state = 'complete'
      WHERE id = ? AND commit_state = 'pending'`,
      [attemptId],
    ),
    scopedRequest(session, input, now),
    prepare(
      session,
      `SELECT revision FROM ${table}
      WHERE id = ? AND organization_id = ? AND deleted_at IS NULL`,
      [input.target.documentId, input.actor.organizationId],
    ),
  ];
  const results = await session.batch(statements);
  const row = results.at(-2)?.results[0] as RequestRow | undefined;
  if (row?.id === attemptId)
    return { status: 'committed', result: JSON.parse(row.result_json) as T };
  const racedReplay = decodeReplay<T>(row ?? null, input.requestHash);
  if (racedReplay.status !== 'missing') return racedReplay;
  const document = results.at(-1)?.results[0] as
    | { revision: string }
    | undefined;
  return {
    status: 'not_admitted',
    currentRevision: document?.revision ?? null,
  };
};

export const cleanupAuthoringPersistence = async (
  db: D1Database,
  now = Date.now(),
  limit = 100,
) => {
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 1000) {
    throw new Error('Authoring cleanup limit must be between 1 and 1000.');
  }
  const results = await db.batch([
    prepare(
      db,
      `DELETE FROM authoring_request WHERE id IN
      (SELECT id FROM authoring_request WHERE expires_at <= ? ORDER BY expires_at LIMIT ?) RETURNING id`,
      [now, limit],
    ),
    prepare(
      db,
      `DELETE FROM authoring_change WHERE id IN
      (SELECT id FROM authoring_change WHERE expires_at <= ? ORDER BY expires_at LIMIT ?) RETURNING id`,
      [now, limit],
    ),
    prepare(
      db,
      `DELETE FROM authoring_outbox WHERE id IN
      (SELECT id FROM authoring_outbox WHERE delivered_at <= ? ORDER BY delivered_at LIMIT ?) RETURNING id`,
      [now - AUTHORING_HISTORY_WINDOW_MS, limit],
    ),
  ]);
  return {
    requests: results[0].results.length,
    changes: results[1].results.length,
    deliveredEvents: results[2].results.length,
  };
};
