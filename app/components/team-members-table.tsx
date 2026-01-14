'use client';

import { IconCrown, IconShieldCheck, IconUser } from '@tabler/icons-react';
import { Avatar, AvatarFallback, AvatarImage } from '~/components/ui/avatar';
import { Badge } from '~/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '~/components/ui/table';
import { roleLabels } from '~/lib/validations/team';

type Member = {
  id: string;
  userId: string;
  role: 'member' | 'admin' | 'owner';
  createdAt: Date | string | number;
  user: {
    id: string;
    name: string;
    email: string;
    image: string | null;
  };
};

interface TeamMembersTableProps {
  members: Member[];
  currentUserId?: string;
}

const getInitials = (name: string) => {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
};

const getRoleBadgeVariant = (role: string) => {
  switch (role) {
    case 'owner':
      return 'default';
    case 'admin':
      return 'secondary';
    default:
      return 'outline';
  }
};

const getRoleIcon = (role: string) => {
  switch (role) {
    case 'owner':
      return <IconCrown className="size-3" />;
    case 'admin':
      return <IconShieldCheck className="size-3" />;
    default:
      return <IconUser className="size-3" />;
  }
};

export const TeamMembersTable = ({
  members,
  currentUserId,
}: TeamMembersTableProps) => {
  // Sort members: owner first, then admin, then member
  const sortedMembers = [...members].sort((a, b) => {
    const roleOrder = { owner: 0, admin: 1, member: 2 };
    return roleOrder[a.role] - roleOrder[b.role];
  });

  return (
    <div className="rounded-xl border border-gray-200/80 bg-white shadow-sm overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-gray-50/50 hover:bg-gray-50/50">
            <TableHead className="font-semibold text-gray-700">
              Member
            </TableHead>
            <TableHead className="font-semibold text-gray-700">Role</TableHead>
            <TableHead className="font-semibold text-gray-700">
              Joined
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedMembers.map((member) => {
            const isCurrentUser = member.userId === currentUserId;
            return (
              <TableRow
                key={member.id}
                className={isCurrentUser ? 'bg-gray-50/30' : ''}
              >
                <TableCell className="py-3">
                  <div className="flex items-center gap-3">
                    <Avatar className="size-9 border border-gray-100 shadow-sm">
                      {member.user.image ? (
                        <AvatarImage
                          src={member.user.image}
                          alt={member.user.name}
                          className="object-cover"
                        />
                      ) : null}
                      <AvatarFallback className="bg-gradient-to-br from-gray-100 to-gray-200 text-gray-600 text-xs font-medium">
                        {getInitials(member.user.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col min-w-0">
                      <span className="font-medium text-gray-900 truncate">
                        {member.user.name}
                        {isCurrentUser && (
                          <span className="text-gray-400 font-normal ml-1.5">
                            (you)
                          </span>
                        )}
                      </span>
                      <span className="text-sm text-gray-500 truncate">
                        {member.user.email}
                      </span>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge
                    variant={getRoleBadgeVariant(member.role)}
                    className="gap-1"
                  >
                    {getRoleIcon(member.role)}
                    {roleLabels[member.role] || member.role}
                  </Badge>
                </TableCell>
                <TableCell className="text-gray-500">
                  {new Date(member.createdAt).toLocaleDateString('en-GB', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
};
