'use client';

import { IconUserPlus } from '@tabler/icons-react';
import { Avatar, AvatarFallback, AvatarImage } from '~/components/ui/avatar';
import { Button } from '~/components/ui/button';
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '~/components/ui/empty';
import { InviteMemberDialog } from './invite-member-dialog';

interface TeamEmptyStateProps {
  currentUserImage?: string | null;
  currentUserName?: string;
}

export const TeamEmptyState = ({
  currentUserImage,
  currentUserName,
}: TeamEmptyStateProps) => {
  const getInitials = (name?: string) => {
    if (!name) return '?';
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <Empty className="bg-white/60 backdrop-blur-sm border border-gray-200/60 shadow-sm">
      <EmptyHeader>
        <EmptyMedia>
          <div className="flex items-center justify-center -space-x-3">
            {/* Left placeholder avatar */}
            <Avatar className="size-12 border-2 border-white shadow-sm ring-1 ring-gray-100">
              <AvatarFallback className="bg-gradient-to-br from-gray-100 to-gray-200 text-gray-400 text-sm grayscale">
                <IconUserPlus className="size-5 opacity-40" />
              </AvatarFallback>
            </Avatar>

            {/* Center avatar - current user or placeholder */}
            <Avatar className="size-14 border-2 border-white shadow-md ring-1 ring-gray-100 z-10 relative">
              {currentUserImage ? (
                <AvatarImage
                  src={currentUserImage}
                  alt={currentUserName || 'You'}
                  className="object-cover"
                />
              ) : null}
              <AvatarFallback className="bg-gradient-to-br from-gray-800 to-gray-900 text-white text-sm font-medium">
                {getInitials(currentUserName)}
              </AvatarFallback>
            </Avatar>

            {/* Right placeholder avatar */}
            <Avatar className="size-12 border-2 border-white shadow-sm ring-1 ring-gray-100">
              <AvatarFallback className="bg-gradient-to-br from-gray-100 to-gray-200 text-gray-400 text-sm grayscale">
                <IconUserPlus className="size-5 opacity-40" />
              </AvatarFallback>
            </Avatar>
          </div>
        </EmptyMedia>
        <EmptyTitle className="text-gray-900">No Team Members</EmptyTitle>
        <EmptyDescription className="text-gray-500">
          Invite your team to collaborate on this project
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <InviteMemberDialog>
          <Button className="gap-2 shadow-sm">
            <IconUserPlus className="size-4" />
            Invite Members
          </Button>
        </InviteMemberDialog>
      </EmptyContent>
    </Empty>
  );
};
