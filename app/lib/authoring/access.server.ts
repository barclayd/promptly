import { authorizeMcpConnection } from '../mcp/connections.server';
import { getSubscriptionStatus } from '../subscription.server';
import type { McpScope } from '../validations/mcp';
import type {
  AuthoringCommitActor,
  AuthoringCommitPredicate,
} from './persistence.server';
import { AuthoringError } from './types';

export type AuthoringPrincipal =
  | { source: 'browser'; userId: string; organizationId: string }
  | {
      source: 'mcp';
      connectionId: string;
      userId: string;
      clientId: string;
      tokenScopes: readonly McpScope[];
    };

export type AuthoringAccess = {
  actor: AuthoringCommitActor;
  guards: AuthoringCommitPredicate[];
};

export const authorizeAuthoringAccess = async (
  db: D1Database,
  principal: AuthoringPrincipal,
  requiredScope: 'mcp:read' | 'mcp:write' | 'mcp:publish',
): Promise<AuthoringAccess> => {
  const mcp =
    principal.source === 'mcp'
      ? await authorizeMcpConnection(db, { ...principal, requiredScope })
      : null;
  const organizationId =
    mcp?.workspace.organizationId ??
    (principal.source === 'browser' ? principal.organizationId : '');
  const membership = await db
    .withSession('first-primary')
    .prepare(
      `SELECT m.id, m.role, u.name FROM member m JOIN user u ON u.id = m.user_id
     WHERE m.organization_id = ? AND m.user_id = ? LIMIT 2`,
    )
    .bind(organizationId, principal.userId)
    .all<{ id: string; role: string; name: string }>();
  const member = membership.results[0];
  if (
    membership.results.length !== 1 ||
    !member ||
    !['owner', 'admin', 'member'].includes(member.role)
  ) {
    throw new AuthoringError(
      'access_denied',
      'Current workspace membership is required.',
    );
  }
  const guards: AuthoringCommitPredicate[] = [
    {
      sql: `EXISTS (SELECT 1 FROM member WHERE id = ? AND user_id = ?
      AND organization_id = ? AND role IN ('owner', 'admin', 'member'))
      AND (SELECT COUNT(*) FROM member WHERE user_id = ? AND organization_id = ?) = 1`,
      values: [
        member.id,
        principal.userId,
        organizationId,
        principal.userId,
        organizationId,
      ],
    },
  ];
  if (mcp && principal.source === 'mcp') {
    guards.push({
      sql: `EXISTS (SELECT 1 FROM mcp_connection c WHERE c.id = ? AND c.user_id = ?
        AND c.organization_id = ? AND c.membership_id = ? AND c.client_id = ?
        AND c.grant_id = ? AND c.revoked_at IS NULL
        AND EXISTS (SELECT 1 FROM json_each(c.scopes) WHERE value = ?))
        AND (SELECT COUNT(*) FROM member WHERE user_id = ?) = 1`,
      values: [
        mcp.connection.id,
        principal.userId,
        organizationId,
        member.id,
        principal.clientId,
        mcp.connection.grantId,
        requiredScope,
        principal.userId,
      ],
    });
    return {
      actor: {
        source: 'mcp',
        organizationId,
        userId: principal.userId,
        name: member.name,
        connectionId: mcp.connection.id,
        clientId: mcp.connection.clientId,
        clientName: mcp.connection.clientName,
      },
      guards,
    };
  }
  return {
    actor: {
      source: 'browser',
      organizationId,
      userId: principal.userId,
      name: member.name,
    },
    guards,
  };
};

type SubscriptionPolicyRow = {
  id: string;
  plan: string;
  status: string;
  trial_end: number | null;
  updated_at: number;
};

export const getAuthoringPolicyGuards = async (
  db: D1Database,
  organizationId: string,
  kind: 'prompt' | 'composer',
  action: 'create' | 'update' | 'publish',
  documentId?: string,
): Promise<AuthoringCommitPredicate[]> => {
  if (kind === 'composer') return [];
  const status = await getSubscriptionStatus(db, organizationId);
  const session = db.withSession('first-primary');
  const row = await session
    .prepare(
      'SELECT id, plan, status, trial_end, updated_at FROM subscription WHERE organization_id = ? LIMIT 1',
    )
    .bind(organizationId)
    .first<SubscriptionPolicyRow>();
  if (
    Boolean(row) !== status.hadTrial ||
    (row && (row.plan !== status.plan || row.status !== status.status))
  ) {
    throw new AuthoringError(
      'policy_changed',
      'Workspace subscription changed. Retry the request.',
    );
  }
  const guards: AuthoringCommitPredicate[] = row
    ? [
        {
          sql: `EXISTS (SELECT 1 FROM subscription s WHERE s.id = ? AND s.organization_id = ?
      AND s.plan = ? AND s.status = ? AND s.trial_end IS ? AND s.updated_at = ?
      AND s.id = (SELECT id FROM subscription WHERE organization_id = ? LIMIT 1)
      AND (s.status != 'trialing' OR s.trial_end IS NULL OR s.trial_end = 0
        OR s.trial_end >= CAST(unixepoch('subsecond') * 1000 AS INTEGER)))`,
          values: [
            row.id,
            organizationId,
            row.plan,
            row.status,
            row.trial_end,
            row.updated_at,
            organizationId,
          ],
        },
      ]
    : [
        {
          sql: 'NOT EXISTS (SELECT 1 FROM subscription WHERE organization_id = ?)',
          values: [organizationId],
        },
      ];
  if (action === 'create' && status.limits.prompts !== -1) {
    const count =
      (await session
        .prepare(
          'SELECT COUNT(*) AS count FROM prompt WHERE organization_id = ? AND deleted_at IS NULL',
        )
        .bind(organizationId)
        .first<number>('count')) ?? 0;
    if (count >= status.limits.prompts) {
      throw new AuthoringError(
        'subscription_limit',
        `This workspace has reached its ${status.limits.prompts}-prompt limit.`,
      );
    }
    guards.push({
      sql: '(SELECT COUNT(*) FROM prompt WHERE organization_id = ? AND deleted_at IS NULL) < ?',
      values: [organizationId, status.limits.prompts],
    });
  }
  if (action !== 'create' && status.status === 'expired' && status.hadTrial) {
    const predicate: AuthoringCommitPredicate = {
      sql: `? IN (SELECT id FROM prompt WHERE organization_id = ? AND deleted_at IS NULL
        ORDER BY updated_at DESC, id ASC LIMIT 3)`,
      values: [documentId ?? '', organizationId],
    };
    const editable = await session
      .prepare(`SELECT (${predicate.sql}) AS editable`)
      .bind(...(predicate.values ?? []))
      .first<number>('editable');
    if (editable !== 1) {
      throw new AuthoringError(
        'subscription_limit',
        'This prompt is read-only on the Free plan.',
      );
    }
    guards.push(predicate);
  }
  return guards;
};
