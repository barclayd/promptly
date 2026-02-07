import { APIError } from 'better-call';
import { ERROR_CODES } from './error-codes';
import type { SubscriptionRecord } from './types';

interface Adapter {
  findOne: <T>(opts: {
    model: string;
    where: Array<{ field: string; value: string }>;
  }) => Promise<T | null>;
}

/**
 * Find subscription by organizationId.
 * All subscription records have organization_id set via migration backfill.
 */
export const findSubscription = async (
  adapter: Adapter,
  { organizationId }: { organizationId: string | null | undefined },
): Promise<SubscriptionRecord | null> => {
  if (!organizationId) return null;

  return adapter.findOne<SubscriptionRecord>({
    model: 'subscription',
    where: [{ field: 'organizationId', value: organizationId }],
  });
};

interface MemberRecord {
  id: string;
  userId: string;
  organizationId: string;
  role: string;
}

/**
 * Verify the current user is an owner or admin of the active organization.
 * Throws FORBIDDEN if not. Used for billing-mutating endpoints.
 */
export const requireOrgAdmin = async (
  adapter: Adapter,
  {
    userId,
    organizationId,
  }: { userId: string; organizationId: string | null | undefined },
) => {
  if (!organizationId) {
    throw new APIError('FORBIDDEN', {
      message: ERROR_CODES.FORBIDDEN,
    });
  }

  const member = await adapter.findOne<MemberRecord>({
    model: 'member',
    where: [
      { field: 'userId', value: userId },
      { field: 'organizationId', value: organizationId },
    ],
  });

  if (!member || !['owner', 'admin'].includes(member.role)) {
    throw new APIError('FORBIDDEN', {
      message: ERROR_CODES.FORBIDDEN,
    });
  }
};
