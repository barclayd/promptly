import { NavLink } from 'react-router';
import { Folder } from '~/components/ui/folder';
import { authClient } from '~/lib/auth.client';
import type { Route } from './+types/home';

// biome-ignore lint/correctness/noEmptyPattern: react router default
export function meta({}: Route.MetaArgs) {
  return [
    { title: 'Promptly' },
    {
      name: 'description',
      content: 'The CMS for building AI at scale',
    },
  ];
}

export default function Home() {
  const {
    data: session,
    isPending, //loading state
    error, //error object
    refetch, //refetch the session
  } = authClient.useSession();

  console.log('session', session);

  return (
    <div className="flex flex-1 flex-col">
      <div className="@container/main flex flex-1 flex-col gap-2">
        <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
          <div className="px-4 lg:px-6">
            <div className="font-semibold text-gray-500/75 mb-4">Folders</div>
            <NavLink to="/prompts/1">
              <div className="flex flex-col">
                <Folder />
                <h4 className="w-48 text-center my-4">Reviews</h4>
              </div>
            </NavLink>
          </div>
        </div>
      </div>
    </div>
  );
}
