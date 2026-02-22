import { IconCheck, IconX } from '@tabler/icons-react';
import { NavLink, useLoaderData, useSearchParams } from 'react-router';
import { Button } from '~/components/ui/button';
import { Folder } from '~/components/ui/folder';
import {
  Item,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from '~/components/ui/item';
import { PaperStack } from '~/components/ui/paper-stack';
import { PuzzlePieces } from '~/components/ui/puzzle-pieces';
import { orgContext } from '~/context';
import type { Route } from './+types/dashboard';

// biome-ignore lint/correctness/noEmptyPattern: react router default
export const meta = ({}: Route.MetaArgs) => [
  { title: 'Promptly' },
  {
    name: 'description',
    content: 'The CMS for building AI at scale',
  },
];

export const loader = async ({ context }: Route.LoaderArgs) => {
  const org = context.get(orgContext);
  if (!org) {
    return { latestComposer: null };
  }

  const db = context.cloudflare.env.promptly;

  const result = await db
    .prepare(
      `SELECT c.name, cv.content
       FROM composer c
       JOIN composer_version cv ON cv.composer_id = c.id
         AND cv.id = (
           SELECT id FROM composer_version
           WHERE composer_id = c.id
           ORDER BY major DESC, minor DESC, patch DESC
           LIMIT 1
         )
       WHERE c.organization_id = ?
         AND c.deleted_at IS NULL
       ORDER BY c.updated_at DESC
       LIMIT 1`,
    )
    .bind(org.organizationId)
    .first<{ name: string; content: string | null }>();

  return {
    latestComposer: result
      ? { name: result.name, content: result.content ?? '' }
      : null,
  };
};

export default function Home() {
  const { latestComposer } = useLoaderData<typeof loader>();
  const [searchParams, setSearchParams] = useSearchParams();
  const hasJoined = searchParams.get('joined') === 'true';

  const dismissWelcome = () => {
    setSearchParams({}, { replace: true });
  };

  return (
    <div className="flex flex-1 flex-col">
      <div className="@container/main flex flex-1 flex-col gap-2">
        <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
          <div className="px-4 lg:px-6">
            {hasJoined && (
              <Item
                variant="outline"
                className="mb-6 bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800"
              >
                <ItemMedia
                  variant="icon"
                  className="bg-emerald-100 dark:bg-emerald-900/50 border-emerald-200 dark:border-emerald-800"
                >
                  <IconCheck className="text-emerald-600 dark:text-emerald-400" />
                </ItemMedia>
                <ItemContent>
                  <ItemTitle className="text-emerald-900 dark:text-emerald-100">
                    Welcome to the team!
                  </ItemTitle>
                  <ItemDescription className="text-emerald-700 dark:text-emerald-300">
                    You have successfully joined the organization. You can now
                    collaborate with your team members.
                  </ItemDescription>
                </ItemContent>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={dismissWelcome}
                  className="text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/50"
                >
                  <IconX className="size-4" />
                </Button>
              </Item>
            )}
            <div className="font-semibold text-muted-foreground mb-4">
              Folders
            </div>
            <div className="flex flex-wrap items-end gap-8">
              <NavLink to="/prompts">
                <div className="flex flex-col">
                  <Folder />
                  <h4 className="w-48 text-center my-4">All prompts</h4>
                </div>
              </NavLink>
              <NavLink to="/snippets">
                <div className="flex flex-col">
                  <PuzzlePieces />
                  <h4 className="w-48 text-center my-4">All snippets</h4>
                </div>
              </NavLink>
              <NavLink to="/composers">
                <div className="flex flex-col">
                  <PaperStack
                    title={latestComposer?.name}
                    content={latestComposer?.content}
                  />
                  <h4 className="w-48 text-center my-4">All composers</h4>
                </div>
              </NavLink>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
