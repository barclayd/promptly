import { RssIcon } from 'lucide-react';
import { nanoid } from 'nanoid';
import { Suspense, useCallback, useMemo, useRef, useState } from 'react';
import { Await, data, useFetcher, useOutletContext } from 'react-router';
import { useDebouncedCallback } from 'use-debounce';
import { PromptReview } from '~/components/prompt-review';
import { PublishPromptDialog } from '~/components/publish-prompt-dialog';
import { Button } from '~/components/ui/button';
import { Separator } from '~/components/ui/separator';
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

export const loader = async ({ params, context }: Route.LoaderArgs) => {
  const org = context.get(orgContext);
  if (!org) {
    throw new Response('Unauthorized', { status: 403 });
  }

  const { folderId, promptId } = params;
  const db = context.cloudflare.env.promptly;

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

  const latestVersion = await db
    .prepare(
      'SELECT system_message, user_message, config FROM prompt_version WHERE prompt_id = ? ORDER BY created_at DESC LIMIT 1',
    )
    .bind(promptId)
    .first<{
      system_message: string | null;
      user_message: string | null;
      config: string;
    }>();

  const version = db
    .prepare(
      'SELECT version FROM prompt_version WHERE prompt_id = ? ORDER BY version DESC LIMIT 1',
    )
    .bind(promptId)
    .first<{ version: number }>();

  const [versionsResult, lastPublishedResult] = await Promise.all([
    db
      .prepare(
        `SELECT pv.version, pv.published_at, u.name as published_by
         FROM prompt_version pv
         LEFT JOIN user u ON pv.created_by = u.id
         WHERE pv.prompt_id = ?
         ORDER BY pv.version DESC`,
      )
      .bind(promptId)
      .all<{
        version: number;
        published_at: number | null;
        published_by: string | null;
      }>(),
    db
      .prepare(
        'SELECT version, config, system_message, user_message FROM prompt_version WHERE prompt_id = ? AND published_at IS NOT NULL ORDER BY version DESC LIMIT 1',
      )
      .bind(promptId)
      .first<{
        version: number;
        config: string | null;
        system_message: string | null;
        user_message: string | null;
      }>(),
  ]);

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
    if (latestVersion?.config) {
      const parsed = JSON.parse(latestVersion.config);

      schema = Array.isArray(parsed.schema) ? parsed.schema : [];
      model = parsed.model ?? null;
      temperature = parsed.temperature ?? 0.5;
      inputData = parsed.inputData ?? {};
      inputDataRootName = parsed.inputDataRootName ?? null;
    }
  } catch {
    // Keep defaults
  }

  const hasDraft = versionsResult.results?.some((v) => v.published_at === null) ?? false;

  return {
    folder,
    prompt,
    version,
    versions: versionsResult.results,
    systemMessage: latestVersion?.system_message ?? '',
    userMessage: latestVersion?.user_message ?? '',
    schema,
    model,
    temperature,
    inputData,
    inputDataRootName,
    lastPublishedVersion: lastPublishedResult?.version ?? null,
    lastPublishedSchema,
    lastPublishedSystemMessage,
    lastPublishedUserMessage,
    hasDraft,
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
        'SELECT id, version, published_at, system_message, user_message FROM prompt_version WHERE prompt_id = ? ORDER BY version DESC LIMIT 1',
      )
      .bind(promptId)
      .first<{
        id: string;
        version: number;
        published_at: number | null;
        system_message: string | null;
        user_message: string | null;
      }>();

    if (!currentVersion) {
      await db
        .prepare(
          'INSERT INTO prompt_version (id, prompt_id, version, config, created_by) VALUES (?, ?, 1, ?, ?)',
        )
        .bind(nanoid(), promptId, configJson, session.user.id)
        .run();
    } else if (currentVersion.published_at === null) {
      await db
        .prepare('UPDATE prompt_version SET config = ? WHERE id = ?')
        .bind(configJson, currentVersion.id)
        .run();
    } else {
      await db
        .prepare(
          'INSERT INTO prompt_version (id, prompt_id, version, config, system_message, user_message, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)',
        )
        .bind(
          nanoid(),
          promptId,
          currentVersion.version + 1,
          configJson,
          currentVersion.system_message,
          currentVersion.user_message,
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
      'SELECT id, version, published_at, config FROM prompt_version WHERE prompt_id = ? ORDER BY version DESC LIMIT 1',
    )
    .bind(promptId)
    .first<{
      id: string;
      version: number;
      published_at: number | null;
      config: string | null;
    }>();

  if (!currentVersion) {
    await db
      .prepare(
        'INSERT INTO prompt_version (id, prompt_id, version, system_message, user_message, created_by) VALUES (?, ?, 1, ?, ?, ?)',
      )
      .bind(nanoid(), promptId, systemMessage, userMessage, session.user.id)
      .run();
  } else if (currentVersion.published_at === null) {
    await db
      .prepare(
        'UPDATE prompt_version SET system_message = ?, user_message = ? WHERE id = ?',
      )
      .bind(systemMessage, userMessage, currentVersion.id)
      .run();
  } else {
    await db
      .prepare(
        'INSERT INTO prompt_version (id, prompt_id, version, system_message, user_message, config, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)',
      )
      .bind(
        nanoid(),
        promptId,
        currentVersion.version + 1,
        systemMessage,
        userMessage,
        currentVersion.config,
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
    const lastVersion = loaderData.lastPublishedVersion ?? 0;
    if (lastVersion === 0) return '1.0.0';
    if (!schemasEqual) return `${lastVersion + 1}.0.0`;
    return `${lastVersion}.1.0`;
  }, [loaderData.lastPublishedVersion, schemasEqual]);

  const hasContentChanges = useMemo(() => {
    if (!loaderData.lastPublishedVersion) return true;

    const systemChanged =
      loaderData.systemMessage !== (loaderData.lastPublishedSystemMessage ?? '');
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

  const canPublish = loaderData.hasDraft && hasContentChanges;

  return (
    <div className="flex flex-1 flex-col">
      <div className="@container/main flex flex-1 flex-col gap-2">
        <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
          <div className="px-4 lg:px-6 flex flex-col gap-y-4">
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
            <h1 className="text-3xl">{loaderData.prompt.name}</h1>
            <Suspense
              fallback={
                <div className="text-gray-400/75 text-sm -mt-2">Loading...</div>
              }
            >
              <Await resolve={loaderData.version}>
                {(version) => (
                  <div className="text-gray-400/75 text-sm -mt-2">
                    {version?.version
                      ? `${version.version}.0.0`
                      : 'Unpublished'}
                  </div>
                )}
              </Await>
            </Suspense>
            <p className="text-secondary-foreground">
              {loaderData.prompt.description}
            </p>
            <Separator className="my-4" />
            <PromptReview
              title="System Prompt"
              value={systemMessage}
              onChange={handleSystemChange}
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
              onChange={handleUserChange}
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
