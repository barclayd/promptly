import { IconCheck, IconX } from '@tabler/icons-react';
import { NavLink, useSearchParams } from 'react-router';
import { Button } from '~/components/ui/button';
import { Folder } from '~/components/ui/folder';
import {
  Item,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from '~/components/ui/item';
import type { Route } from './+types/index';

// biome-ignore lint/correctness/noEmptyPattern: react router default
export const meta = ({}: Route.MetaArgs) => [
  { title: 'Promptly' },
  {
    name: 'description',
    content: 'The CMS for building AI at scale',
  },
];

export default function Home() {
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
                className="mb-6 bg-emerald-50/50 border-emerald-200"
              >
                <ItemMedia variant="icon" className="bg-emerald-100 border-emerald-200">
                  <IconCheck className="text-emerald-600" />
                </ItemMedia>
                <ItemContent>
                  <ItemTitle className="text-emerald-900">
                    Welcome to the team!
                  </ItemTitle>
                  <ItemDescription className="text-emerald-700">
                    You have successfully joined the organization. You can now
                    collaborate with your team members.
                  </ItemDescription>
                </ItemContent>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={dismissWelcome}
                  className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-100"
                >
                  <IconX className="size-4" />
                </Button>
              </Item>
            )}
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
