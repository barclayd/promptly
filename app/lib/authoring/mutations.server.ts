import { nanoid } from 'nanoid';
import type {
  ComposerAuthoringEditInput,
  ComposerDefinition,
  PromptAuthoringEditInput,
  PromptDefinition,
} from '../validations/authoring';
import {
  type CreateComposerAuthoringInput,
  type CreatePromptAuthoringInput,
  createComposerAuthoringSchema,
  createPromptAuthoringSchema,
  type DeleteAuthoringInput,
  deleteAuthoringSchema,
  type PublishAuthoringInput,
  publishAuthoringSchema,
  type RestoreAuthoringChangeInput,
  restoreAuthoringChangeSchema,
  type UpdateComposerAuthoringInput,
  type UpdatePromptAuthoringInput,
  updateComposerAuthoringSchema,
  updatePromptAuthoringSchema,
} from '../validations/authoring-mutations';
import {
  type AuthoringPrincipal,
  authorizeAuthoringAccess,
  getAuthoringPolicyGuards,
} from './access.server';
import {
  loadAuthoringSnippetContents,
  loadComposerPromptDependencies,
} from './dependencies.server';
import {
  applyComposerEdits,
  applyPromptEdits,
  canonicalAuthoringRequestHash,
} from './edits';
import { getAuthoringChange } from './history.server';
import {
  normalizeComposerDefinition,
  normalizePromptDefinition,
  parseAuthoringValue,
} from './normalize';
import {
  type AuthoringCommitIdentity,
  type AuthoringCommitPredicate,
  type AuthoringCommitResult,
  type AuthoringWrite,
  commitAuthoringMutation,
  readAuthoringReplay,
} from './persistence.server';
import { inspectComposerReadiness, inspectPromptReadiness } from './readiness';
import {
  readComposerDefinition,
  readPromptDefinition,
  resolveAuthoringDependencies,
} from './reads.server';
import {
  type AssignedAuthoringId,
  type AuthoringDependency,
  type AuthoringDiagnostic,
  AuthoringError,
  type AuthoringVersion,
} from './types';
import { selectAuthoringPublishVersion } from './versioning';

type Kind = 'prompt' | 'composer';
type Definition = PromptDefinition | ComposerDefinition;
type Value = string | number | null;
type Reference = { id: string; pinnedVersionId: string | null };

export type AuthoringMutationResult = {
  id: string;
  kind: Kind;
  changeId: string;
  versionId: string;
  revision: string;
  status: 'draft' | 'published';
  version: string | null;
  url: string;
  diagnostics: AuthoringDiagnostic[];
  assignedIds: AssignedAuthoringId[];
};

const readDefinition = (
  db: D1Database,
  kind: Kind,
  organizationId: string,
  id: string,
  version: 'working' | 'draft' | 'latest' = 'working',
) =>
  kind === 'prompt'
    ? readPromptDefinition(db, {
        organizationId,
        id,
        version: { kind: version },
      })
    : readComposerDefinition(db, {
        organizationId,
        id,
        version: { kind: version },
      });

const normalize = (kind: Kind, definition: unknown) => {
  if (kind === 'prompt') {
    const normalized = normalizePromptDefinition(definition);
    return {
      ...normalized,
      references: normalized.definition.snippets.map((ref) => ({
        id: ref.snippetId,
        pinnedVersionId: ref.snippetVersionId,
      })),
    };
  }
  const normalized = normalizeComposerDefinition(definition);
  return {
    ...normalized,
    references: normalized.promptReferences.map((ref) => ({
      id: ref.promptId,
      pinnedVersionId: ref.promptVersionId,
    })),
  };
};

const editDefinition = (
  kind: Kind,
  current: Definition,
  edit: PromptAuthoringEditInput | ComposerAuthoringEditInput,
) => {
  if (kind === 'prompt') {
    const normalized = applyPromptEdits(
      current as PromptDefinition,
      edit as PromptAuthoringEditInput,
    );
    return {
      ...normalized,
      references: normalized.definition.snippets.map((ref) => ({
        id: ref.snippetId,
        pinnedVersionId: ref.snippetVersionId,
      })),
    };
  }
  const normalized = applyComposerEdits(
    current as ComposerDefinition,
    edit as ComposerAuthoringEditInput,
  );
  return {
    ...normalized,
    references: normalized.promptReferences.map((ref) => ({
      id: ref.promptId,
      pinnedVersionId: ref.promptVersionId,
    })),
  };
};

