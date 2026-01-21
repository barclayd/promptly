import { ArrowLeft, GitBranch, RssIcon } from 'lucide-react';
import { nanoid } from 'nanoid';
import { Suspense, useCallback, useMemo, useRef, useState } from 'react';
import {
  Await,
  data,
  useFetcher,
  useLocation,
  useNavigate,
  useOutletContext,
  useSearchParams,
} from 'react-router';
import { useDebouncedCallback } from 'use-debounce';
import { PromptReview } from '~/components/prompt-review';
import { PublishPromptDialog } from '~/components/publish-prompt-dialog';
import { Badge } from '~/components/ui/badge';
import { Button } from '~/components/ui/button';
import { Separator } from '~/components/ui/separator';
import type { Version } from '~/components/versions-table';
import { orgContext } from '~/context';
import { getAuth } from '~/lib/auth.server';
import type { Route } from './+types/prompts.folderId.promptId';

type PromptDetailContext = {
  triggerTest: () => void;
  getIsTestRunning: () => boolean;
};

// biome-ignore lint/correctness/noEmptyPattern: react router default
export const meta = ({}: Route.MetaArgs) => {
  return [
    { title: 'Promptly' },
    {
      name: 'description',
      content: 'The CMS for building AI at scale',
    },
  ];
};

