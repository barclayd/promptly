import { getModelPricing, getProviderFromModelId } from '../model-pricing';
import {
  type AuthoringContentKind,
  type AuthoringListModelsInput,
  type AuthoringListVersionsInput,
  type AuthoringReadInput,
  authoringContentKindSchema,
  authoringListModelsInputSchema,
  authoringListVersionsInputSchema,
  authoringReadInputSchema,
  type ComposerDefinition,
  type ComposerPromptReference,
  type PromptDefinition,
  type SnippetDefinition,
} from '../validations/authoring';
import {
  parseAuthoringValue,
  parseComposerDefinition,
  parsePromptDefinition,
  parseSnippetDefinition,
} from './normalize';
import {
  type AuthoringDefinitionReadResult,
  type AuthoringDependency,
  type AuthoringDiagnostic,
  AuthoringError,
  type AuthoringMetadata,
  type AuthoringModel,
  type AuthoringPage,
  type AuthoringReadResult,
  type AuthoringVersion,
} from './types';

const tables = {
  prompt: { item: 'prompt', version: 'prompt_version', parentId: 'prompt_id' },
  composer: {
    item: 'composer',
    version: 'composer_version',
    parentId: 'composer_id',
  },
  snippet: {
    item: 'snippet',
    version: 'snippet_version',
    parentId: 'snippet_id',
  },
} as const;

type ParentRow = {
  id: string;
  organization_id: string;
  name: string;
  description: string;
  folder_id: string | null;
  revision?: string;
};

type VersionRow = {
  id: string;
  config: string;
  labels: string | null;
  major: number | null;
  minor: number | null;
  patch: number | null;
  created_at: number;
  updated_at: number | null;
  published_at: number | null;
  system_message?: string | null;
  user_message?: string | null;
  content?: string | null;
};

type ReferenceRow = {
  target_id: string;
  pinned_id: string | null;
  sort_order: number;
  auto_update: number;
};

const selectedVersion = (
  kind: AuthoringContentKind,
  input: AuthoringReadInput,
) => {
  const table = tables[kind];
  const selector = input.version;
  let filter = '1 = 1';
  const bindings: (string | number)[] = [input.organizationId, input.id];
  if (selector.kind === 'draft') filter = 'v.published_at IS NULL';
  if (selector.kind === 'latest') filter = 'v.published_at IS NOT NULL';
  if (selector.kind === 'published') {
    if ('versionId' in selector) {
      filter = 'v.published_at IS NOT NULL AND v.id = ?';
      bindings.push(selector.versionId);
    } else {
      filter =
        'v.published_at IS NOT NULL AND v.major = ? AND v.minor = ? AND v.patch = ?';
      bindings.push(...selector.version.split('.').map(Number));
    }
  }
  return {
    from: `FROM ${table.version} v JOIN ${table.item} p ON p.id = v.${table.parentId}
      WHERE p.organization_id = ? AND p.id = ? AND p.deleted_at IS NULL AND ${filter}`,
    order:
      'ORDER BY (v.published_at IS NULL) DESC, v.major DESC, v.minor DESC, v.patch DESC, v.created_at DESC, v.id ASC',
    bindings,
  };
};

const toVersion = (row: VersionRow): AuthoringVersion => {
  if (
    row.published_at !== null &&
    [row.major, row.minor, row.patch].some(
      (part) => part === null || !Number.isSafeInteger(part) || part < 0,
    )
  ) {
    throw new AuthoringError(
      'invalid_stored_definition',
      'Published version metadata is invalid.',
    );
  }
  return {
    id: row.id,
    status: row.published_at === null ? 'draft' : 'published',
    version:
      row.published_at === null
        ? null
        : `${row.major}.${row.minor}.${row.patch}`,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    publishedAt: row.published_at,
  };
};

