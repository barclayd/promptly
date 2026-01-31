import { IconFolderCode } from '@tabler/icons-react';
import { ArrowUpRightIcon, PlusIcon } from 'lucide-react';
import { Suspense } from 'react';
import { Await, NavLink } from 'react-router';
import { CreatePromptDialog } from '~/components/create-prompt-dialog';
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
import type { Route } from './+types/prompts';

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
    throw new Response('Unauthorized', { status: 403 });
  }

  const db = context.cloudflare.env.promptly;

  const folders = await db
    .prepare('SELECT id, name FROM prompt_folder WHERE organization_id = ?')
    .bind(org.organizationId)
    .all<{ id: string; name: string }>();

  const untitledFolder = folders.results?.find((f) => f.name === 'Untitled');

  const prompts = untitledFolder
    ? db
        .prepare(
          'SELECT id, name, description, updated_at FROM prompt WHERE folder_id = ? AND organization_id = ?',
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
    prompts,
    untitledFolderId: untitledFolder?.id,
  };
};

export default function Prompts({ loaderData }: Route.ComponentProps) {
  if (loaderData.folders.length === 0) {
    return (
      <div className="flex flex-1 flex-col">
        <div className="@container/main flex flex-1 flex-col gap-2 bg-muted/40 dark:bg-background">
          <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6 min-h-screen justify-center">
            <div className="px-4 lg:px-6">
              <Empty>
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <IconFolderCode />
                  </EmptyMedia>
                  <EmptyTitle>No Prompts Yet</EmptyTitle>
                  <EmptyDescription>
                    You haven&apos;t created any prompts yet. Get started by
                    creating your first prompt or project.
                  </EmptyDescription>
                </EmptyHeader>
                <EmptyContent>
                  <div className="flex gap-2">
                    <CreatePromptDialog>
                      <Button>Create Prompt</Button>
                    </CreatePromptDialog>
                    <Button variant="outline">Create Project</Button>
                  </div>
                </EmptyContent>
                <Button
                  variant="link"
                  className="text-muted-foreground"
                  size="sm"
                >
                  Learn More <ArrowUpRightIcon />
                </Button>
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
              Prompts
            </div>
            <Suspense
              fallback={
                <div className="text-muted-foreground text-sm">
                  Loading prompts...
                </div>
              }
            >
              <Await resolve={loaderData.prompts}>
                {(promptsResult) => (
                  <div className="flex flex-wrap gap-4">
                    {promptsResult.results?.map((prompt) => (
                      <NavLink key={prompt.id} to={`/prompts/${prompt.id}`}>
                        <Paper className="items-start">
                          <div className="flex flex-wrap text-pretty flex-col gap-y-2 p-4 w-full h-full">
                            <div className="flex flex-col gap-y-1 mb-8 select-none">
                              <div className="text-[0.5rem] text-right text-muted-foreground">
                                <span className="text-foreground">
                                  Last updated:
                                </span>
                                <br />
                                {new Date(prompt.updated_at).toLocaleString(
                                  undefined,
                                  {
                                    dateStyle: 'medium',
                                    timeStyle: 'short',
                                  },
                                )}
                              </div>
                            </div>
                            <h3 className="text-sm font-bold">{prompt.name}</h3>
                            <p className="text-xs">{prompt.description}</p>
                          </div>
                        </Paper>
                      </NavLink>
                    ))}
                    <CreatePromptDialog>
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
                            New Prompt
                          </span>
                        </div>
                      </button>
                    </CreatePromptDialog>
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
