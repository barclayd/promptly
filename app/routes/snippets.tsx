import { IconPuzzle } from '@tabler/icons-react';
import { PlusIcon } from 'lucide-react';
import { Suspense } from 'react';
import { Await, NavLink } from 'react-router';
import { CreateSnippetDialog } from '~/components/create-snippet-dialog';
import { Button } from '~/components/ui/button';
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '~/components/ui/empty';
import { Folder } from '~/components/ui/folder';
import { Paper } from '~/components/ui/paper';
import { orgContext } from '~/context';
import type { Route } from './+types/snippets';

// biome-ignore lint/correctness/noEmptyPattern: react router default
export const meta = ({}: Route.MetaArgs) => [
  { title: 'Snippets — Promptly' },
  {
    name: 'description',
    content: 'Reusable system prompt snippets',
  },
];

export const loader = async ({ context }: Route.LoaderArgs) => {
  const org = context.get(orgContext);
  if (!org) {
    throw new Response('Unauthorized', { status: 403 });
  }

  const db = context.cloudflare.env.promptly;

  const folders = await db
    .prepare('SELECT id, name FROM snippet_folder WHERE organization_id = ?')
    .bind(org.organizationId)
    .all<{ id: string; name: string }>();

  const untitledFolder = folders.results?.find((f) => f.name === 'Untitled');

  const snippets = untitledFolder
    ? db
        .prepare(
          'SELECT id, name, description, updated_at FROM snippet WHERE folder_id = ? AND organization_id = ? AND deleted_at IS NULL ORDER BY updated_at DESC',
        )
        .bind(untitledFolder.id, org.organizationId)
        .all<{
          id: string;
          name: string;
          description: string;
          updated_at: number;
        }>()
    : Promise.resolve({ results: [] });

  return {
    folders: folders.results ?? [],
    snippets,
    untitledFolderId: untitledFolder?.id,
  };
};

export default function Snippets({ loaderData }: Route.ComponentProps) {
  if (loaderData.folders.length === 0) {
    return (
      <div className="flex flex-1 flex-col">
        <div className="@container/main flex flex-1 flex-col gap-2 bg-muted/40 dark:bg-background">
          <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6 min-h-screen justify-center">
            <div className="px-4 lg:px-6">
              <Empty>
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <IconPuzzle />
                  </EmptyMedia>
                  <EmptyTitle>No Snippets Yet</EmptyTitle>
                  <EmptyDescription>
                    Create reusable system prompt content that can be composed
                    into multiple prompts.
                  </EmptyDescription>
                </EmptyHeader>
                <EmptyContent>
                  <div className="flex gap-2">
                    <CreateSnippetDialog>
                      <Button>Create Snippet</Button>
                    </CreateSnippetDialog>
                  </div>
                </EmptyContent>
              </Empty>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const visibleFolders = loaderData.folders.filter(
    (f) => f.name !== 'Untitled',
  );

  return (
    <div className="flex flex-1 flex-col">
      <div className="@container/main flex flex-1 flex-col gap-2 bg-muted/40 dark:bg-background">
        <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
          {visibleFolders.length > 0 && (
            <div className="px-4 lg:px-6">
              <div className="font-semibold text-muted-foreground mb-4">
                Folders
              </div>
              <div className="flex flex-wrap gap-4">
                {visibleFolders.map((folder) => (
                  <div key={folder.id} className="flex flex-col">
                    <Folder />
                    <h4 className="w-48 text-center my-4">{folder.name}</h4>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="px-4 lg:px-6">
            <div className="font-semibold text-muted-foreground mb-4">
              Snippets
            </div>
            <Suspense
              fallback={
                <div className="text-muted-foreground text-sm">
                  Loading snippets...
                </div>
              }
            >
              <Await resolve={loaderData.snippets}>
                {(snippetsResult) => (
                  <div className="flex flex-wrap gap-4">
                    {snippetsResult.results?.map((snippet) => (
                      <NavLink key={snippet.id} to={`/snippets/${snippet.id}`}>
                        <Paper className="items-start">
                          <div className="flex flex-wrap text-pretty flex-col gap-y-2 p-4 w-full h-full">
                            <div className="flex flex-col gap-y-1 mb-8 select-none">
                              <div className="text-[0.5rem] text-right text-muted-foreground">
                                <span className="text-foreground">
                                  Last updated:
                                </span>
                                <br />
                                {new Date(snippet.updated_at).toLocaleString(
                                  undefined,
                                  {
                                    dateStyle: 'medium',
                                    timeStyle: 'short',
                                  },
                                )}
                              </div>
                            </div>
                            <h3 className="text-sm font-bold">
                              {snippet.name}
                            </h3>
                            <p className="text-xs line-clamp-4">
                              {snippet.description}
                            </p>
                          </div>
                        </Paper>
                      </NavLink>
                    ))}
                    <CreateSnippetDialog>
                      <button
                        type="button"
                        className="group relative isolate min-h-[250px] w-[200px] cursor-pointer"
                      >
                        <div className="relative z-10 h-[250px] rounded-[2px] border-2 border-dashed border-border bg-muted/30 dark:bg-card/50 flex flex-col justify-center items-center gap-3 transition-all duration-300 ease-out hover:border-muted-foreground/50 hover:bg-card hover:shadow-lg group-hover:scale-[1.02]">
                          <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center transition-all duration-300 group-hover:bg-accent group-hover:scale-110">
                            <PlusIcon
                              size={24}
                              className="text-muted-foreground transition-colors duration-300 group-hover:text-foreground"
                            />
                          </div>
                          <span className="text-sm font-medium text-muted-foreground transition-colors duration-300 group-hover:text-foreground">
                            New Snippet
                          </span>
                        </div>
                      </button>
                    </CreateSnippetDialog>
                  </div>
                )}
              </Await>
            </Suspense>
          </div>
        </div>
      </div>
    </div>
  );
}
