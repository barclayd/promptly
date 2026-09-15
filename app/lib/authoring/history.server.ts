import type {
  ComposerDefinition,
  PromptDefinition,
} from '../validations/authoring';
import {
  type AuthoringAfterSnapshotInput,
  type AuthoringChangeInput,
  type AuthoringHistoryKind,
  type AuthoringHistoryListInput,
  authoringAfterSnapshotInputSchema,
  authoringChangeInputSchema,
  authoringHistoryListInputSchema,
  authoringStoredSnapshotSchema,
} from '../validations/authoring-history';
import {
  type AuthoringPrincipal,
  authorizeAuthoringAccess,
} from './access.server';
import {
  parseAuthoringValue,
  parseComposerDefinition,
  parsePromptDefinition,
} from './normalize';
import {
  AUTHORING_HISTORY_WINDOW_MS,
  AUTHORING_SNAPSHOT_MAX_BYTES,
} from './persistence.server';
import {
  AuthoringError,
  type AuthoringPage,
  type AuthoringVersion,
} from './types';

export type AuthoringChangeSummary = {
  id: string;
  document: { kind: AuthoringHistoryKind; id: string; name: string };
  actor: {
    userId: string | null;
    name: string;
    source: 'browser' | 'mcp';
    clientId: string | null;
    clientName: string | null;
    connectionId: string | null;
  };
  operation: string;
  revision: string;
  versionId: string | null;
  createdAt: number;
  expiresAt: number;
};

export type AuthoringHistorySnapshot = (
  | { kind: 'prompt'; definition: PromptDefinition }
  | { kind: 'composer'; definition: ComposerDefinition }
) & {
  folderId: string | null;
  version: AuthoringVersion;
};

export type AuthoringChange = {
  change: AuthoringChangeSummary;
  before: AuthoringHistorySnapshot | null;
  after: AuthoringHistorySnapshot;
};

export type AuthoringAfterSnapshot = AuthoringHistorySnapshot & {
  changeId: string;
  revision: string;
};

type ChangeRow = {
  id: string;
  document_kind: AuthoringHistoryKind;
  document_id: string;
  document_name: string;
  actor_user_id: string | null;
  actor_name: string;
  actor_scope: string;
  connection_id: string | null;
  client_id: string | null;
  client_name: string | null;
  operation: string;
  revision: string;
  version_id: string | null;
  created_at: number;
  expires_at: number;
  before_json?: string | null;
  after_json?: string | null;
};

type HistoryFilter = {
  kind?: AuthoringHistoryKind;
  id?: string;
  changeId?: string;
  revision?: string;
};

const changeFields = `c.id, CASE WHEN c.prompt_id IS NOT NULL THEN 'prompt' ELSE 'composer' END AS document_kind,
  COALESCE(c.prompt_id, c.composer_id) AS document_id, COALESCE(p.name, composer.name) AS document_name,
  c.actor_user_id, c.actor_name, c.actor_scope, c.connection_id, c.client_id, c.client_name,
  c.operation, c.revision, c.version_id, c.created_at, c.expires_at`;

const authorizedQuery = async (
  db: D1Database,
  principal: AuthoringPrincipal,
  filter: HistoryFilter,
  now: number,
) => {
  if (!Number.isSafeInteger(now) || now < 0)
    throw new AuthoringError(
      'invalid_input',
      'The history timestamp is invalid.',
    );
  const access = await authorizeAuthoringAccess(db, principal, 'mcp:read');
  const predicates = [
    'c.organization_id = ?',
    'c.expires_at > ?',
    'c.created_at > ?',
    '((p.id IS NOT NULL AND p.organization_id = c.organization_id AND p.deleted_at IS NULL) OR (composer.id IS NOT NULL AND composer.organization_id = c.organization_id AND composer.deleted_at IS NULL))',
  ];
  const values: (string | number | null)[] = [
    access.actor.organizationId,
    now,
    now - AUTHORING_HISTORY_WINDOW_MS,
  ];
  for (const guard of access.guards) {
    predicates.push(`(${guard.sql})`);
    values.push(...(guard.values ?? []));
  }
  if (filter.kind)
    predicates.push(
      filter.kind === 'prompt'
        ? 'c.prompt_id IS NOT NULL'
        : 'c.composer_id IS NOT NULL',
    );
  if (filter.id) {
    predicates.push(
      filter.kind === 'prompt' ? 'c.prompt_id = ?' : 'c.composer_id = ?',
    );
    values.push(filter.id);
  }
  if (filter.changeId) {
    predicates.push('c.id = ?');
    values.push(filter.changeId);
  }
  if (filter.revision) {
    predicates.push('c.revision = ?');
    values.push(filter.revision);
  }
  return {
    session: db.withSession('first-primary'),
    from: 'FROM authoring_change c LEFT JOIN prompt p ON p.id = c.prompt_id LEFT JOIN composer ON composer.id = c.composer_id',
    where: `WHERE ${predicates.join(' AND ')}`,
    values,
  };
};

