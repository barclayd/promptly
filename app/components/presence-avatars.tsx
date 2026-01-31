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
import { getUserColor } from '~/lib/user-colors';
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
      {visibleUsers.map((user) => {
        const userColor = getUserColor(user.id);
        return (
          <Tooltip key={user.id}>
            <TooltipTrigger asChild>
              <div className="relative cursor-default">
                <div
                  className="rounded-full p-0.5"
                  style={{
                    background: userColor,
                    boxShadow: `0 0 10px ${userColor}70`,
                  }}
                >
                  <Avatar className="size-7">
                    {user.image && (
                      <AvatarImage src={user.image} alt={user.name} />
                    )}
                    <AvatarFallback className="text-xs">
                      {getInitials(user.name)}
                    </AvatarFallback>
                  </Avatar>
                </div>
                {user.isActive && (
                  <span className="absolute bottom-0 right-0 z-10 size-2.5 rounded-full border-2 border-background bg-green-500" />
                )}
              </div>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <div className="flex items-center gap-2">
                <span
                  className="size-2 rounded-full"
                  style={{ backgroundColor: userColor }}
                />
                <span>{user.name}</span>
              </div>
              {user.isActive && (
                <span className="text-muted-foreground text-xs">
                  Currently viewing
                </span>
              )}
            </TooltipContent>
          </Tooltip>
        );
      })}
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