const readSnapshot = async (
  db: D1Database,
  kind: AuthoringContentKind,
  rawInput: AuthoringReadInput,
) => {
  const input = parseAuthoringValue(authoringReadInputSchema, rawInput);
  const table = tables[kind];
  const selected = selectedVersion(kind, input);
  const versionFields = `v.id, v.config, v.labels, v.major, v.minor, v.patch, v.created_at, v.updated_at, v.published_at,
    ${kind === 'prompt' ? 'v.system_message, v.user_message' : 'v.content'}`;
  const session = db.withSession('first-primary');
  const parentStatement = session
    .prepare(
      `SELECT p.* FROM ${table.item} p WHERE p.id = ? AND p.organization_id = ? AND p.deleted_at IS NULL`,
    )
    .bind(input.id, input.organizationId);
  const versionStatement = session
    .prepare(
      `SELECT ${versionFields} ${selected.from} ${selected.order} LIMIT 2`,
    )
    .bind(...selected.bindings);
  const referenceStatement =
    kind === 'prompt'
      ? session
          .prepare(`SELECT snippet_id AS target_id, snippet_version_id AS pinned_id, sort_order, 0 AS auto_update FROM prompt_version_snippet
        WHERE prompt_version_id = (SELECT v.id ${selected.from} ${selected.order} LIMIT 1) ORDER BY sort_order, snippet_id`)
          .bind(...selected.bindings)
      : kind === 'composer'
        ? session
            .prepare(`SELECT prompt_id AS target_id, prompt_version_id AS pinned_id, 0 AS sort_order, auto_update FROM composer_version_prompt
          WHERE composer_version_id = (SELECT v.id ${selected.from} ${selected.order} LIMIT 1) ORDER BY prompt_id`)
            .bind(...selected.bindings)
        : session.prepare('SELECT NULL AS target_id WHERE 0');
  const result = await session.batch<ParentRow | VersionRow | ReferenceRow>([
    parentStatement,
    versionStatement,
    referenceStatement,
  ]);
  const parent = result[0].results[0];
  if (!parent || !('organization_id' in parent))
    throw new AuthoringError(
      'content_not_found',
      'Content not found in this workspace.',
    );
  const versions = result[1].results.filter(
    (row): row is VersionRow => 'published_at' in row,
  );
  const version = versions[0];
  if (!version)
    throw new AuthoringError(
      'version_not_found',
      'The requested version does not exist.',
    );
  if (versions.filter((row) => row.published_at === null).length > 1)
    throw new AuthoringError(
      'duplicate_drafts',
      'This item has multiple drafts and requires repair before authoring.',
    );
  const metadata: AuthoringMetadata = {
    id: parent.id,
    organizationId: parent.organization_id,
    kind,
    folderId: parent.folder_id,
    revision: parent.revision ?? null,
  };
  let config: unknown;
  try {
    config = JSON.parse(version.config);
  } catch {
    throw new AuthoringError(
      'invalid_stored_definition',
      'Stored configuration is not valid JSON.',
    );
  }
  return {
    session,
    metadata,
    version: toVersion(version),
    row: version,
    definition: {
      name: parent.name,
      description: parent.description,
      labels: version.labels,
      config,
    },
    references: result[2].results.filter(
      (row): row is ReferenceRow => 'target_id' in row,
    ),
  };
};

const storedDefinition = <T>(read: () => T): T => {
  try {
    return read();
  } catch (error) {
    if (error instanceof AuthoringError && error.code === 'invalid_input') {
      throw new AuthoringError(
        'invalid_stored_definition',
        'Stored definition requires repair before authoring.',
        error.diagnostics,
      );
    }
    throw error;
  }
};

type DependencyReference = { id: string; pinnedVersionId: string | null };
type DependencyRow = {
  position: number;
  id: string | null;
  name: string | null;
  resolved_id: string | null;
  major: number | null;
  minor: number | null;
  patch: number | null;
  published_at: number | null;
};