export const loader = async ({
  params,
  request,
  context,
}: Route.LoaderArgs) => {
  const org = context.get(orgContext);
  if (!org) {
    throw new Response('Unauthorized', { status: 403 });
  }

  const { folderId, promptId } = params;
  const db = context.cloudflare.env.promptly;

  // Parse version query param (e.g., ?version=1.2.3)
  const url = new URL(request.url);
  const versionParam = url.searchParams.get('version');
  let requestedMajor: number | null = null;
  let requestedMinor: number | null = null;
  let requestedPatch: number | null = null;

  if (versionParam) {
    const match = versionParam.match(/^(\d+)\.(\d+)\.(\d+)$/);
    if (match) {
      requestedMajor = Number.parseInt(match[1], 10);
      requestedMinor = Number.parseInt(match[2], 10);
      requestedPatch = Number.parseInt(match[3], 10);
    }
  }

  const [folder, prompt] = await Promise.all([
    db
      .prepare(
        'SELECT id, name FROM prompt_folder WHERE id = ? AND organization_id = ?',
      )
      .bind(folderId, org.organizationId)
      .first<{ id: string; name: string }>(),
    db
      .prepare(
        'SELECT id, name, description FROM prompt WHERE id = ? AND folder_id = ? AND organization_id = ?',
      )
      .bind(promptId, folderId, org.organizationId)
      .first<{ id: string; name: string; description: string }>(),
  ]);

  if (!folder) {
    throw new Response('Folder not found', { status: 404 });
  }

  if (!prompt) {
    throw new Response('Prompt not found', { status: 404 });
  }

  // Fetch all versions for the versions table
  const versionsResult = await db
    .prepare(
      `SELECT pv.major, pv.minor, pv.patch, pv.updated_at, u_updated.name as updated_by, pv.published_at, u_created.name as published_by
       FROM prompt_version pv
       LEFT JOIN user u_created ON pv.created_by = u_created.id
       LEFT JOIN user u_updated ON pv.updated_by = u_updated.id
       WHERE pv.prompt_id = ?
       ORDER BY (pv.published_at IS NULL) DESC, pv.major DESC, pv.minor DESC, pv.patch DESC`,
    )
    .bind(promptId)
    .all<{
      major: number | null;
      minor: number | null;
      patch: number | null;
      updated_at: number | null;
      updated_by: string | null;
      published_at: number | null;
      published_by: string | null;
    }>();

  // If version param provided, try to fetch that specific version
  let versionNotFound = false;
  let isViewingOldVersion = false;
  let requestedVersion: string | null = null;

  let targetVersion: {
    system_message: string | null;
    user_message: string | null;
    config: string;
    major: number | null;
    minor: number | null;
    patch: number | null;
  } | null = null;

  if (
    versionParam &&
    requestedMajor !== null &&
    requestedMinor !== null &&
    requestedPatch !== null
  ) {
    requestedVersion = versionParam;
    targetVersion = await db
      .prepare(
        'SELECT system_message, user_message, config, major, minor, patch FROM prompt_version WHERE prompt_id = ? AND major = ? AND minor = ? AND patch = ?',
      )
      .bind(promptId, requestedMajor, requestedMinor, requestedPatch)
      .first<{
        system_message: string | null;
        user_message: string | null;
        config: string;
        major: number | null;
        minor: number | null;
        patch: number | null;
      }>();

    if (!targetVersion) {
      versionNotFound = true;
    } else {
      isViewingOldVersion = true;
    }
  } else if (versionParam) {
    // Invalid version format
    requestedVersion = versionParam;
    versionNotFound = true;
  }

  // If not viewing specific version (or version not found), get the latest
  if (!targetVersion) {
    targetVersion = await db
      .prepare(
        'SELECT system_message, user_message, config, major, minor, patch FROM prompt_version WHERE prompt_id = ? ORDER BY (published_at IS NULL) DESC, created_at DESC LIMIT 1',
      )
      .bind(promptId)
      .first<{
        system_message: string | null;
        user_message: string | null;
        config: string;
        major: number | null;
        minor: number | null;
        patch: number | null;
      }>();
  }

  // Get last published version for comparison
  const lastPublishedResult = await db
    .prepare(
      'SELECT major, minor, patch, config, system_message, user_message FROM prompt_version WHERE prompt_id = ? AND published_at IS NOT NULL ORDER BY major DESC, minor DESC, patch DESC LIMIT 1',
    )
    .bind(promptId)
    .first<{
      major: number;
      minor: number;
      patch: number;
      config: string | null;
      system_message: string | null;
      user_message: string | null;
    }>();

  let lastPublishedSchema: unknown[] = [];
  let lastPublishedSystemMessage: string | null = null;
  let lastPublishedUserMessage: string | null = null;

  try {
    if (lastPublishedResult?.config) {
      const parsed = JSON.parse(lastPublishedResult.config);
      lastPublishedSchema = Array.isArray(parsed.schema) ? parsed.schema : [];
    }
    lastPublishedSystemMessage = lastPublishedResult?.system_message ?? null;
    lastPublishedUserMessage = lastPublishedResult?.user_message ?? null;
  } catch {
    // Keep defaults
  }

  let schema: unknown[] = [];
  let model: string | null = null;
  let temperature = 0.5;
  let inputData: unknown = {};
  let inputDataRootName: string | null = null;

  try {
    if (targetVersion?.config) {
      const parsed = JSON.parse(targetVersion.config);

      schema = Array.isArray(parsed.schema) ? parsed.schema : [];
      model = parsed.model ?? null;
      temperature = parsed.temperature ?? 0.5;
      inputData = parsed.inputData ?? {};
      inputDataRootName = parsed.inputDataRootName ?? null;
    }
  } catch {
    // Keep defaults
  }

  const hasDraft =
    versionsResult.results?.some((v) => v.published_at === null) ?? false;

  // Format current version string
  const currentVersionString =
    targetVersion &&
    targetVersion.major !== null &&
    targetVersion.minor !== null &&
    targetVersion.patch !== null
      ? `${targetVersion.major}.${targetVersion.minor}.${targetVersion.patch}`
      : null;

  // Format last published version string
  const lastPublishedVersionString = lastPublishedResult
    ? `${lastPublishedResult.major}.${lastPublishedResult.minor}.${lastPublishedResult.patch}`
    : null;

  return {
    folder,
    prompt,
    currentVersion: currentVersionString,
    versions: versionsResult.results,
    systemMessage: targetVersion?.system_message ?? '',
    userMessage: targetVersion?.user_message ?? '',
    schema,
    model,
    temperature,
    inputData,
    inputDataRootName,
    lastPublishedVersion: lastPublishedVersionString,
    lastPublishedSchema,
    lastPublishedSystemMessage,
    lastPublishedUserMessage,
    hasDraft,
    isViewingOldVersion,
    versionNotFound,
    requestedVersion,
  };
};

