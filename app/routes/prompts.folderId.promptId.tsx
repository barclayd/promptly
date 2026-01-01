import { RssIcon } from 'lucide-react';
import { nanoid } from 'nanoid';
import { Suspense, useCallback, useRef, useState } from 'react';
import { Await, data, useFetcher } from 'react-router';
import { useDebouncedCallback } from 'use-debounce';
import { PromptReview } from '~/components/prompt-review';
import { Button } from '~/components/ui/button';
import { Separator } from '~/components/ui/separator';
import { getAuth } from '~/lib/auth.server';
import type { Route } from './+types/prompts.folderId.promptId';

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
  const { folderId, promptId } = params;
  const db = context.cloudflare.env.promptly;

  const [folder, prompt] = await Promise.all([
    db
      .prepare('SELECT id, name FROM prompt_folder WHERE id = ?')
      .bind(folderId)
      .first<{ id: string; name: string }>(),
    db
      .prepare(
        'SELECT id, name, description FROM prompt WHERE id = ? AND folder_id = ?',
      )
      .bind(promptId, folderId)
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

  const versionsResult = await db
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
    }>();

  let schema: unknown[] = [];
  let model: string | null = null;
  let temperature = 0.5;

  try {
    if (latestVersion?.config) {
      const parsed = JSON.parse(latestVersion.config);

      schema = Array.isArray(parsed.schema) ? parsed.schema : [];
      model = parsed.model ?? null;
      temperature = parsed.temperature ?? 0.5;
    }
  } catch {
    // Keep defaults
  }

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
  };
};

export const action = async ({
  request,
  params,
  context,
}: Route.ActionArgs) => {
  const { promptId } = params;
  const db = context.cloudflare.env.promptly;

  const auth = getAuth(context);
  const session = await auth.api.getSession({
    headers: request.headers,
  });

  if (!session?.user) {
    return data({ error: 'Not authenticated' }, { status: 401 });
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

  const [initialSystem] = useState(loaderData.systemMessage);
  const [initialUser] = useState(loaderData.userMessage);

  const [systemMessage, setSystemMessage] = useState(loaderData.systemMessage);
  const [userMessage, setUserMessage] = useState(loaderData.userMessage);

  const [isPendingSave, setIsPendingSave] = useState(false);

  const systemRef = useRef(systemMessage);
  const userRef = useRef(userMessage);
  systemRef.current = systemMessage;
  userRef.current = userMessage;

  const debouncedSave = useDebouncedCallback(() => {
    fetcher.submit(
      { systemMessage: systemRef.current, userMessage: userRef.current },
      { method: 'post' },
    );
    setIsPendingSave(false);
  }, 1000);

  const handleSystemChange = useCallback(
    (value: string) => {
      setSystemMessage(value);
      setIsPendingSave(true);
      debouncedSave();
    },
    [debouncedSave],
  );

  const handleUserChange = useCallback(
    (value: string) => {
      setUserMessage(value);
      setIsPendingSave(true);
      debouncedSave();
    },
    [debouncedSave],
  );

  const isSystemDirty = systemMessage !== initialSystem;
  const isUserDirty = userMessage !== initialUser;

  const isSaving = fetcher.state !== 'idle';
  const lastSavedAt = fetcher.data?.savedAt ?? null;

  return (
    <div className="flex flex-1 flex-col">
      <div className="@container/main flex flex-1 flex-col gap-2">
        <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
          <div className="px-4 lg:px-6 flex flex-col gap-y-4">
            <div className="flex gap-x-3 justify-end">
              <Button className="cursor-pointer">
                Publish <RssIcon />
              </Button>
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
              isPendingSave={isPendingSave}
              isSaving={isSaving}
              lastSavedAt={lastSavedAt}
            />
            <PromptReview
              title="User Prompt"
              value={userMessage}
              onChange={handleUserChange}
              isDirty={isUserDirty}
              isPendingSave={isPendingSave}
              isSaving={isSaving}
              lastSavedAt={lastSavedAt}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