const readDependencyRows = async (
  session: D1DatabaseSession,
  organizationId: string,
  kind: 'prompt' | 'snippet',
  references: DependencyReference[],
): Promise<DependencyRow[]> => {
  if (!references.length) return [];
  const table = tables[kind];
  const result = await session
    .prepare(`
    SELECT requested.key AS position, p.id, substr(p.name, 1, 200) AS name, v.id AS resolved_id, v.major, v.minor, v.patch, v.published_at
    FROM json_each(?) requested
    LEFT JOIN ${table.item} p ON p.id = json_extract(requested.value, '$.id') AND p.organization_id = ? AND p.deleted_at IS NULL
    LEFT JOIN ${table.version} v ON v.${table.parentId} = p.id
      AND v.id = COALESCE(json_extract(requested.value, '$.pinnedVersionId'),
        (SELECT candidate.id FROM ${table.version} candidate WHERE candidate.${table.parentId} = p.id AND candidate.published_at IS NOT NULL
         ORDER BY candidate.major DESC, candidate.minor DESC, candidate.patch DESC, candidate.id ASC LIMIT 1))
    ORDER BY CAST(requested.key AS INTEGER)`)
    .bind(JSON.stringify(references), organizationId)
    .all<DependencyRow>();
  return result.results;
};

const resolvedDependency = (
  kind: 'prompt' | 'snippet',
  reference: DependencyReference,
  row: DependencyRow | undefined,
  index: number,
): AuthoringDependency => {
  if (
    !row?.id ||
    row.name === null ||
    (reference.pinnedVersionId !== null &&
      (!row.resolved_id || row.published_at === null))
  ) {
    throw new AuthoringError(
      'reference_unavailable',
      'A referenced item or published version is unavailable in this workspace.',
      [
        {
          code: 'reference_unavailable',
          severity: 'error',
          path: ['references', index],
          message:
            'Choose an accessible item and a published version belonging to it.',
        },
      ],
    );
  }
  if (
    row.resolved_id &&
    [row.major, row.minor, row.patch].some(
      (part) => part === null || !Number.isSafeInteger(part) || part < 0,
    )
  ) {
    throw new AuthoringError(
      'invalid_stored_definition',
      'A referenced publication has invalid version metadata.',
    );
  }
  return {
    kind,
    id: row.id,
    name: row.name,
    pinnedVersionId: reference.pinnedVersionId,
    resolvedVersionId: row.resolved_id,
    resolvedVersion: row.resolved_id
      ? `${row.major}.${row.minor}.${row.patch}`
      : null,
  };
};

/** Strict resolver for mutations: inaccessible targets/pins always reject. */
export const resolveAuthoringDependencies = async (
  session: D1DatabaseSession,
  organizationId: string,
  kind: 'prompt' | 'snippet',
  references: DependencyReference[],
): Promise<AuthoringDependency[]> => {
  const rows = await readDependencyRows(
    session,
    organizationId,
    kind,
    references,
  );
  return references.map((reference, index) =>
    resolvedDependency(kind, reference, rows[index], index),
  );
};

const missingPublicationDiagnostics = (dependencies: AuthoringDependency[]) =>
  dependencies.flatMap((dependency, index) =>
    dependency.resolvedVersionId === null
      ? [
          {
            code: 'missing_published_dependency',
            severity: 'error' as const,
            path: ['references', index],
            message: 'Publish this dependency before publishing the document.',
          },
        ]
      : [],
  );

/** Inspection preserves the owned definition without resolving unavailable
 * target metadata. IDs/labels already in the definition are saved content,
 * not evidence that the target exists or belongs to this workspace. */
const inspectAuthoringDependencies = async (
  session: D1DatabaseSession,
  organizationId: string,
  kind: 'prompt' | 'snippet',
  references: DependencyReference[],
) => {
  const rows = await readDependencyRows(
    session,
    organizationId,
    kind,
    references,
  );
  const dependencies: AuthoringDependency[] = [];
  const diagnostics: AuthoringDiagnostic[] = [];
  for (const [index, reference] of references.entries()) {
    try {
      const dependency = resolvedDependency(
        kind,
        reference,
        rows[index],
        index,
      );
      dependencies.push(dependency);
      diagnostics.push(
        ...missingPublicationDiagnostics([dependency]).map((diagnostic) => ({
          ...diagnostic,
          path: ['references', index],
        })),
      );
    } catch (error) {
      if (!(error instanceof AuthoringError)) throw error;
      diagnostics.push({
        code: error.code,
        severity: 'error',
        path: ['references', index],
        message:
          error.code === 'reference_unavailable'
            ? 'This saved reference cannot be resolved in this workspace. Remove it or choose an accessible item and publication.'
            : 'This saved reference has invalid publication metadata. Choose a valid publication or remove the reference.',
      });
    }
  }
  return { dependencies, diagnostics };
};

