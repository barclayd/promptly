'use client';

import { IconClock, IconX } from '@tabler/icons-react';
import { useFetcher } from 'react-router';
import { Badge } from '~/components/ui/badge';
import { Button } from '~/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '~/components/ui/table';
import { roleLabels } from '~/lib/validations/team';

type Invitation = {
  id: string;
  email: string;
  role: string | null;
  status: string;
  expiresAt: Date | string | number;
  createdAt: Date | string | number;
};

interface PendingInvitationsTableProps {
  invitations: Invitation[];
}

const CancelInvitationButton = ({ invitationId }: { invitationId: string }) => {
  const fetcher = useFetcher();
  const isDeleting = fetcher.state !== 'idle';

  return (
    <fetcher.Form method="post" action="/api/team/cancel-invite">
      <input type="hidden" name="invitationId" value={invitationId} />
      <Button
        type="submit"
        variant="ghost"
        size="sm"
        disabled={isDeleting}
        className="h-8 px-2 text-gray-500 hover:text-destructive hover:bg-destructive/10"
      >
        {isDeleting ? (
          <span className="size-3.5 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
        ) : (
          <IconX className="size-4" />
        )}
        <span className="sr-only">Cancel invitation</span>
      </Button>
    </fetcher.Form>
  );
};

export const PendingInvitationsTable = ({
  invitations,
}: PendingInvitationsTableProps) => {
  if (invitations.length === 0) {
    return null;
  }

  const isExpiringSoon = (expiresAt: Date | string | number) => {
    const expiry = new Date(expiresAt);
    const now = new Date();
    const hoursUntilExpiry =
      (expiry.getTime() - now.getTime()) / (1000 * 60 * 60);
    return hoursUntilExpiry < 24 && hoursUntilExpiry > 0;
  };

  const isExpired = (expiresAt: Date | string | number) => {
    return new Date(expiresAt) < new Date();
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
        <IconClock className="size-4 text-gray-400" />
        Pending Invitations
        <Badge variant="secondary" className="ml-1 font-normal">
          {invitations.length}
        </Badge>
      </div>
      <div className="rounded-xl border border-gray-200/80 bg-white shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50/50 hover:bg-gray-50/50">
              <TableHead className="font-semibold text-gray-700">
                Email
              </TableHead>
              <TableHead className="font-semibold text-gray-700">
                Role
              </TableHead>
              <TableHead className="font-semibold text-gray-700">
                Sent
              </TableHead>
              <TableHead className="font-semibold text-gray-700">
                Expires
              </TableHead>
              <TableHead className="font-semibold text-gray-700 w-16">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {invitations.map((invitation) => {
              const expired = isExpired(invitation.expiresAt);
              const expiringSoon =
                !expired && isExpiringSoon(invitation.expiresAt);

              return (
                <TableRow
                  key={invitation.id}
                  className={expired ? 'opacity-60' : ''}
                >
                  <TableCell className="py-3">
                    <div className="flex items-center gap-2">
                      <div className="size-8 rounded-full bg-gradient-to-br from-amber-50 to-amber-100 border border-amber-200/50 flex items-center justify-center">
                        <span className="text-amber-600 text-xs font-medium">
                          {invitation.email.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <span className="text-gray-900">{invitation.email}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="font-normal">
                      {roleLabels[invitation.role || 'member'] ||
                        invitation.role}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-gray-500">
                    {new Date(invitation.createdAt).toLocaleDateString(
                      'en-GB',
                      {
                        month: 'short',
                        day: 'numeric',
                      },
                    )}
                  </TableCell>
                  <TableCell>
                    {expired ? (
                      <Badge
                        variant="destructive"
                        className="font-normal gap-1"
                      >
                        Expired
                      </Badge>
                    ) : expiringSoon ? (
                      <span className="text-amber-600 font-medium text-sm">
                        {new Date(invitation.expiresAt).toLocaleDateString(
                          'en-US',
                          {
                            month: 'short',
                            day: 'numeric',
                          },
                        )}
                      </span>
                    ) : (
                      <span className="text-gray-500">
                        {new Date(invitation.expiresAt).toLocaleDateString(
                          'en-US',
                          {
                            month: 'short',
                            day: 'numeric',
                          },
                        )}
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    <CancelInvitationButton invitationId={invitation.id} />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};
