import { RssIcon, Save } from 'lucide-react';
import { Suspense } from 'react';
import { Await } from 'react-router';
import { PromptEntry } from '~/components/prompt-entry';
import { PromptReview } from '~/components/prompt-review';
import { Button } from '~/components/ui/button';
import { Separator } from '~/components/ui/separator';
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

export default function Home({ loaderData }: Route.ComponentProps) {
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
            <PromptEntry />
            <Separator className="my-4" />
            <PromptReview
              title="System Prompt"
              input={loaderData.systemMessage}
            />
            <PromptReview title="User Prompt" input={loaderData.userMessage} />
          </div>
        </div>
      </div>
    </div>
  );
}