type Normalized = ReturnType<typeof normalize>;

const folderGuard = async (
  db: D1Database,
  kind: Kind,
  organizationId: string,
  folderId: string | null | undefined,
): Promise<AuthoringCommitPredicate[]> => {
  if (!folderId) return [];
  const row = await db
    .withSession('first-primary')
    .prepare(
      `SELECT id FROM ${kind}_folder WHERE id = ? AND organization_id = ?`,
    )
    .bind(folderId, organizationId)
    .first();
  if (!row)
    throw new AuthoringError(
      'content_not_found',
      'Folder not found in this workspace.',
    );
  return [
    {
      sql: `EXISTS (SELECT 1 FROM ${kind}_folder WHERE id = ? AND organization_id = ?)`,
      values: [folderId, organizationId],
    },
  ];
};

const dependencyGuard = (
  kind: Kind,
  organizationId: string,
  references: readonly Reference[],
  dependencies: readonly AuthoringDependency[],
  publication: boolean,
): AuthoringCommitPredicate => {
  const target = kind === 'prompt' ? 'snippet' : 'prompt';
  const requested = references.map((reference, index) => ({
    ...reference,
    resolvedVersionId: dependencies[index]?.resolvedVersionId ?? null,
  }));
  return {
    sql: `NOT EXISTS (
      SELECT 1 FROM json_each(?) requested
      LEFT JOIN ${target} p ON p.id = json_extract(requested.value, '$.id')
        AND p.organization_id = ? AND p.deleted_at IS NULL
      LEFT JOIN ${target}_version v ON v.${target}_id = p.id
        AND v.id = json_extract(requested.value, '$.pinnedVersionId') AND v.published_at IS NOT NULL
      WHERE p.id IS NULL OR (json_extract(requested.value, '$.pinnedVersionId') IS NOT NULL AND v.id IS NULL)
      ${
        publication
          ? `OR json_extract(requested.value, '$.resolvedVersionId') IS NULL
        OR COALESCE(v.id, (SELECT id FROM ${target}_version latest WHERE latest.${target}_id = p.id AND latest.published_at IS NOT NULL
          ORDER BY major DESC, minor DESC, patch DESC, id ASC LIMIT 1)) IS NOT json_extract(requested.value, '$.resolvedVersionId')`
          : ''
      })`,
    values: [JSON.stringify(requested), organizationId],
  };
};

const nameGuard = async (
  db: D1Database,
  kind: Kind,
  organizationId: string,
  id: string,
  name: string,
): Promise<AuthoringCommitPredicate[]> => {
  if (kind === 'prompt') return [];
  const predicate: AuthoringCommitPredicate = {
    sql: 'NOT EXISTS (SELECT 1 FROM composer WHERE organization_id = ? AND name = ? AND id != ? AND deleted_at IS NULL)',
    values: [organizationId, name, id],
  };
  if (
    (await db
      .withSession('first-primary')
      .prepare(`SELECT (${predicate.sql}) AS available`)
      .bind(...(predicate.values ?? []))
      .first('available')) !== 1
  ) {
    throw new AuthoringError(
      'invalid_input',
      'A composer with this name already exists in this workspace.',
      [
        {
          code: 'duplicate_composer_name',
          severity: 'error',
          path: ['name'],
          message: 'Choose a different composer name.',
        },
      ],
    );
  }
  return [predicate];
};

