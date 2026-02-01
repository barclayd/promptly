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
import type { Route } from './+types/dashboard';

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
            <NavLink to="/prompts">
              <div className="flex flex-col">
                <Folder />
                <h4 className="w-48 text-center my-4">All prompts</h4>
              </div>
            </NavLink>
          </div>
        </div>
      </div>
    </div>
  );
}