export const readPromptDefinition = async (
  db: D1Database,
  input: AuthoringReadInput,
): Promise<AuthoringDefinitionReadResult<PromptDefinition>> => {
  const snapshot = await readSnapshot(db, 'prompt', input);
  const parsed = storedDefinition(() =>
    parsePromptDefinition({
      ...snapshot.definition,
      systemMessage: snapshot.row.system_message ?? '',
      userMessage: snapshot.row.user_message ?? '',
      snippets: snapshot.references.map((ref) => ({
        snippetId: ref.target_id,
        snippetVersionId: ref.pinned_id,
        sortOrder: ref.sort_order,
      })),
    }),
  );
  return {
    session: snapshot.session,
    metadata: snapshot.metadata,
    version: snapshot.version,
    definition: parsed.definition,
    diagnostics: parsed.diagnostics,
  };
};

export const getPrompt = async (
  db: D1Database,
  input: AuthoringReadInput,
): Promise<AuthoringReadResult<PromptDefinition>> => {
  const snapshot = await readPromptDefinition(db, input);
  const resolved = await inspectAuthoringDependencies(
    snapshot.session,
    input.organizationId,
    'snippet',
    snapshot.definition.snippets.map((ref) => ({
      id: ref.snippetId,
      pinnedVersionId: ref.snippetVersionId,
    })),
  );
  return {
    metadata: snapshot.metadata,
    version: snapshot.version,
    definition: snapshot.definition,
    dependencies: resolved.dependencies,
    diagnostics: [...snapshot.diagnostics, ...resolved.diagnostics],
  };
};

export const readComposerDefinition = async (
  db: D1Database,
  input: AuthoringReadInput,
): Promise<
  AuthoringDefinitionReadResult<ComposerDefinition> & {
    promptReferences: ComposerPromptReference[];
    storedReferences: ComposerPromptReference[];
  }
> => {
  const snapshot = await readSnapshot(db, 'composer', input);
  const parsed = storedDefinition(() =>
    parseComposerDefinition({
      ...snapshot.definition,
      content: snapshot.row.content ?? '',
    }),
  );
  return {
    session: snapshot.session,
    metadata: snapshot.metadata,
    version: snapshot.version,
    definition: parsed.definition,
    diagnostics: parsed.diagnostics,
    promptReferences: parsed.promptReferences,
    storedReferences: snapshot.references.map((reference) => ({
      promptId: reference.target_id,
      promptVersionId: reference.pinned_id,
      autoUpdate: Boolean(reference.auto_update),
    })),
  };
};

export const getComposer = async (
  db: D1Database,
  input: AuthoringReadInput,
): Promise<AuthoringReadResult<ComposerDefinition>> => {
  const snapshot = await readComposerDefinition(db, input);
  const resolved = await inspectAuthoringDependencies(
    snapshot.session,
    input.organizationId,
    'prompt',
    snapshot.promptReferences.map((ref) => ({
      id: ref.promptId,
      pinnedVersionId: ref.promptVersionId,
    })),
  );
  const stored = await inspectAuthoringDependencies(
    snapshot.session,
    input.organizationId,
    'prompt',
    snapshot.storedReferences.map((ref) => ({
      id: ref.promptId,
      pinnedVersionId: ref.promptVersionId,
    })),
  );
  const junctionMatches =
    snapshot.storedReferences.length === snapshot.promptReferences.length &&
    snapshot.promptReferences.every((ref) =>
      snapshot.storedReferences.some(
        (row) =>
          row.promptId === ref.promptId &&
          row.promptVersionId === ref.promptVersionId &&
          row.autoUpdate === ref.autoUpdate,
      ),
    );
  return {
    metadata: snapshot.metadata,
    version: snapshot.version,
    definition: snapshot.definition,
    dependencies: resolved.dependencies,
    diagnostics: [
      ...snapshot.diagnostics,
      ...resolved.diagnostics,
      ...stored.diagnostics.map((diagnostic) => ({
        ...diagnostic,
        path: ['storedReferences', ...diagnostic.path.slice(1)],
      })),
      ...(!junctionMatches
        ? [
            {
              code: 'reference_index_mismatch',
              severity: 'error' as const,
              path: ['content'],
              message:
                'Saved prompt references do not match the composer content; save through the authoring service to repair them.',
            },
          ]
        : []),
    ],
  };
};

