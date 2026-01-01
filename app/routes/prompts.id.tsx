import { PlusIcon } from 'lucide-react';
import { NavLink } from 'react-router';
import { CreatePromptDialog } from '~/components/create-prompt-dialog';
import { Paper } from '~/components/ui/paper';
import type { Route } from './+types/prompts.id';

// biome-ignore lint/correctness/noEmptyPattern: react router default
export const meta = ({}: Route.MetaArgs) => [
  { title: 'Promptly' },
  {
    name: 'description',
    content: 'The CMS for building AI at scale',
  },
];

export const loader = async ({ params, context }: Route.LoaderArgs) => {
  const { folderId } = params;
  const db = context.cloudflare.env.promptly;

  const folder = await db
    .prepare('SELECT id, name FROM prompt_folder WHERE id = ?')
    .bind(folderId)
    .first<{ id: string; name: string }>();

  if (!folder) {
    throw new Response('Folder not found', { status: 404 });
  }

  const prompts = await db
    .prepare(
      'SELECT id, name, description, updated_at FROM prompt WHERE folder_id = ?'
    )
    .bind(folderId)
    .all<{ id: string; name: string; description: string; updated_at: number }>();

  return {
    folder,
    prompts: prompts.results ?? [],
  };
};

export default function Prompts({ loaderData }: Route.ComponentProps) {
  return (
    <div className="flex flex-1 flex-col">
      <div className="@container/main flex flex-1 flex-col gap-2 bg-gray-100">
        <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
          <div className="px-4 lg:px-6">
            {loaderData.folder.name !== 'Untitled' && (
              <h1 className="text-2xl font-semibold mb-6">{loaderData.folder.name}</h1>
            )}
            <div className="font-semibold text-gray-500/75 mb-4">Prompts</div>
            <div className="flex flex-wrap gap-4">
              {loaderData.prompts.map((prompt) => (
                <NavLink
                  key={prompt.id}
                  to={`/prompts/${loaderData.folder.id}/${prompt.id}`}
                >
                  <Paper className="items-start">
                    <div className="flex flex-wrap text-pretty flex-col gap-y-2 p-4 w-full h-full">
                      <div className="flex flex-col gap-y-1 mb-8 select-none">
                        <div className="text-[0.5rem] text-right text-gray-400">
                          <span className="text-black">Last updated:</span>
                          <br />
                          {new Date(prompt.updated_at).toLocaleString(undefined, {
                            dateStyle: 'medium',
                            timeStyle: 'short',
                          })}
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
                  <div className="relative z-10 h-[250px] rounded-[2px] border-2 border-dashed border-gray-300 bg-gray-50/50 flex flex-col justify-center items-center gap-3 transition-all duration-300 ease-out hover:border-gray-400 hover:bg-white hover:shadow-lg group-hover:scale-[1.02]">
                    <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center transition-all duration-300 group-hover:bg-gray-200 group-hover:scale-110">
                      <PlusIcon
                        size={24}
                        className="text-gray-400 transition-colors duration-300 group-hover:text-gray-600"
                      />
                    </div>
                    <span className="text-sm font-medium text-gray-400 transition-colors duration-300 group-hover:text-gray-600">
                      New Prompt
                    </span>
                  </div>
                </button>
              </CreatePromptDialog>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