const inspectDependencies = async (
  db: D1Database,
  kind: Kind,
  organizationId: string,
  normalized: Normalized,
) => {
  const dependencies = await resolveAuthoringDependencies(
    db.withSession('first-primary'),
    organizationId,
    kind === 'prompt' ? 'snippet' : 'prompt',
    normalized.references,
  );
  const diagnostics = [
    ...normalized.diagnostics,
    ...dependencies.flatMap((dependency, index): AuthoringDiagnostic[] =>
      dependency.resolvedVersionId === null
        ? [
            {
              code: 'missing_published_dependency',
              severity: 'error',
              path: ['references', index],
              message: `Publish dependency ${dependency.id} before publishing this ${kind}.`,
            },
          ]
        : [],
    ),
  ];
  const expandedSnippetDependencies: AuthoringDependency[] = [];
  if (kind === 'prompt') {
    const snippets = await loadAuthoringSnippetContents(
      db,
      organizationId,
      dependencies,
    );
    diagnostics.push(
      ...inspectPromptReadiness(normalized.definition as PromptDefinition, {
        snippets,
      }),
    );
  } else {
    const prompts = await loadComposerPromptDependencies(
      db,
      organizationId,
      dependencies,
    );
    for (const prompt of prompts) {
      expandedSnippetDependencies.push(...prompt.dependencies);
      diagnostics.push(
        ...[
          ...prompt.diagnostics,
          ...inspectPromptReadiness(prompt.definition, {
            snippets: prompt.snippets,
          }),
        ].map((entry) => ({
          ...entry,
          path: ['references', prompt.promptId, ...entry.path],
        })),
      );
    }
    diagnostics.push(
      ...inspectComposerReadiness(normalized.definition as ComposerDefinition, {
        prompts,
      }),
    );
  }
  return {
    dependencies,
    expandedSnippetDependencies,
    diagnostics: [
      ...new Map(
        diagnostics.map((item) => [JSON.stringify(item), item]),
      ).values(),
    ],
  };
};

const versionValues = (definition: Definition): Record<string, Value> => ({
  ...('systemMessage' in definition
    ? {
        system_message: definition.systemMessage,
        user_message: definition.userMessage,
      }
    : { content: definition.content }),
  config: JSON.stringify(definition.config),
  labels: definition.labels,
});

const versionWrites = (
  kind: Kind,
  normalized: Normalized,
  versionId: string,
  documentId: string,
  userId: string,
  now: number,
  create: boolean,
): AuthoringWrite[] => {
  const fields = {
    ...versionValues(normalized.definition),
    updated_at: now,
    updated_by: userId,
  };
  const versionTable =
    kind === 'prompt' ? 'prompt_version' : 'composer_version';
  const junctionTable =
    kind === 'prompt' ? 'prompt_version_snippet' : 'composer_version_prompt';
  const junctionRows =
    kind === 'prompt'
      ? (normalized.definition as PromptDefinition).snippets.map((ref) => [
          nanoid(),
          versionId,
          ref.snippetId,
          ref.snippetVersionId,
          ref.sortOrder,
        ])
      : normalized.references.map((ref) => [
          nanoid(),
          versionId,
          ref.id,
          ref.pinnedVersionId,
          ref.pinnedVersionId === null ? 1 : 0,
        ]);
  return [
    create
      ? {
          kind: 'insert',
          table: versionTable,
          columns: [
            'id',
            `${kind}_id`,
            'created_by',
            'created_at',
            ...Object.keys(fields),
          ],
          rows: [
            [versionId, documentId, userId, now, ...Object.values(fields)],
          ],
          expectedChanges: 1,
        }
      : {
          kind: 'update',
          table: versionTable,
          set: fields,
          where: {
            sql: 'id = ? AND published_at IS NULL',
            values: [versionId],
          },
          expectedChanges: 1,
        },
    {
      kind: 'delete',
      table: junctionTable,
      where: { sql: `${kind}_version_id = ?`, values: [versionId] },
      expectedChanges: { min: 0, max: 100 },
    },
    {
      kind: 'insert',
      table: junctionTable,
      columns: [
        'id',
        `${kind}_version_id`,
        kind === 'prompt' ? 'snippet_id' : 'prompt_id',
        kind === 'prompt' ? 'snippet_version_id' : 'prompt_version_id',
        kind === 'prompt' ? 'sort_order' : 'auto_update',
      ],
      rows: junctionRows,
      expectedChanges: junctionRows.length,
    },
  ];
};

const replayResult = async (
  db: D1Database,
  identity: AuthoringCommitIdentity,
) => {
  const replay = await readAuthoringReplay<AuthoringMutationResult>(
    db,
    identity,
  );
  if (replay.status === 'key_conflict')
    throw new AuthoringError(
      'idempotency_conflict',
      'This request key was already used with different input.',
    );
  return replay.status === 'replayed' ? replay.result : null;
};

