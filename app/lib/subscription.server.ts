import type { SubscriptionStatus } from '~/plugins/trial-stripe/types';

// Plan limits must match auth.server.ts trialStripe() config
const PLAN_LIMITS = {
  free: { prompts: 3, teamMembers: 1, apiCalls: 5000 },
  pro: { prompts: -1, teamMembers: 5, apiCalls: 50000 },
} as const;

const FREE_STATUS: SubscriptionStatus = {
  plan: 'free',
  status: 'expired',
  isTrial: false,
  hadTrial: false,
  daysLeft: null,
  limits: PLAN_LIMITS.free,
  cancelAtPeriodEnd: false,
  periodEnd: null,
};

interface SubscriptionRow {
  id: string;
  plan: string;
  status: string;
  trial_end: number | null;
  period_end: number | null;
  cancel_at_period_end: number;
}

export const getSubscriptionStatus = async (
  db: D1Database,
  organizationId: string,
): Promise<SubscriptionStatus> => {
  const row = await db
    .prepare(
      'SELECT id, plan, status, trial_end, period_end, cancel_at_period_end FROM subscription WHERE organization_id = ? LIMIT 1',
    )
    .bind(organizationId)
    .first<SubscriptionRow>();

  if (!row) return FREE_STATUS;

  const now = Date.now();

  // Lazy trial expiration
  if (row.status === 'trialing' && row.trial_end && row.trial_end < now) {
    await db
      .prepare(
        'UPDATE subscription SET status = ?, plan = ?, updated_at = ? WHERE id = ?',
      )
      .bind('expired', 'free', now, row.id)
      .run();

    return { ...FREE_STATUS, hadTrial: true };
  }

  const isTrial = row.status === 'trialing';
  const daysLeft =
    isTrial && row.trial_end
      ? Math.max(0, Math.ceil((row.trial_end - now) / (1000 * 60 * 60 * 24)))
      : null;

  const limits =
    row.plan in PLAN_LIMITS
      ? PLAN_LIMITS[row.plan as keyof typeof PLAN_LIMITS]
      : PLAN_LIMITS.free;

  return {
    plan: row.plan,
    status: row.status as SubscriptionStatus['status'],
    isTrial,
    hadTrial: true,
    daysLeft,
    limits,
    cancelAtPeriodEnd: row.cancel_at_period_end === 1,
    periodEnd: row.period_end ?? null,
  };
};

export interface ResourceCounts {
  promptCount: number;
  memberCount: number;
}

export const getResourceCounts = async (
  db: D1Database,
  organizationId: string,
): Promise<ResourceCounts> => {
  const [promptResult, memberResult] = await Promise.all([
    db
      .prepare(
        'SELECT COUNT(*) as count FROM prompt WHERE organization_id = ? AND deleted_at IS NULL',
      )
      .bind(organizationId)
      .first<{ count: number }>(),
    db
      .prepare('SELECT COUNT(*) as count FROM member WHERE organization_id = ?')
      .bind(organizationId)
      .first<{ count: number }>(),
  ]);

  return {
    promptCount: promptResult?.count ?? 0,
    memberCount: memberResult?.count ?? 0,
  };
};

export type MemberRole = 'owner' | 'admin' | 'member' | null;

export const getMemberRole = async (
  db: D1Database,
  userId: string,
  organizationId: string,
): Promise<MemberRole> => {
  const row = await db
    .prepare(
      'SELECT role FROM member WHERE user_id = ? AND organization_id = ? LIMIT 1',
    )
    .bind(userId, organizationId)
    .first<{ role: string }>();

  if (!row) return null;
  return row.role as MemberRole;
};
