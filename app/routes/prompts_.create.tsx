import { PlusIcon } from 'lucide-react';
import { NavLink } from 'react-router';
import { Paper } from '~/components/ui/paper';
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

export default function Prompts() {
  return (
    <div className="flex flex-1 flex-col">
      <div className="@container/main flex flex-1 flex-col gap-2 bg-gray-200">
        <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
          <div className="px-4 lg:px-6">
            <NavLink to="/prompts/1">
              <Paper>
                <PlusIcon size={36} />
              </Paper>
            </NavLink>
          </div>
        </div>
      </div>
    </div>
  );
}