const toSummary = (row: ChangeRow): AuthoringChangeSummary => ({
  id: row.id,
  document: {
    kind: row.document_kind,
    id: row.document_id,
    name: row.document_name,
  },
  actor: {
    userId: row.actor_user_id,
    name: row.actor_name,
    source: row.actor_scope.startsWith('mcp:') ? 'mcp' : 'browser',
    clientId: row.client_id,
    clientName: row.client_name,
    connectionId: row.connection_id,
  },
  operation: row.operation,
  revision: row.revision,
  versionId: row.version_id,
  createdAt: row.created_at,
  expiresAt: row.expires_at,
});

const decodeSnapshot = (
  row: ChangeRow,
  phase: 'before' | 'after',
): AuthoringHistorySnapshot | null => {
  const json = phase === 'before' ? row.before_json : row.after_json;
  if (json === null || json === undefined) {
    if (phase === 'before') return null;
    throw new AuthoringError(
      'invalid_stored_definition',
      'The saved after-state is missing.',
    );
  }
  try {
    // Snapshot metadata wraps the definition; it must not consume the
    // definition's own depth/node budget. Bound bytes before decoding, then
    // validate the small envelope and the definition independently.
    if (new TextEncoder().encode(json).length > AUTHORING_SNAPSHOT_MAX_BYTES)
      throw new Error('Snapshot too large');
    const value: unknown = JSON.parse(json);
    const envelope = parseAuthoringValue(authoringStoredSnapshotSchema, value);
    if (phase === 'after' && envelope.version.id !== row.version_id)
      throw new Error('Version mismatch');
    return row.document_kind === 'prompt'
      ? {
          kind: 'prompt',
          definition: parsePromptDefinition(envelope.definition).definition,
          folderId: envelope.folderId,
          version: envelope.version,
        }
      : {
          kind: 'composer',
          definition: parseComposerDefinition(envelope.definition).definition,
          folderId: envelope.folderId,
          version: envelope.version,
        };
  } catch {
    throw new AuthoringError(
      'invalid_stored_definition',
      'The saved change snapshot requires repair.',
    );
  }
};

const readChangeRow = async (
  db: D1Database,
  principal: AuthoringPrincipal,
  filter: HistoryFilter,
  now: number,
): Promise<ChangeRow> => {
  const query = await authorizedQuery(db, principal, filter, now);
  const result = await query.session
    .prepare(`SELECT ${changeFields}, before.definition_json AS before_json, after.definition_json AS after_json
    ${query.from}
    LEFT JOIN authoring_snapshot before ON before.change_id = c.id AND before.phase = 'before'
    LEFT JOIN authoring_snapshot after ON after.change_id = c.id AND after.phase = 'after'
    ${query.where} ORDER BY c.created_at DESC, c.id ASC LIMIT 2`)
    .bind(...query.values)
    .all<ChangeRow>();
  if (result.results.length !== 1)
    throw new AuthoringError(
      'change_not_found',
      'This change is unavailable in the current workspace or outside its retention window.',
    );
  return result.results[0];
};

export const listAuthoringChanges = async (
  db: D1Database,
  principal: AuthoringPrincipal,
  rawInput: AuthoringHistoryListInput = {},
  now = Date.now(),
): Promise<AuthoringPage<AuthoringChangeSummary>> => {
  const input = parseAuthoringValue(authoringHistoryListInputSchema, rawInput);
  const query = await authorizedQuery(db, principal, input, now);
  const result = await query.session
    .prepare(`SELECT ${changeFields} ${query.from} ${query.where}
    ORDER BY c.created_at DESC, c.id ASC LIMIT ? OFFSET ?`)
    .bind(...query.values, input.limit + 1, input.offset)
    .all<ChangeRow>();
  return {
    items: result.results.slice(0, input.limit).map(toSummary),
    nextOffset:
      result.results.length > input.limit ? input.offset + input.limit : null,
  };
};

export const getAuthoringChange = async (
  db: D1Database,
  principal: AuthoringPrincipal,
  rawInput: AuthoringChangeInput,
  now = Date.now(),
): Promise<AuthoringChange> => {
  const input = parseAuthoringValue(authoringChangeInputSchema, rawInput);
  const row = await readChangeRow(db, principal, input, now);
  const after = decodeSnapshot(row, 'after');
  if (!after)
    throw new AuthoringError(
      'invalid_stored_definition',
      'The saved after-state is missing.',
    );
  return {
    change: toSummary(row),
    before: decodeSnapshot(row, 'before'),
    after,
  };
};

export const getAuthoringAfterSnapshot = async (
  db: D1Database,
  principal: AuthoringPrincipal,
  rawInput: AuthoringAfterSnapshotInput,
  now = Date.now(),
): Promise<AuthoringAfterSnapshot> => {
  const input = parseAuthoringValue(
    authoringAfterSnapshotInputSchema,
    rawInput,
  );
  const row = await readChangeRow(db, principal, input, now);
  const after = decodeSnapshot(row, 'after');
  if (!after)
    throw new AuthoringError(
      'invalid_stored_definition',
      'The saved after-state is missing.',
    );
  return { ...after, changeId: row.id, revision: row.revision };
};
