'use client';

import { SidebarIcon } from 'lucide-react';
import { useRouteLoaderData } from 'react-router';

import { PresenceAvatars } from '~/components/presence-avatars';
import { SearchForm } from '~/components/search-form';
import { BreadcrumbWithDropdown } from '~/components/ui/breadcrumb';
import { Button } from '~/components/ui/button';
import { Separator } from '~/components/ui/separator';
import { useSidebar } from '~/components/ui/sidebar';
import { usePresence } from '~/hooks/use-presence';
import type { loader as rootLoader } from '~/root';

type SiteHeaderProps = {
  promptId?: string;
};

export const SiteHeader = ({ promptId }: SiteHeaderProps) => {
  const { toggleSidebar } = useSidebar();
  const rootData = useRouteLoaderData<typeof rootLoader>('root');
  const { users, isConnected } = usePresence(promptId);

  const currentUserId = rootData?.user?.id;

  return (
    <header className="bg-background sticky top-0 z-50 flex w-full items-center border-b">
      <div className="flex h-(--header-height) w-full items-center gap-2 px-4">
        <Button
          className="h-8 w-8"
          variant="ghost"
          size="icon"
          onClick={toggleSidebar}
        >
          <SidebarIcon />
        </Button>
        <Separator orientation="vertical" className="mr-2 h-4" />
        <BreadcrumbWithDropdown />
        {isConnected && currentUserId && users.length > 1 && (
          <PresenceAvatars
            users={users}
            currentUserId={currentUserId}
            className="ml-2"
          />
        )}
        <SearchForm className="ml-auto" />
      </div>
    </header>
  );
};