const finish = async (
  db: D1Database,
  principal: AuthoringPrincipal,
  kind: Kind,
  action: 'create' | 'update' | 'publish',
  organizationId: string,
  documentId: string,
  expectedRevision: string | null,
  result: AuthoringCommitResult<AuthoringMutationResult>,
) => {
  if (result.status === 'committed' || result.status === 'replayed')
    return result.result;
  if (result.status === 'key_conflict')
    throw new AuthoringError(
      'idempotency_conflict',
      'This request key was already used with different input.',
    );
  await authorizeAuthoringAccess(
    db,
    principal,
    action === 'publish' ? 'mcp:publish' : 'mcp:write',
  );
  await getAuthoringPolicyGuards(db, organizationId, kind, action, documentId);
  if (
    expectedRevision !== null &&
    result.currentRevision !== expectedRevision
  ) {
    throw new AuthoringError(
      'stale_revision',
      'This document changed. Read its current revision before deciding how to edit it.',
      [
        {
          code: 'stale_revision',
          severity: 'error',
          path: ['expectedRevision'],
          message: result.currentRevision
            ? `Current revision: ${result.currentRevision}`
            : 'The document is no longer accessible.',
        },
      ],
      { currentRevision: result.currentRevision },
    );
  }
  throw new AuthoringError(
    'policy_changed',
    'A dependency, folder, or workspace policy changed before the operation committed. Read the current state and retry.',
  );
};

const mutationResult = (
  kind: Kind,
  id: string,
  version: AuthoringVersion,
  revision: string,
  changeId: string,
  diagnostics: AuthoringDiagnostic[],
  assignedIds: AssignedAuthoringId[],
): AuthoringMutationResult => ({
  id,
  kind,
  changeId,
  versionId: version.id,
  revision,
  status: version.status,
  version: version.version,
  url: `/${kind}s/${id}`,
  diagnostics,
  assignedIds,
});

const createDocument = async (
  db: D1Database,
  principal: AuthoringPrincipal,
  kind: Kind,
  rawInput: CreatePromptAuthoringInput | CreateComposerAuthoringInput,
) => {
  const access = await authorizeAuthoringAccess(db, principal, 'mcp:write');
  const input =
    kind === 'prompt'
      ? parseAuthoringValue(createPromptAuthoringSchema, rawInput)
      : parseAuthoringValue(createComposerAuthoringSchema, rawInput);
  const identity = {
    actor: access.actor,
    operation: `create_${kind}`,
    requestKey: input.requestKey,
    requestHash: await canonicalAuthoringRequestHash({
      operation: `create_${kind}`,
      input,
    }),
  };
  const replay = await replayResult(db, identity);
  if (replay) return replay;
  const normalized = normalize(kind, input.definition);
  const organizationId = access.actor.organizationId;
  const checked = await inspectDependencies(
    db,
    kind,
    organizationId,
    normalized,
  );
  const id = nanoid();
  const guards = [
    ...access.guards,
    ...(await getAuthoringPolicyGuards(db, organizationId, kind, 'create')),
    ...(await folderGuard(db, kind, organizationId, input.folderId)),
    ...(await nameGuard(
      db,
      kind,
      organizationId,
      id,
      normalized.definition.name,
    )),
    dependencyGuard(
      kind,
      organizationId,
      normalized.references,
      checked.dependencies,
      false,
    ),
  ];
  const result = await commitAuthoringMutation(db, {
    ...identity,
    target: { kind, documentId: id, expectedRevision: null },
    guards,
    prepare: ({ revision, changeId, now }) => {
      const version: AuthoringVersion = {
        id: nanoid(),
        status: 'draft',
        version: null,
        createdAt: now,
        updatedAt: now,
        publishedAt: null,
      };
      const useDefault = input.folderId === undefined;
      return {
        ensureDefaultFolder: useDefault ? true : undefined,
        writes: [
          {
            kind: 'insert',
            table: kind,
            columns: [
              'id',
              'name',
              'description',
              'organization_id',
              'created_by',
              'created_at',
              'updated_at',
              ...(useDefault ? [] : ['folder_id']),
            ],
            rows: [
              [
                id,
                normalized.definition.name,
                normalized.definition.description,
                organizationId,
                access.actor.userId,
                now,
                now,
                ...(useDefault ? [] : [input.folderId ?? null]),
              ],
            ],
            expectedChanges: 1,
          },
          ...versionWrites(
            kind,
            normalized,
            version.id,
            id,
            access.actor.userId,
            now,
            true,
          ),
        ],
        before: null,
        after: {
          definition: normalized.definition,
          folderId: input.folderId ?? null,
          version,
        },
        versionId: version.id,
        result: mutationResult(
          kind,
          id,
          version,
          revision,
          changeId,
          checked.diagnostics,
          normalized.assignedIds,
        ),
        sideEffects: [{ kind: 'notify_editors', payload: {} }],
      };
    },
  });
  return finish(
    db,
    principal,
    kind,
    'create',
    organizationId,
    id,
    null,
    result,
  );
};

