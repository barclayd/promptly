import { RssIcon, Save } from 'lucide-react';
import { nanoid } from 'nanoid';
import { Suspense, useEffect, useState } from 'react';
import { Await, data, useFetcher } from 'react-router';
import { useDebounce } from 'use-debounce';
import { PromptEntry } from '~/components/prompt-entry';
import { PromptReview } from '~/components/prompt-review';
import { Button } from '~/components/ui/button';
import { Separator } from '~/components/ui/separator';
import { getAuth } from '~/lib/auth.server';
import type { Route } from './+types/prompts.id.id';

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
      'SELECT system_message, user_message FROM prompt_version WHERE prompt_id = ? ORDER BY created_at DESC LIMIT 1',
    )
    .bind(promptId)
    .first<{ system_message: string | null; user_message: string | null }>();

  const version = db
    .prepare(
      'SELECT version FROM prompt_version WHERE prompt_id = ? ORDER BY version DESC LIMIT 1',
    )
    .bind(promptId)
    .first<{ version: number }>();

  return {
    folder,
    prompt,
    version,
    systemMessage: latestVersion?.system_message ?? '',
    userMessage: latestVersion?.user_message ?? '',
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
  const systemMessage = (formData.get('systemMessage') as string)?.trim() ?? '';
  const userMessage = (formData.get('userMessage') as string)?.trim() ?? '';

  if (!systemMessage && !userMessage) {
    return { success: false, savedAt: null };
  }

  const currentVersion = await db
    .prepare(
      'SELECT id, version, published_at FROM prompt_version WHERE prompt_id = ? ORDER BY version DESC LIMIT 1',
    )
    .bind(promptId)
    .first<{ id: string; version: number; published_at: number | null }>();

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
        'INSERT INTO prompt_version (id, prompt_id, version, system_message, user_message, created_by) VALUES (?, ?, ?, ?, ?, ?)',
      )
      .bind(
        nanoid(),
        promptId,
        currentVersion.version + 1,
        systemMessage,
        userMessage,
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

  const [debouncedSystem] = useDebounce(systemMessage, 3000);
  const [debouncedUser] = useDebounce(userMessage, 3000);

  const [hasSavedOnce, setHasSavedOnce] = useState(false);

  useEffect(() => {
    // Skip if nothing has changed from initial load and we haven't saved yet
    const systemChanged = debouncedSystem !== initialSystem;
    const userChanged = debouncedUser !== initialUser;

    if (!systemChanged && !userChanged && !hasSavedOnce) return;

    // Skip if both are empty
    if (!debouncedSystem.trim() && !debouncedUser.trim()) return;

    setHasSavedOnce(true);
    fetcher.submit(
      { systemMessage: debouncedSystem, userMessage: debouncedUser },
      { method: 'post' },
    );
  }, [
    debouncedSystem,
    debouncedUser,
    initialSystem,
    initialUser,
    hasSavedOnce,
  ]);

  const isSystemDirty = systemMessage !== initialSystem;
  const isUserDirty = userMessage !== initialUser;

  const isSystemPendingSave = systemMessage !== debouncedSystem;
  const isUserPendingSave = userMessage !== debouncedUser;

  const isSaving = fetcher.state !== 'idle';
  const lastSavedAt = fetcher.data?.savedAt ?? null;

  return (
    <div className="flex flex-1 flex-col">
      <div className="@container/main flex flex-1 flex-col gap-2">
        <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
          <div className="px-4 lg:px-6 flex flex-col gap-y-4">
            <div className="flex gap-x-3 justify-end">
              <Button variant="outline" className="cursor-pointer">
                Save <Save />
              </Button>
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
              onChange={setSystemMessage}
              isDirty={isSystemDirty}
              isPendingSave={isSystemPendingSave}
              isSaving={isSaving}
              lastSavedAt={lastSavedAt}
            />
            <PromptReview
              title="User Prompt"
              value={userMessage}
              onChange={setUserMessage}
              isDirty={isUserDirty}
              isPendingSave={isUserPendingSave}
              isSaving={isSaving}
              lastSavedAt={lastSavedAt}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