export const action = async ({
  request,
  params,
  context,
}: Route.ActionArgs) => {
  const org = context.get(orgContext);
  if (!org) {
    return data({ error: 'Unauthorized' }, { status: 403 });
  }

  const { promptId } = params;
  const db = context.cloudflare.env.promptly;

  const auth = getAuth(context);
  const session = await auth.api.getSession({
    headers: request.headers,
  });

  if (!session?.user) {
    return data({ error: 'Not authenticated' }, { status: 401 });
  }

  const promptOwnership = await db
    .prepare('SELECT id FROM prompt WHERE id = ? AND organization_id = ?')
    .bind(promptId, org.organizationId)
    .first();

  if (!promptOwnership) {
    return data({ error: 'Prompt not found' }, { status: 404 });
  }

  const formData = await request.formData();
  const intent = formData.get('intent') as string | null;

  if (intent === 'saveConfig') {
    const configJson = (formData.get('config') as string) ?? '{}';

    const currentVersion = await db
      .prepare(
        'SELECT id, published_at, system_message, user_message FROM prompt_version WHERE prompt_id = ? ORDER BY (published_at IS NULL) DESC, created_at DESC LIMIT 1',
      )
      .bind(promptId)
      .first<{
        id: string;
        published_at: number | null;
        system_message: string | null;
        user_message: string | null;
      }>();

    const now = Date.now();
    if (!currentVersion) {
      await db
        .prepare(
          'INSERT INTO prompt_version (id, prompt_id, config, created_by, updated_at, updated_by) VALUES (?, ?, ?, ?, ?, ?)',
        )
        .bind(
          nanoid(),
          promptId,
          configJson,
          session.user.id,
          now,
          session.user.id,
        )
        .run();
    } else if (currentVersion.published_at === null) {
      await db
        .prepare(
          'UPDATE prompt_version SET config = ?, updated_at = ?, updated_by = ? WHERE id = ?',
        )
        .bind(configJson, now, session.user.id, currentVersion.id)
        .run();
    } else {
      await db
        .prepare(
          'INSERT INTO prompt_version (id, prompt_id, config, system_message, user_message, created_by, updated_at, updated_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        )
        .bind(
          nanoid(),
          promptId,
          configJson,
          currentVersion.system_message,
          currentVersion.user_message,
          session.user.id,
          now,
          session.user.id,
        )
        .run();
    }

    return { success: true, savedAt: Date.now(), intent: 'saveConfig' };
  }

  const systemMessage = (formData.get('systemMessage') as string)?.trim() ?? '';
  const userMessage = (formData.get('userMessage') as string)?.trim() ?? '';

  const currentVersion = await db
    .prepare(
      'SELECT id, published_at, config FROM prompt_version WHERE prompt_id = ? ORDER BY (published_at IS NULL) DESC, created_at DESC LIMIT 1',
    )
    .bind(promptId)
    .first<{
      id: string;
      published_at: number | null;
      config: string | null;
    }>();

  const now = Date.now();
  if (!currentVersion) {
    await db
      .prepare(
        'INSERT INTO prompt_version (id, prompt_id, system_message, user_message, created_by, updated_at, updated_by) VALUES (?, ?, ?, ?, ?, ?, ?)',
      )
      .bind(
        nanoid(),
        promptId,
        systemMessage,
        userMessage,
        session.user.id,
        now,
        session.user.id,
      )
      .run();
  } else if (currentVersion.published_at === null) {
    await db
      .prepare(
        'UPDATE prompt_version SET system_message = ?, user_message = ?, updated_at = ?, updated_by = ? WHERE id = ?',
      )
      .bind(systemMessage, userMessage, now, session.user.id, currentVersion.id)
      .run();
  } else {
    await db
      .prepare(
        'INSERT INTO prompt_version (id, prompt_id, system_message, user_message, config, created_by, updated_at, updated_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      )
      .bind(
        nanoid(),
        promptId,
        systemMessage,
        userMessage,
        currentVersion.config,
        session.user.id,
        now,
        session.user.id,
      )
      .run();
  }

  return { success: true, savedAt: Date.now() };
};

export default function PromptDetail({ loaderData }: Route.ComponentProps) {
  const fetcher = useFetcher<typeof action>();
  const { triggerTest, getIsTestRunning } =
    useOutletContext<PromptDetailContext>();
  const location = useLocation();
  const navigate = useNavigate();

  const { isViewingOldVersion, versionNotFound, requestedVersion } = loaderData;

  const [initialSystem] = useState(loaderData.systemMessage);
  const [initialUser] = useState(loaderData.userMessage);

  const [systemMessage, setSystemMessage] = useState(loaderData.systemMessage);
  const [userMessage, setUserMessage] = useState(loaderData.userMessage);

  // Separate pending states and timestamps for each field
  const [isPendingSystemSave, setIsPendingSystemSave] = useState(false);
  const [isPendingUserSave, setIsPendingUserSave] = useState(false);
  const [lastSystemSavedAt, setLastSystemSavedAt] = useState<number | null>(
    null,
  );
  const [lastUserSavedAt, setLastUserSavedAt] = useState<number | null>(null);

  // Use refs to track pending states for the debounced callback
  const pendingSystemRef = useRef(false);
  const pendingUserRef = useRef(false);

  const systemRef = useRef(systemMessage);
  const userRef = useRef(userMessage);
  systemRef.current = systemMessage;
  userRef.current = userMessage;

  const debouncedSave = useDebouncedCallback(() => {
    const now = Date.now();
    // Update timestamps for fields that were pending (optimistic update)
    if (pendingSystemRef.current) {
      setLastSystemSavedAt(now);
    }
    if (pendingUserRef.current) {
      setLastUserSavedAt(now);
    }

    fetcher.submit(
      { systemMessage: systemRef.current, userMessage: userRef.current },
      { method: 'post' },
    );

    setIsPendingSystemSave(false);
    setIsPendingUserSave(false);
    pendingSystemRef.current = false;
    pendingUserRef.current = false;
  }, 1000);

  const handleSystemChange = useCallback(
    (value: string) => {
      setSystemMessage(value);
      setIsPendingSystemSave(true);
      pendingSystemRef.current = true;
      debouncedSave();
    },
    [debouncedSave],
  );

  const handleUserChange = useCallback(
    (value: string) => {
      setUserMessage(value);
      setIsPendingUserSave(true);
      pendingUserRef.current = true;
      debouncedSave();
    },
    [debouncedSave],
  );

  const isSystemDirty = systemMessage !== initialSystem;
  const isUserDirty = userMessage !== initialUser;

  const schemasEqual = useMemo(() => {
    const sortByName = (arr: unknown[]) =>
      [...arr].sort((a, b) => {
        const aName = (a as { name?: string })?.name ?? '';
        const bName = (b as { name?: string })?.name ?? '';
        return aName.localeCompare(bName);
      });

    const currentSchema = loaderData.schema as unknown[];
    const lastSchema = loaderData.lastPublishedSchema as unknown[];

    if (currentSchema.length !== lastSchema.length) return false;
    return (
      JSON.stringify(sortByName(currentSchema)) ===
      JSON.stringify(sortByName(lastSchema))
    );
  }, [loaderData.schema, loaderData.lastPublishedSchema]);

  const suggestedVersion = useMemo(() => {
    const lastVersion = loaderData.lastPublishedVersion;
    if (!lastVersion) return '1.0.0';

    const [major, minor, patch] = lastVersion.split('.').map(Number);
    if (!schemasEqual) {
      // Schema changed = breaking change = bump major
      return `${major + 1}.0.0`;
    }
    // Content changed = minor bump
    return `${major}.${minor + 1}.${patch}`;
  }, [loaderData.lastPublishedVersion, schemasEqual]);

  const hasContentChanges = useMemo(() => {
    if (!loaderData.lastPublishedVersion) return true;

    const systemChanged =
      loaderData.systemMessage !==
      (loaderData.lastPublishedSystemMessage ?? '');
    const userChanged =
      loaderData.userMessage !== (loaderData.lastPublishedUserMessage ?? '');
    const schemaChanged = !schemasEqual;

    return systemChanged || userChanged || schemaChanged;
  }, [
    loaderData.lastPublishedVersion,
    loaderData.systemMessage,
    loaderData.userMessage,
    loaderData.lastPublishedSystemMessage,
    loaderData.lastPublishedUserMessage,
    schemasEqual,
  ]);

  const canPublish =
    loaderData.hasDraft && hasContentChanges && !isViewingOldVersion;

  // Handle navigating back to latest version
  const handleBackToLatest = useCallback(() => {
    navigate(location.pathname);
  }, [navigate, location.pathname]);

  // Get published versions for the compact version list
  const [, setSearchParams] = useSearchParams();
  const publishedVersions = loaderData.versions.filter(
    (v: Version) => v.major !== null && v.minor !== null && v.patch !== null,
  );

  const handleVersionClick = (v: Version) => {
    if (v.major !== null && v.minor !== null && v.patch !== null) {
      setSearchParams({ version: `${v.major}.${v.minor}.${v.patch}` });
    }
  };

  // Show 404 state if version not found
  if (versionNotFound) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center p-8 animate-in fade-in duration-300">
        <div className="max-w-md w-full">
          {/* Icon with subtle gradient background */}
          <div className="relative mx-auto w-16 h-16 mb-6">
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-muted to-muted/50 rotate-6" />
            <div className="absolute inset-0 rounded-2xl bg-card border border-border flex items-center justify-center shadow-sm">
              <GitBranch className="w-7 h-7 text-muted-foreground" />
            </div>
          </div>

          {/* Main content */}
          <div className="text-center mb-8">
            <h2 className="text-xl font-semibold tracking-tight mb-2">
              Version not found
            </h2>
            <p className="text-muted-foreground text-sm leading-relaxed">
              <span className="font-mono text-foreground bg-muted px-1.5 py-0.5 rounded text-xs">
                v{requestedVersion}
              </span>{' '}
              doesn't exist for{' '}
              <span className="font-medium text-foreground">
                {loaderData.prompt.name}
              </span>
            </p>
          </div>

          {/* Available versions as compact badges */}
          {publishedVersions.length > 0 && (
            <div className="mb-8">
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium mb-3 text-center">
                Available versions
              </p>
              <div className="flex flex-wrap gap-2 justify-center">
                {publishedVersions.slice(0, 8).map((v: Version) => {
                  const versionString = `${v.major}.${v.minor}.${v.patch}`;
                  return (
                    <button
                      key={versionString}
                      type="button"
                      onClick={() => handleVersionClick(v)}
                      className="group relative"
                    >
                      <Badge
                        variant="outline"
                        className="font-mono text-xs px-2.5 py-1 cursor-pointer transition-all duration-150 hover:bg-primary hover:text-primary-foreground hover:border-primary"
                      >
                        v{versionString}
                      </Badge>
                    </button>
                  );
                })}
                {publishedVersions.length > 8 && (
                  <Badge
                    variant="secondary"
                    className="text-xs px-2.5 py-1 text-muted-foreground"
                  >
                    +{publishedVersions.length - 8} more
                  </Badge>
                )}
              </div>
            </div>
          )}

          {/* Primary action */}
          <div className="flex justify-center">
            <Button
              onClick={handleBackToLatest}
              className="gap-2 px-6 shadow-sm"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to latest
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col">
      {/* Readonly banner when viewing old version */}
      {isViewingOldVersion && (
        <div className="bg-muted border-b px-4 pl-6 py-2 flex items-center justify-between">
          <span className="text-sm text-muted-foreground">
            Viewing version {requestedVersion} (read-only)
          </span>
          <Button variant="outline" size="sm" onClick={handleBackToLatest}>
            Back to latest
          </Button>
        </div>
      )}
      <div className="@container/main flex flex-1 flex-col gap-2">
        <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
          <div className="px-4 lg:px-6 flex flex-col gap-y-4">
            {!isViewingOldVersion && (
              <div className="flex gap-x-3 justify-end">
                <PublishPromptDialog
                  promptId={loaderData.prompt.id}
                  folderId={loaderData.folder.id}
                  suggestedVersion={suggestedVersion}
                  lastPublishedVersion={loaderData.lastPublishedVersion}
                  isSchemaChanged={!schemasEqual}
                  disabled={!canPublish}
                >
                  <Button className="cursor-pointer" disabled={!canPublish}>
                    Publish <RssIcon />
                  </Button>
                </PublishPromptDialog>
              </div>
            )}
            <h1 className="text-3xl">{loaderData.prompt.name}</h1>
            <div className="text-gray-400/75 text-sm -mt-2">
              {loaderData.currentVersion
                ? `v${loaderData.currentVersion}`
                : 'Draft'}
            </div>
            <p className="text-secondary-foreground">
              {loaderData.prompt.description}
            </p>
            <Separator className="my-4" />
            <PromptReview
              title="System Prompt"
              value={systemMessage}
              onChange={isViewingOldVersion ? undefined : handleSystemChange}
              isDirty={isSystemDirty}
              isPendingSave={isPendingSystemSave}
              isSaving={false}
              lastSavedAt={lastSystemSavedAt}
              onTest={triggerTest}
              isTestRunning={getIsTestRunning()}
            />
            <PromptReview
              title="User Prompt"
              value={userMessage}
              onChange={isViewingOldVersion ? undefined : handleUserChange}
              isDirty={isUserDirty}
              isPendingSave={isPendingUserSave}
              isSaving={false}
              lastSavedAt={lastUserSavedAt}
              onTest={triggerTest}
              isTestRunning={getIsTestRunning()}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
