import {
  Avatar,
  AvatarBadge,
  AvatarFallback,
  AvatarGroup,
  AvatarGroupCount,
  AvatarImage,
} from '~/components/ui/avatar';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '~/components/ui/tooltip';
import type { PresenceUser } from '~/hooks/use-presence';
import { cn } from '~/lib/utils';

type PresenceAvatarsProps = {
  users: PresenceUser[];
  currentUserId: string;
  maxVisible?: number;
  className?: string;
};

const getInitials = (name: string): string => {
  const parts = name.split(' ').filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

export const PresenceAvatars = ({
  users,
  currentUserId,
  maxVisible = 3,
  className,
}: PresenceAvatarsProps) => {
  // Filter out the current user
  const otherUsers = users.filter((user) => user.id !== currentUserId);

  if (otherUsers.length === 0) {
    return null;
  }

  const visibleUsers = otherUsers.slice(0, maxVisible);
  const overflowCount = otherUsers.length - maxVisible;

  return (
    <AvatarGroup className={cn('items-center', className)}>
      {visibleUsers.map((user) => (
        <Tooltip key={user.id}>
          <TooltipTrigger asChild>
            <Avatar className="size-7 ring-2 ring-background cursor-default overflow-visible">
              {user.image && <AvatarImage src={user.image} alt={user.name} />}
              <AvatarFallback className="text-xs">
                {getInitials(user.name)}
              </AvatarFallback>
              {user.isActive && <AvatarBadge className="bg-green-500" />}
            </Avatar>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            <span>{user.name}</span>
            {user.isActive && (
              <span className="text-muted-foreground ml-1">(viewing)</span>
            )}
          </TooltipContent>
        </Tooltip>
      ))}
      {overflowCount > 0 && (
        <Tooltip>
          <TooltipTrigger asChild>
            <AvatarGroupCount
              count={overflowCount}
              className="size-7 text-[10px] cursor-default"
            />
          </TooltipTrigger>
          <TooltipContent side="bottom">
            <span>
              {overflowCount} more {overflowCount === 1 ? 'viewer' : 'viewers'}
            </span>
          </TooltipContent>
        </Tooltip>
      )}
    </AvatarGroup>
  );
};