export const getSnippet = async (
  db: D1Database,
  input: AuthoringReadInput,
): Promise<AuthoringReadResult<SnippetDefinition>> => {
  const snapshot = await readSnapshot(db, 'snippet', input);
  const definition = storedDefinition(() =>
    parseSnippetDefinition({
      ...snapshot.definition,
      content: snapshot.row.content ?? '',
    }),
  );
  return {
    metadata: snapshot.metadata,
    version: snapshot.version,
    definition,
    dependencies: [],
    diagnostics: [],
  };
};

export const listVersions = async (
  db: D1Database,
  rawInput: AuthoringListVersionsInput,
): Promise<AuthoringPage<AuthoringVersion>> => {
  const input = parseAuthoringValue(authoringListVersionsInputSchema, rawInput);
  const kind = parseAuthoringValue(authoringContentKindSchema, input.kind);
  const table = tables[kind];
  const session = db.withSession('first-primary');
  const result = await session.batch<ParentRow | VersionRow>([
    session
      .prepare(
        `SELECT id, organization_id FROM ${table.item} WHERE id = ? AND organization_id = ? AND deleted_at IS NULL`,
      )
      .bind(input.id, input.organizationId),
    session
      .prepare(`SELECT v.id, v.major, v.minor, v.patch, v.created_at, v.updated_at, v.published_at FROM ${table.version} v
      JOIN ${table.item} p ON p.id = v.${table.parentId}
      WHERE p.id = ? AND p.organization_id = ? AND p.deleted_at IS NULL
      ORDER BY (v.published_at IS NULL) DESC, v.major DESC, v.minor DESC, v.patch DESC, v.created_at DESC, v.id ASC LIMIT ? OFFSET ?`)
      .bind(input.id, input.organizationId, input.limit + 1, input.offset),
  ]);
  if (!result[0].results.length)
    throw new AuthoringError(
      'content_not_found',
      'Content not found in this workspace.',
    );
  const versions = result[1].results.filter(
    (row): row is VersionRow => 'published_at' in row,
  );
  return {
    items: versions.slice(0, input.limit).map(toVersion),
    nextOffset:
      versions.length > input.limit ? input.offset + input.limit : null,
  };
};

export const listAvailableModels = async (
  db: D1Database,
  rawInput: AuthoringListModelsInput,
): Promise<AuthoringPage<AuthoringModel>> => {
  const input = parseAuthoringValue(authoringListModelsInputSchema, rawInput);
  const result = await db
    .withSession('first-primary')
    .prepare(`
    SELECT DISTINCT model.value AS id FROM llm_api_key k, json_each(k.enabled_models) model
    WHERE k.organization_id = ? AND model.type = 'text'
    ORDER BY model.value COLLATE BINARY LIMIT ? OFFSET ?`)
    .bind(input.organizationId, input.limit + 1, input.offset)
    .all<{ id: string }>();
  return {
    items: result.results.slice(0, input.limit).map(({ id }) => ({
      id,
      displayName: getModelPricing(id)?.displayName ?? id,
      provider: getProviderFromModelId(id),
    })),
    nextOffset:
      result.results.length > input.limit ? input.offset + input.limit : null,
  };
};