const updateDocument = async (
  db: D1Database,
  principal: AuthoringPrincipal,
  kind: Kind,
  rawInput: UpdatePromptAuthoringInput | UpdateComposerAuthoringInput,
  restoreIdentity?: { operation: string; requestHash: string },
) => {
  const access = await authorizeAuthoringAccess(db, principal, 'mcp:write');
  const input =
    kind === 'prompt'
      ? parseAuthoringValue(updatePromptAuthoringSchema, rawInput)
      : parseAuthoringValue(updateComposerAuthoringSchema, rawInput);
  const identity = {
    actor: access.actor,
    operation: restoreIdentity?.operation ?? `update_${kind}`,
    requestKey: input.requestKey,
    requestHash:
      restoreIdentity?.requestHash ??
      (await canonicalAuthoringRequestHash({
        operation: `update_${kind}`,
        input,
      })),
  };
  const replay = await replayResult(db, identity);
  if (replay) return replay;
  const organizationId = access.actor.organizationId;
  const current = await readDefinition(db, kind, organizationId, input.id);
  if (current.metadata.revision !== input.expectedRevision)
    return finish(
      db,
      principal,
      kind,
      'update',
      organizationId,
      input.id,
      input.expectedRevision,
      { status: 'not_admitted', currentRevision: current.metadata.revision },
    );
  const normalized = editDefinition(kind, current.definition, input.edit);
  const checked = await inspectDependencies(
    db,
    kind,
    organizationId,
    normalized,
  );
  const folderId =
    input.folderId === undefined ? current.metadata.folderId : input.folderId;
  const guards = [
    ...access.guards,
    ...(await getAuthoringPolicyGuards(
      db,
      organizationId,
      kind,
      'update',
      input.id,
    )),
    ...(await folderGuard(db, kind, organizationId, folderId)),
    ...(await nameGuard(
      db,
      kind,
      organizationId,
      input.id,
      normalized.definition.name,
    )),
    dependencyGuard(
      kind,
      organizationId,
      normalized.references,
      checked.dependencies,
      false,
    ),
  ];
  const result = await commitAuthoringMutation(db, {
    ...identity,
    target: {
      kind,
      documentId: input.id,
      expectedRevision: input.expectedRevision,
    },
    guards,
    prepare: ({ revision, changeId, now }) => {
      const clone = current.version.status === 'published';
      const version: AuthoringVersion = {
        id: clone ? nanoid() : current.version.id,
        status: 'draft',
        version: null,
        createdAt: clone ? now : current.version.createdAt,
        updatedAt: now,
        publishedAt: null,
      };
      return {
        writes: [
          {
            kind: 'update',
            table: kind,
            set: {
              name: normalized.definition.name,
              description: normalized.definition.description,
              folder_id: folderId,
              updated_at: now,
            },
            where: { sql: 'id = ?', values: [input.id] },
            expectedChanges: 1,
          },
          ...versionWrites(
            kind,
            normalized,
            version.id,
            input.id,
            access.actor.userId,
            now,
            clone,
          ),
        ],
        before: {
          definition: current.definition,
          folderId: current.metadata.folderId,
          version: current.version,
        },
        after: { definition: normalized.definition, folderId, version },
        versionId: version.id,
        result: mutationResult(
          kind,
          input.id,
          version,
          revision,
          changeId,
          checked.diagnostics,
          normalized.assignedIds,
        ),
        sideEffects: [
          { kind: 'notify_editors', payload: {} },
          { kind: 'invalidate_cache', payload: {} },
        ],
      };
    },
  });
  return finish(
    db,
    principal,
    kind,
    'update',
    organizationId,
    input.id,
    input.expectedRevision,
    result,
  );
};

