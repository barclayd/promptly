import { NavLink } from 'react-router';
import { Folder } from '~/components/ui/folder';
import type { Route } from './+types/home';

// biome-ignore lint/correctness/noEmptyPattern: react router default
export function meta({}: Route.MetaArgs) {
  return [
    { title: 'Promptly' },
    {
      name: 'description',
      content:
        'The modern CMS for high performing teams to ship effective AI products at speed',
    },
  ];
}

export default function Home() {
  return (
    <div className="px-4 lg:px-6">
      <div className="font-semibold text-gray-500/75 mb-4">Folders</div>
      <NavLink to="/prompts/1">
        <div className="flex flex-col">
          <Folder />
          <h4 className="w-48 text-center my-4">Reviews</h4>
        </div>
      </NavLink>
    </div>
  );
}
