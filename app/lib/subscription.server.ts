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
  apiCallCount: number;
}

export interface DailyApiUsage {
  date: string;
  count: number;
}

const getCurrentMonthPeriod = (): string => {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
};

export const getApiCallCount = async (
  db: D1Database,
  organizationId: string,
): Promise<number> => {
  const period = getCurrentMonthPeriod();
  const row = await db
    .prepare(
      'SELECT count FROM api_usage WHERE organization_id = ? AND period = ?',
    )
    .bind(organizationId, period)
    .first<{ count: number }>();

  return row?.count ?? 0;
};

export const getDailyApiUsage = async (
  db: D1Database,
  organizationId: string,
): Promise<DailyApiUsage[]> => {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const startDate = `${year}-${String(month + 1).padStart(2, '0')}-01`;
  const endDate = `${year}-${String(month + 1).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`;

  const { results } = await db
    .prepare(
      'SELECT period AS date, count FROM api_usage WHERE organization_id = ? AND length(period) = 10 AND period >= ? AND period <= ? ORDER BY period',
    )
    .bind(organizationId, startDate, endDate)
    .all<{ date: string; count: number }>();

  // Build a map of existing data
  const dataMap = new Map<string, number>();
  for (const row of results) {
    dataMap.set(row.date, row.count);
  }

  // Backfill missing days with 0 (only up to today)
  const today = now.getUTCDate();
  const dailyData: DailyApiUsage[] = [];
  for (let day = 1; day <= today; day++) {
    const date = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    dailyData.push({ date, count: dataMap.get(date) ?? 0 });
  }

  return dailyData;
};

export const getResourceCounts = async (
  db: D1Database,
  organizationId: string,
): Promise<ResourceCounts> => {
  const [promptResult, memberResult, apiCallCount] = await Promise.all([
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
    getApiCallCount(db, organizationId),
  ]);

  return {
    promptCount: promptResult?.count ?? 0,
    memberCount: memberResult?.count ?? 0,
    apiCallCount,
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