const publishDocument = async (
  db: D1Database,
  principal: AuthoringPrincipal,
  kind: Kind,
  rawInput: PublishAuthoringInput,
) => {
  const access = await authorizeAuthoringAccess(db, principal, 'mcp:publish');
  const input = parseAuthoringValue(publishAuthoringSchema, rawInput);
  const identity = {
    actor: access.actor,
    operation: `publish_${kind}`,
    requestKey: input.requestKey,
    requestHash: await canonicalAuthoringRequestHash({
      operation: `publish_${kind}`,
      input,
    }),
  };
  const replay = await replayResult(db, identity);
  if (replay) return replay;
  const organizationId = access.actor.organizationId;
  const current = await readDefinition(db, kind, organizationId, input.id);
  if (current.metadata.revision !== input.expectedRevision)
    return finish(
      db,
      principal,
      kind,
      'publish',
      organizationId,
      input.id,
      input.expectedRevision,
      { status: 'not_admitted', currentRevision: current.metadata.revision },
    );
  if (current.version.status !== 'draft')
    throw new AuthoringError(
      'publication_blocked',
      'There is no draft to publish.',
    );
  const normalized = normalize(kind, current.definition);
  const checked = await inspectDependencies(
    db,
    kind,
    organizationId,
    normalized,
  );
  if (checked.diagnostics.some((diagnostic) => diagnostic.severity === 'error'))
    throw new AuthoringError(
      'publication_blocked',
      'Resolve publication diagnostics before publishing this draft.',
      checked.diagnostics,
    );
  let latest = null;
  try {
    latest = await readDefinition(db, kind, organizationId, input.id, 'latest');
  } catch (error) {
    if (
      !(error instanceof AuthoringError && error.code === 'version_not_found')
    )
      throw error;
  }
  const selected = selectAuthoringPublishVersion({
    currentSchema: normalized.definition.config.schema,
    latestPublished: latest?.version.version
      ? {
          version: latest.version.version,
          schema: latest.definition.config.schema,
        }
      : null,
    override: input.version,
  });
  const published =
    kind === 'prompt'
      ? normalize('prompt', {
          ...normalized.definition,
          snippets: (normalized.definition as PromptDefinition).snippets.map(
            (ref, index) => ({
              ...ref,
              snippetVersionId: checked.dependencies[index].resolvedVersionId,
            }),
          ),
        })
      : normalized;
  const guards = [
    ...access.guards,
    ...(await getAuthoringPolicyGuards(
      db,
      organizationId,
      kind,
      'publish',
      input.id,
    )),
    dependencyGuard(
      kind,
      organizationId,
      normalized.references,
      checked.dependencies,
      true,
    ),
    ...(checked.expandedSnippetDependencies.length
      ? [
          dependencyGuard(
            'prompt',
            organizationId,
            checked.expandedSnippetDependencies.map((dependency) => ({
              id: dependency.id,
              pinnedVersionId: dependency.pinnedVersionId,
            })),
            checked.expandedSnippetDependencies,
            true,
          ),
        ]
      : []),
  ];
  const result = await commitAuthoringMutation(db, {
    ...identity,
    target: {
      kind,
      documentId: input.id,
      expectedRevision: input.expectedRevision,
    },
    guards,
    prepare: ({ revision, changeId, now }) => {
      const version: AuthoringVersion = {
        ...current.version,
        status: 'published',
        version: selected.version,
        updatedAt: now,
        publishedAt: now,
      };
      return {
        writes: [
          ...versionWrites(
            kind,
            published,
            version.id,
            input.id,
            access.actor.userId,
            now,
            false,
          ),
          {
            kind: 'update',
            table: kind === 'prompt' ? 'prompt_version' : 'composer_version',
            set: {
              major: selected.major,
              minor: selected.minor,
              patch: selected.patch,
              published_at: now,
              published_by: access.actor.userId,
            },
            where: {
              sql: 'id = ? AND published_at IS NULL',
              values: [version.id],
            },
            expectedChanges: 1,
          },
          {
            kind: 'update',
            table: kind,
            set: { updated_at: now },
            where: { sql: 'id = ?', values: [input.id] },
            expectedChanges: 1,
          },
        ],
        before: {
          definition: current.definition,
          folderId: current.metadata.folderId,
          version: current.version,
        },
        after: {
          definition: published.definition,
          folderId: current.metadata.folderId,
          version,
        },
        versionId: version.id,
        result: mutationResult(
          kind,
          input.id,
          version,
          revision,
          changeId,
          checked.diagnostics,
          [],
        ),
        sideEffects: [
          { kind: 'notify_editors', payload: {} },
          {
            kind: 'invalidate_cache',
            payload: {
              publishedVersion: selected.version,
            },
          },
        ],
      };
    },
  });
  return finish(
    db,
    principal,
    kind,
    'publish',
    organizationId,
    input.id,
    input.expectedRevision,
    result,
  );
};

