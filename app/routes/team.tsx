import { IconTrendingUp, IconUserPlus } from '@tabler/icons-react';
import { useState } from 'react';
import { InviteMemberDialog } from '~/components/invite-member-dialog';
import { PendingInvitationsTable } from '~/components/pending-invitations-table';
import { TeamEmptyState } from '~/components/team-empty-state';
import { TeamMembersTable } from '~/components/team-members-table';
import { Button } from '~/components/ui/button';
import { UpgradeGateModal } from '~/components/upgrade-gate-modal';
import { orgContext, userContext } from '~/context';
import { useCanManageBilling } from '~/hooks/use-can-manage-billing';
import { useSubscription } from '~/hooks/use-subscription';
import { getAuth } from '~/lib/auth.server';
import type { Route } from './+types/team';

type Member = {
  id: string;
  userId: string;
  organizationId: string;
  role: 'member' | 'admin' | 'owner';
  createdAt: Date;
  user: {
    id: string;
    name: string;
    email: string;
    image: string | null;
  };
};

type Invitation = {
  id: string;
  email: string;
  role: string | null;
  status: string;
  expiresAt: Date;
  createdAt: Date;
  inviterId: string;
};

type FullOrganization = {
  id: string;
  name: string;
  slug: string;
  members: Member[];
  invitations?: Invitation[];
};

// biome-ignore lint/correctness/noEmptyPattern: react router default
export const meta = ({}: Route.MetaArgs) => [
  { title: 'Team | Promptly' },
  {
    name: 'description',
    content: 'Manage your team members and invitations',
  },
];

export const loader = async ({ request, context }: Route.LoaderArgs) => {
  const org = context.get(orgContext);
  const currentUser = context.get(userContext);

  if (!org) {
    throw new Response('Unauthorized', { status: 403 });
  }

  const auth = getAuth(context);

  // Get full organization with members - pass organizationId explicitly
  const orgResponse = await auth.api.getFullOrganization({
    query: {
      organizationId: org.organizationId,
    },
    headers: request.headers,
    asResponse: true,
  });

  let allMembers: Member[] = [];

  if (orgResponse.ok) {
    const fullOrg = (await orgResponse.json()) as FullOrganization | null;
    if (fullOrg?.members) {
      allMembers = fullOrg.members;
    }
  }

  // If getFullOrganization didn't return members, try listMembers API
  if (allMembers.length === 0) {
    const membersResponse = await auth.api.listMembers({
      query: {
        organizationId: org.organizationId,
      },
      headers: request.headers,
      asResponse: true,
    });

    if (membersResponse.ok) {
      const membersData = (await membersResponse.json()) as
        | { data: Member[] }
        | Member[];
      // Handle both response formats
      allMembers = Array.isArray(membersData)
        ? membersData
        : (membersData.data ?? []);
    }
  }

  // Get pending invitations
  const invitationsResponse = await auth.api.listInvitations({
    query: {
      organizationId: org.organizationId,
    },
    headers: request.headers,
    asResponse: true,
  });

  let pendingInvitations: Invitation[] = [];
  if (invitationsResponse.ok) {
    const invitations = (await invitationsResponse.json()) as Invitation[];
    pendingInvitations = Array.isArray(invitations)
      ? invitations.filter((inv) => inv.status === 'pending')
      : [];
  }

  // Filter out current user to get "other members"
  const otherMembers = allMembers.filter(
    (member) => member.userId !== currentUser?.id,
  );

  // Find current user's member record
  const currentUserMember = allMembers.find(
    (member) => member.userId === currentUser?.id,
  );

  return {
    members: allMembers,
    otherMembers,
    currentUserMember,
    currentUserId: currentUser?.id,
    currentUserName: currentUser?.name,
    currentUserImage: currentUser?.image,
    organizationId: org.organizationId,
    organizationName: org.organizationName,
    pendingInvitations,
  };
};

const Team = ({ loaderData }: Route.ComponentProps) => {
  const {
    otherMembers,
    members,
    currentUserImage,
    currentUserName,
    currentUserId,
    pendingInvitations,
  } = loaderData;

  const { subscription } = useSubscription();
  const { canManageBilling } = useCanManageBilling();
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  const hasOtherMembers = otherMembers.length > 0;
  const hasPendingInvitations = pendingInvitations.length > 0;

  // Show empty state only if no other members AND no pending invitations
  const showEmptyState = !hasOtherMembers && !hasPendingInvitations;

  // Show upgrade button for admin/owner when not on active Pro
  const showUpgradeButton =
    canManageBilling &&
    (!subscription ||
      subscription.status === 'expired' ||
      subscription.status === 'canceled' ||
      subscription.status === 'trialing');

  return (
    <div className="flex flex-1 flex-col">
      <div className="@container/main flex flex-1 flex-col gap-2 bg-muted/40 dark:bg-background">
        <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
          <div className="px-4 lg:px-6">
            {/* Header */}
            <div className="flex items-start justify-between mb-6">
              <div>
                <h1 className="text-2xl font-semibold text-foreground">Team</h1>
                <p className="text-muted-foreground text-sm mt-1">
                  Manage your team members and invitations
                </p>
              </div>
              {!showEmptyState && (
                <div className="flex items-center gap-2">
                  {showUpgradeButton && (
                    <Button
                      variant="outline"
                      onClick={() => setShowUpgradeModal(true)}
                      className="gap-2 text-indigo-600 border-indigo-200 hover:bg-indigo-50 dark:text-indigo-400 dark:border-indigo-500/30 dark:hover:bg-indigo-500/10"
                    >
                      <IconTrendingUp className="size-4" />
                      Upgrade
                    </Button>
                  )}
                  <InviteMemberDialog>
                    <Button className="gap-2 shadow-sm">
                      <IconUserPlus className="size-4" />
                      Invite Members
                    </Button>
                  </InviteMemberDialog>
                </div>
              )}
            </div>

            {showEmptyState ? (
              <div className="flex min-h-[60vh] items-center justify-center">
                <TeamEmptyState
                  currentUserImage={currentUserImage}
                  currentUserName={currentUserName}
                />
              </div>
            ) : (
              <div className="space-y-8">
                {/* Members Table */}
                <div className="space-y-3">
                  <div className="text-sm font-medium text-foreground">
                    Team Members
                  </div>
                  <TeamMembersTable
                    members={members}
                    currentUserId={currentUserId}
                  />
                </div>

                {/* Pending Invitations */}
                {hasPendingInvitations && (
                  <PendingInvitationsTable invitations={pendingInvitations} />
                )}
              </div>
            )}
          </div>
        </div>
      </div>
      <UpgradeGateModal
        open={showUpgradeModal}
        onOpenChange={setShowUpgradeModal}
        resource="team"
      />
    </div>
  );
};

export default Team;
