import type { PromptDefinition } from '../validations/authoring';
import { getPrompt } from './reads.server';
import {
  type AuthoringDependency,
  type AuthoringDiagnostic,
  AuthoringError,
} from './types';

export const AUTHORING_DEPENDENCY_MAX_BYTES = 2_097_152;
export const AUTHORING_EXPANDED_SNIPPET_LIMIT = 200;
type DependencyBudget = { bytes: number; references: number };
export type ComposerPromptDependency = {
  promptId: string;
  definition: PromptDefinition;
  dependencies: AuthoringDependency[];
  diagnostics: AuthoringDiagnostic[];
  snippets: { snippetId: string; content: string }[];
};
const exceeded = () =>
  new AuthoringError(
    'payload_too_large',
    'Resolved dependencies exceed the 2 MiB authoring limit. Work with fewer or smaller referenced definitions.',
  );
const consume = (budget: DependencyBudget, bytes: number) => {
  budget.bytes += bytes;
  if (budget.bytes > AUTHORING_DEPENDENCY_MAX_BYTES) throw exceeded();
};

export const loadAuthoringSnippetContents = async (
  db: D1Database,
  organizationId: string,
  dependencies: readonly AuthoringDependency[],
  budget: DependencyBudget = { bytes: 0, references: 0 },
) => {
  budget.references += dependencies.length;
  if (budget.references > AUTHORING_EXPANDED_SNIPPET_LIMIT)
    throw new AuthoringError(
      'payload_too_large',
      'Composer authoring can expand at most 200 snippet references. Work with its prompts individually.',
    );
  const selected = dependencies
    .filter(
      (dependency) =>
        dependency.kind === 'snippet' && dependency.resolvedVersionId !== null,
    )
    .map((dependency) => ({
      id: dependency.id,
      versionId: dependency.resolvedVersionId,
    }));
  if (!selected.length) return [];
  const encoded = JSON.stringify(selected);
  const from = `FROM json_each(?) ref
    JOIN snippet s ON s.id = json_extract(ref.value,'$.id') AND s.organization_id = ? AND s.deleted_at IS NULL
    JOIN snippet_version v ON v.snippet_id = s.id AND v.id = json_extract(ref.value,'$.versionId') AND v.published_at IS NOT NULL`;
  const session = db.withSession('first-primary');
  const size = await session
    .prepare(
      `SELECT COUNT(*) AS count, COALESCE(SUM(length(CAST(v.content AS BLOB))),0) AS bytes ${from}`,
    )
    .bind(encoded, organizationId)
    .first<{ count: number; bytes: number }>();
  if (size?.count !== selected.length)
    throw new AuthoringError(
      'reference_unavailable',
      'A snippet changed or became unavailable. Read the document again.',
    );
  if (size.bytes > 524_288)
    throw new AuthoringError(
      'payload_too_large',
      'Resolved snippet content exceeds the 512 KiB authoring limit.',
    );
  consume(budget, size.bytes);
  const result = await session
    .prepare(
      `SELECT s.id AS snippetId, COALESCE(v.content,'') AS content ${from} ORDER BY CAST(ref.key AS INTEGER)`,
    )
    .bind(encoded, organizationId)
    .all<{ snippetId: string; content: string }>();
  if (result.results.length !== selected.length)
    throw new AuthoringError(
      'reference_unavailable',
      'A snippet changed or became unavailable. Read the document again.',
    );
  return result.results;
};

export const loadComposerPromptDependencies = async (
  db: D1Database,
  organizationId: string,
  dependencies: readonly AuthoringDependency[],
): Promise<ComposerPromptDependency[]> => {
  const selected = dependencies
    .filter((dependency) => dependency.resolvedVersionId !== null)
    .map((dependency) => ({
      id: dependency.id,
      versionId: dependency.resolvedVersionId,
    }));
  if (!selected.length) return [];
  const size = await db
    .withSession('first-primary')
    .prepare(`SELECT COUNT(*) AS count,
    COALESCE(SUM(length(CAST(p.name AS BLOB)) + length(CAST(p.description AS BLOB))
      + length(CAST(COALESCE(v.system_message,'') AS BLOB)) + length(CAST(COALESCE(v.user_message,'') AS BLOB))
      + length(CAST(COALESCE(v.config,'{}') AS BLOB)) + length(CAST(COALESCE(v.labels,'') AS BLOB))),0) AS bytes
    FROM json_each(?) ref JOIN prompt p ON p.id = json_extract(ref.value,'$.id') AND p.organization_id = ? AND p.deleted_at IS NULL
    JOIN prompt_version v ON v.prompt_id = p.id AND v.id = json_extract(ref.value,'$.versionId') AND v.published_at IS NOT NULL`)
    .bind(JSON.stringify(selected), organizationId)
    .first<{ count: number; bytes: number }>();
  if (size?.count !== selected.length)
    throw new AuthoringError(
      'reference_unavailable',
      'A referenced prompt changed or became unavailable. Read the composer again.',
    );
  if (size.bytes > AUTHORING_DEPENDENCY_MAX_BYTES) throw exceeded();
  const budget = { bytes: 0, references: 0 };
  const prompts: ComposerPromptDependency[] = [];
  for (const dependency of selected) {
    const prompt = await getPrompt(db, {
      organizationId,
      id: dependency.id,
      version: { kind: 'published', versionId: dependency.versionId ?? '' },
    });
    consume(
      budget,
      new TextEncoder().encode(JSON.stringify(prompt.definition)).length,
    );
    const snippets = await loadAuthoringSnippetContents(
      db,
      organizationId,
      prompt.dependencies,
      budget,
    );
    prompts.push({
      promptId: dependency.id,
      definition: prompt.definition,
      dependencies: prompt.dependencies,
      diagnostics: prompt.diagnostics,
      snippets,
    });
  }
  return prompts;
};