export const createPrompt = (
  db: D1Database,
  principal: AuthoringPrincipal,
  input: CreatePromptAuthoringInput,
) => createDocument(db, principal, 'prompt', input);
export const createComposer = (
  db: D1Database,
  principal: AuthoringPrincipal,
  input: CreateComposerAuthoringInput,
) => createDocument(db, principal, 'composer', input);
export const updatePrompt = (
  db: D1Database,
  principal: AuthoringPrincipal,
  input: UpdatePromptAuthoringInput,
) => updateDocument(db, principal, 'prompt', input);
export const updateComposer = (
  db: D1Database,
  principal: AuthoringPrincipal,
  input: UpdateComposerAuthoringInput,
) => updateDocument(db, principal, 'composer', input);

export const restoreAuthoringChange = async (
  db: D1Database,
  principal: AuthoringPrincipal,
  rawInput: RestoreAuthoringChangeInput,
) => {
  const access = await authorizeAuthoringAccess(db, principal, 'mcp:write');
  const input = parseAuthoringValue(restoreAuthoringChangeSchema, rawInput);
  const operation = `restore_${input.kind}`;
  const requestHash = await canonicalAuthoringRequestHash({ operation, input });
  const replay = await replayResult(db, {
    actor: access.actor,
    operation,
    requestKey: input.requestKey,
    requestHash,
  });
  if (replay) return replay;
  const history = await getAuthoringChange(db, principal, {
    changeId: input.changeId,
  });
  if (
    history.change.document.kind !== input.kind ||
    history.change.document.id !== input.id
  )
    throw new AuthoringError(
      'invalid_input',
      'The selected history entry belongs to a different document.',
    );
  const snapshot = history[input.phase];
  if (!snapshot)
    throw new AuthoringError(
      'invalid_input',
      'This history entry has no earlier state to restore.',
    );
  return updateDocument(
    db,
    principal,
    input.kind,
    {
      id: input.id,
      expectedRevision: input.expectedRevision,
      requestKey: input.requestKey,
      edit: { mode: 'replace', definition: snapshot.definition },
      folderId: snapshot.folderId,
    },
    { operation, requestHash },
  );
};
export const publishPrompt = (
  db: D1Database,
  principal: AuthoringPrincipal,
  input: PublishAuthoringInput,
) => publishDocument(db, principal, 'prompt', input);
export const publishComposer = (
  db: D1Database,
  principal: AuthoringPrincipal,
  input: PublishAuthoringInput,
) => publishDocument(db, principal, 'composer', input);

