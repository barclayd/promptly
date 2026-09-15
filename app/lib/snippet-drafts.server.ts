import { nanoid } from 'nanoid';
import { AuthoringError } from './authoring/types';

type SnippetActor = {
  snippetId: string;
  organizationId: string;
  userId: string;
};
type SnippetDraftWrite = SnippetActor &
  ({ field: 'content'; value: string } | { field: 'config'; value: string });
type SnippetPublication = SnippetActor & {
  major: number;
  minor: number;
  patch: number;
};
type SnippetState = {
  id: string;
  drafts: number;
  draft_id: string | null;
  major: number | null;
  minor: number | null;
  patch: number | null;
};

const access = `s.id = ? AND s.organization_id = ? AND s.deleted_at IS NULL
  AND (SELECT COUNT(*) FROM member WHERE user_id = ? AND organization_id = s.organization_id) = 1
  AND EXISTS (SELECT 1 FROM member WHERE user_id = ? AND organization_id = s.organization_id AND role IN ('owner', 'admin', 'member'))`;
const accessValues = (input: SnippetActor) => [
  input.snippetId,
  input.organizationId,
  input.userId,
  input.userId,
];
const latestVersion =
  'SELECT id FROM snippet_version WHERE snippet_id = s.id AND published_at IS NOT NULL ORDER BY major DESC, minor DESC, patch DESC, id ASC LIMIT 1';
const stateQuery = (db: D1DatabaseSession, input: SnippetActor) =>
  db
    .prepare(`SELECT s.id,
  (SELECT COUNT(*) FROM snippet_version WHERE snippet_id = s.id AND published_at IS NULL) AS drafts,
  (SELECT id FROM snippet_version WHERE snippet_id = s.id AND published_at IS NULL LIMIT 1) AS draft_id,
  v.major, v.minor, v.patch FROM snippet s LEFT JOIN snippet_version v ON v.id = (${latestVersion}) WHERE ${access}`)
    .bind(...accessValues(input));
const requireState = (state: SnippetState | undefined) => {
  if (!state)
    throw new AuthoringError(
      'content_not_found',
      'Snippet not found in this workspace.',
    );
  if (state.drafts > 1)
    throw new AuthoringError(
      'invalid_input',
      'This snippet has multiple drafts and needs repair before it can be saved or published.',
    );
  return state;
};

export const saveSnippetDraft = async (
  db: D1Database,
  input: SnippetDraftWrite,
) => {
  const session = db.withSession('first-primary');
  const now = Date.now();
  const statements = [
    session
      .prepare(`INSERT INTO snippet_version
      (id, snippet_id, content, config, labels, created_by, created_at, updated_at, updated_by)
      SELECT ?, s.id, COALESCE(v.content, ''), COALESCE(v.config, '{}'), v.labels, ?, ?, ?, ?
      FROM snippet s LEFT JOIN snippet_version v ON v.id = (${latestVersion}) WHERE ${access}
      AND NOT EXISTS (SELECT 1 FROM snippet_version WHERE snippet_id = s.id AND published_at IS NULL)`)
      .bind(
        nanoid(),
        input.userId,
        now,
        now,
        input.userId,
        ...accessValues(input),
      ),
    session
      .prepare(`UPDATE snippet_version SET ${input.field === 'content' ? 'content' : 'config'} = ?, updated_at = ?, updated_by = ?
      WHERE snippet_id = ? AND published_at IS NULL
      AND (SELECT COUNT(*) FROM snippet_version WHERE snippet_id = ? AND published_at IS NULL) = 1
      AND EXISTS (SELECT 1 FROM snippet s WHERE ${access})`)
      .bind(
        input.value,
        now,
        input.userId,
        input.snippetId,
        input.snippetId,
        ...accessValues(input),
      ),
    session
      .prepare(
        `UPDATE snippet SET updated_at = ? WHERE id = ? AND changes() = 1`,
      )
      .bind(now, input.snippetId),
    stateQuery(session, input),
  ];
  const results = await session.batch(statements);
  const state = requireState(
    results.at(-1)?.results[0] as SnippetState | undefined,
  );
  if (!state.draft_id)
    throw new AuthoringError(
      'policy_changed',
      'The snippet draft could not be saved. Read its current state and retry.',
    );
  return { versionId: state.draft_id, savedAt: now };
};

export const publishSnippetDraft = async (
  db: D1Database,
  input: SnippetPublication,
) => {
  if (
    ![input.major, input.minor, input.patch].every(
      (part) => Number.isSafeInteger(part) && part >= 0,
    )
  )
    throw new AuthoringError(
      'invalid_input',
      'Version parts must be nonnegative safe integers.',
    );
  const session = db.withSession('first-primary');
  const now = Date.now();
  const results = await session.batch([
    session
      .prepare(`UPDATE snippet_version SET major = ?, minor = ?, patch = ?, published_at = ?, published_by = ?, updated_at = ?, updated_by = ?
      WHERE snippet_id = ? AND published_at IS NULL
      AND (SELECT COUNT(*) FROM snippet_version WHERE snippet_id = ? AND published_at IS NULL) = 1
      AND EXISTS (SELECT 1 FROM snippet s WHERE ${access})
      AND NOT EXISTS (SELECT 1 FROM snippet_version published WHERE published.snippet_id = ? AND published.published_at IS NOT NULL
        AND (published.major > ? OR (published.major = ? AND published.minor > ?)
          OR (published.major = ? AND published.minor = ? AND published.patch >= ?)))
      RETURNING id`)
      .bind(
        input.major,
        input.minor,
        input.patch,
        now,
        input.userId,
        now,
        input.userId,
        input.snippetId,
        input.snippetId,
        ...accessValues(input),
        input.snippetId,
        input.major,
        input.major,
        input.minor,
        input.major,
        input.minor,
        input.patch,
      ),
    session
      .prepare(
        'UPDATE snippet SET updated_at = ? WHERE id = ? AND changes() = 1',
      )
      .bind(now, input.snippetId),
    stateQuery(session, input),
  ]);
  const state = requireState(
    results.at(-1)?.results[0] as SnippetState | undefined,
  );
  const published = results[0].results[0] as { id: string } | undefined;
  if (published)
    return {
      versionId: published.id,
      version: `${input.major}.${input.minor}.${input.patch}`,
    };
  if (state.major !== null)
    throw new AuthoringError(
      'publication_blocked',
      `Version must be greater than ${state.major}.${state.minor}.${state.patch}, and a draft must be available.`,
    );
  throw new AuthoringError(
    'publication_blocked',
    'No draft version to publish.',
  );
};
