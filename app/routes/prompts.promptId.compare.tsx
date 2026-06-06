import { CompareScreen } from '~/components/compare/compare-screen';
import { orgContext } from '~/context';
import type { Route } from './+types/prompts.promptId.compare';

export type CompareVersionStatus = 'live' | 'published' | 'draft';

export type CompareVersion = {
  /** Value passed as `version` to /api/prompts/run: 'draft' or 'x.y.z' */
  key: string;
  /** Display label: 'vX.Y.Z' for published versions, 'Latest' for the draft */
  label: string;
  status: CompareVersionStatus;
  systemMessage: string;
  userMessage: string;
};

// biome-ignore lint/correctness/noEmptyPattern: react router default
export const meta = ({}: Route.MetaArgs) => {
  return [
    { title: 'Promptly — Compare versions' },
    {
      name: 'description',
      content: 'The CMS for building AI at scale',
    },
  ];
};

export const loader = async ({ params, context }: Route.LoaderArgs) => {
  const org = context.get(orgContext);
  if (!org) {
    throw new Response('Unauthorized', { status: 403 });
  }

  const { promptId } = params;
  const db = context.cloudflare.env.promptly;

  const prompt = await db
    .prepare(
      'SELECT id, name, folder_id FROM prompt WHERE id = ? AND organization_id = ?',
    )
    .bind(promptId, org.organizationId)
    .first<{ id: string; name: string; folder_id: string }>();

  if (!prompt) {
    throw new Response('Prompt not found', { status: 404 });
  }

  const folder = await db
    .prepare(
      'SELECT id, name FROM prompt_folder WHERE id = ? AND organization_id = ?',
    )
    .bind(prompt.folder_id, org.organizationId)
    .first<{ id: string; name: string }>();

  // All versions with content, reverse-chronological: draft (Latest) first,
  // then published newest → oldest, so the most recent versions lead the
  // chips row and the carousel.
  const versionsResult = await db
    .prepare(
      `SELECT major, minor, patch, system_message, user_message, config, published_at
       FROM prompt_version
       WHERE prompt_id = ?
       ORDER BY (published_at IS NULL) DESC, major DESC, minor DESC, patch DESC`,
    )
    .bind(promptId)
    .all<{
      major: number | null;
      minor: number | null;
      patch: number | null;
      system_message: string | null;
      user_message: string | null;
      config: string | null;
      published_at: number | null;
    }>();

  const rows = versionsResult.results ?? [];

  const publishedRows = rows.filter((row) => row.published_at !== null);
  // Rows are newest-first, so the first published row is the latest.
  const latestPublished = publishedRows[0] ?? null;
  const draftRow = rows.find((row) => row.published_at === null) ?? null;

  const formatSemver = (row: {
    major: number | null;
    minor: number | null;
    patch: number | null;
  }): string | null =>
    row.major !== null && row.minor !== null && row.patch !== null
      ? `${row.major}.${row.minor}.${row.patch}`
      : null;

  const versions: CompareVersion[] = rows.map((row) => {
    const semver = formatSemver(row);
    const isDraft = row.published_at === null || semver === null;
    const isLive = !isDraft && row === latestPublished;
    return {
      key: isDraft ? 'draft' : (semver ?? 'draft'),
      label: isDraft ? 'Latest' : `v${semver}`,
      status: isDraft ? 'draft' : isLive ? 'live' : 'published',
      systemMessage: row.system_message ?? '',
      userMessage: row.user_message ?? '',
    };
  });

  // Baseline = the live (latest published) version; falls back to the draft
  // when nothing has been published yet.
  const baselineKey = latestPublished
    ? (formatSemver(latestPublished) ?? 'draft')
    : 'draft';

  // Model + temperature default from the baseline (live) version's config.
  const baselineConfigRaw = latestPublished?.config ?? draftRow?.config ?? null;
  let model: string | null = null;
  let temperature = 0.5;
  try {
    if (baselineConfigRaw) {
      const parsed = JSON.parse(baselineConfigRaw);
      model = parsed.model ?? null;
      temperature = parsed.temperature ?? 0.5;
    }
  } catch {
    // Keep defaults
  }

  // Test input defaults from the most recent version's config (the draft
  // usually carries the newest variables) — same source the Test panel uses.
  const inputConfigRaw = draftRow?.config ?? latestPublished?.config ?? null;
  let inputData: unknown = {};
  let inputDataRootName: string | null = null;
  try {
    if (inputConfigRaw) {
      const parsed = JSON.parse(inputConfigRaw);
      inputData = parsed.inputData ?? {};
      inputDataRootName = parsed.inputDataRootName ?? null;
    }
  } catch {
    // Keep defaults
  }

  return {
    prompt: { id: prompt.id, name: prompt.name },
    folder: folder ? { id: folder.id, name: folder.name } : null,
    versions,
    baselineKey,
    model,
    temperature,
    inputData,
    inputDataRootName,
  };
};

const ComparePage = ({ loaderData }: Route.ComponentProps) => (
  <CompareScreen
    promptId={loaderData.prompt.id}
    promptName={loaderData.prompt.name}
    versions={loaderData.versions}
    baselineKey={loaderData.baselineKey}
    initialModel={loaderData.model}
    initialTemperature={loaderData.temperature}
    initialInputData={loaderData.inputData}
    inputDataRootName={loaderData.inputDataRootName}
  />
);

export default ComparePage;