const softDeleteDocument = async (
  db: D1Database,
  principal: AuthoringPrincipal,
  kind: Kind,
  rawInput: DeleteAuthoringInput,
) => {
  if (principal.source !== 'browser')
    throw new AuthoringError(
      'access_denied',
      'Deletion is available only in the Promptly browser UI.',
    );
  const access = await authorizeAuthoringAccess(db, principal, 'mcp:write');
  const owner: AuthoringCommitPredicate = {
    sql: `EXISTS (SELECT 1 FROM member WHERE user_id = ? AND organization_id = ? AND role = 'owner')`,
    values: [principal.userId, principal.organizationId],
  };
  if (
    (await db
      .prepare(`SELECT (${owner.sql}) AS allowed`)
      .bind(...(owner.values ?? []))
      .first('allowed')) !== 1
  ) {
    throw new AuthoringError(
      'access_denied',
      `Only workspace owners can delete ${kind}s.`,
    );
  }
  const input = parseAuthoringValue(deleteAuthoringSchema, rawInput);
  const identity = {
    actor: access.actor,
    operation: `delete_${kind}`,
    requestKey: input.requestKey,
    requestHash: await canonicalAuthoringRequestHash({
      operation: `delete_${kind}`,
      input,
    }),
  };
  const replay = await replayResult(db, identity);
  if (replay) return { ...replay, deleted: true as const };
  const current = await readDefinition(
    db,
    kind,
    principal.organizationId,
    input.id,
  );
  if (current.metadata.revision !== input.expectedRevision)
    throw new AuthoringError(
      'stale_revision',
      'This document changed. Read it before deciding whether to delete it.',
      [],
      { currentRevision: current.metadata.revision },
    );
  const unused: AuthoringCommitPredicate = {
    sql: `NOT EXISTS (SELECT 1 FROM composer_version_prompt refs
      JOIN composer_version v ON v.id = refs.composer_version_id
      JOIN composer c ON c.id = v.composer_id WHERE refs.prompt_id = ? AND c.deleted_at IS NULL)`,
    values: [input.id],
  };
  if (
    kind === 'prompt' &&
    (await db
      .prepare(`SELECT (${unused.sql}) AS allowed`)
      .bind(input.id)
      .first('allowed')) !== 1
  ) {
    throw new AuthoringError(
      'content_in_use',
      'Cannot delete a prompt referenced by an active composer.',
    );
  }
  const result = await commitAuthoringMutation(db, {
    ...identity,
    target: {
      kind,
      documentId: input.id,
      expectedRevision: input.expectedRevision,
    },
    guards: [...access.guards, owner, ...(kind === 'prompt' ? [unused] : [])],
    prepare: ({ revision, changeId, now }) => {
      const snapshot = {
        definition: current.definition,
        folderId: current.metadata.folderId,
        version: current.version,
      };
      return {
        writes: [
          {
            kind: 'update',
            table: kind,
            set: { deleted_at: now, updated_at: now },
            where: { sql: 'id = ?', values: [input.id] },
            expectedChanges: 1,
          },
        ],
        before: snapshot,
        after: snapshot,
        versionId: current.version.id,
        result: {
          ...mutationResult(
            kind,
            input.id,
            current.version,
            revision,
            changeId,
            [],
            [],
          ),
          deleted: true as const,
        },
        sideEffects: [
          { kind: 'notify_editors', payload: {} },
          { kind: 'invalidate_cache', payload: { allVersions: true } },
        ],
      };
    },
  });
  if (result.status === 'committed' || result.status === 'replayed')
    return { ...result.result, deleted: true as const };
  if (result.status === 'key_conflict')
    throw new AuthoringError(
      'idempotency_conflict',
      'This request key was already used with different input.',
    );
  await authorizeAuthoringAccess(db, principal, 'mcp:write');
  if (result.currentRevision !== input.expectedRevision)
    throw new AuthoringError(
      'stale_revision',
      'This document changed before deletion.',
      [],
      { currentRevision: result.currentRevision },
    );
  throw new AuthoringError(
    'policy_changed',
    'Workspace ownership or references changed before deletion. Read current state and retry.',
  );
};

export const softDeletePrompt = (
  db: D1Database,
  principal: AuthoringPrincipal,
  input: DeleteAuthoringInput,
) => softDeleteDocument(db, principal, 'prompt', input);
export const softDeleteComposer = (
  db: D1Database,
  principal: AuthoringPrincipal,
  input: DeleteAuthoringInput,
) => softDeleteDocument(db, principal, 'composer', input);
