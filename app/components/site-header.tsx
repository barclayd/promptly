'use client';

import { SidebarIcon } from 'lucide-react';
import { useRef } from 'react';
import { useRouteLoaderData } from 'react-router';
import { toast } from 'sonner';

import { PresenceAvatars } from '~/components/presence-avatars';
import { SearchForm } from '~/components/search-form';
import { BreadcrumbWithDropdown } from '~/components/ui/breadcrumb';
import { Button } from '~/components/ui/button';
import { Separator } from '~/components/ui/separator';
import { useSidebar } from '~/components/ui/sidebar';
import { type PresenceEventCallbacks, usePresence } from '~/hooks/use-presence';
import type { loader as rootLoader } from '~/root';

type SiteHeaderProps = {
  promptId?: string;
};

export const SiteHeader = ({ promptId }: SiteHeaderProps) => {
  const { toggleSidebar } = useSidebar();
  const rootData = useRouteLoaderData<typeof rootLoader>('root');
  const { users, isConnected, subscribeToEvents } = usePresence(promptId);

  const currentUserId = rootData?.user?.id;
  const otherUsers = users.filter((u) => u.id !== currentUserId);
  const hasPresence = isConnected && currentUserId && otherUsers.length > 0;

  // Subscribe to presence events for toast notifications
  // Using ref to track subscription state without useEffect
  const subscriptionRef = useRef<{
    promptId: string;
    unsubscribe: () => void;
  } | null>(null);

  // Set up subscription when we have all required data
  if (promptId && currentUserId && subscribeToEvents) {
    // Only subscribe if we haven't already for this promptId
    if (subscriptionRef.current?.promptId !== promptId) {
      // Clean up previous subscription if exists
      subscriptionRef.current?.unsubscribe();

      const callbacks: PresenceEventCallbacks = {
        onUserJoined: (user) => {
          if (user.id !== currentUserId) {
            toast(`${user.name} joined`, {
              description: 'Now viewing this prompt',
              classNames: {
                description: '!text-muted-foreground',
              },
            });
          }
        },
        onInitialPresence: (presenceUsers) => {
          const others = presenceUsers.filter((u) => u.id !== currentUserId);
          if (others.length > 0) {
            const names = others.map((u) => u.name).join(', ');
            const verb = others.length === 1 ? 'is' : 'are';
            toast(`${names} ${verb} viewing`, {
              description: 'Currently on this prompt',
              classNames: {
                description: '!text-muted-foreground',
              },
            });
          }
        },
      };

      const unsubscribe = subscribeToEvents(callbacks);
      subscriptionRef.current = { promptId, unsubscribe };
    }
  } else if (subscriptionRef.current) {
    // Clean up subscription when promptId is removed
    subscriptionRef.current.unsubscribe();
    subscriptionRef.current = null;
  }

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
        <div className="ml-auto flex items-center gap-3">
          {hasPresence && (
            <PresenceAvatars users={users} currentUserId={currentUserId} />
          )}
          <SearchForm compact={hasPresence} />
        </div>
      </div>
    </header>
  );
};
