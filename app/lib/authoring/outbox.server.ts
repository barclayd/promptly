import { nanoid } from 'nanoid';
import { z } from 'zod';
import { cleanupAuthoringPersistence } from './persistence.server';

export type SavedRevisionNotification = {
  type: 'saved_revision';
  documentId: string;
  kind: 'prompt' | 'composer';
  revision: string;
  changeId: string;
};

type OutboxEvent = {
  id: string;
  organization_id: string;
  change_id: string;
  document_kind: 'prompt' | 'composer';
  document_id: string;
  revision: string;
  event_kind: 'invalidate_cache' | 'notify_editors';
  payload_json: string;
  attempts: number;
};

const invalidationSchema = z.strictObject({
  allVersions: z.boolean().optional(),
  publishedVersion: z
    .string()
    .regex(/^\d+\.\d+\.\d+$/)
    .optional(),
});

type OutboxEnvironment = Pick<
  Env,
  'promptly' | 'PROMPTS_CACHE' | 'PRESENCE_ROOM'
>;

const invalidate = async (cache: KVNamespace, event: OutboxEvent) => {
  if (event.document_kind !== 'prompt') return true;
  const payload = invalidationSchema.parse(JSON.parse(event.payload_json));
  await Promise.all([
    cache.delete(`prompt:${event.document_id}`),
    cache.delete(`version:${event.document_id}:latest`),
    ...(payload.publishedVersion
      ? [
          cache.delete(
            `version:${event.document_id}:${payload.publishedVersion}`,
          ),
        ]
      : []),
  ]);
  if (!payload.allVersions) return true;
  // Bound deletion work per lease. Continue from the first remaining key on a
  // later run, so deleted-key cursors cannot skip immutable version entries.
  const page = await cache.list({
    prefix: `version:${event.document_id}:`,
    limit: 100,
  });
  for (let offset = 0; offset < page.keys.length; offset += 8)
    await Promise.all(
      page.keys.slice(offset, offset + 8).map((key) => cache.delete(key.name)),
    );
  return page.list_complete;
};

export const deliverAuthoringEvents = async (
  env: OutboxEnvironment,
  options: { changeId?: string; limit?: number; now?: number } = {},
) => {
  const limit = options.limit ?? 5;
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 5)
    throw new Error(
      'Authoring delivery processes between one and five events per run.',
    );
  const now = options.now ?? Date.now();
  const leaseId = nanoid();
  const db = env.promptly.withSession('first-primary');
  const claim = await db
    .prepare(`UPDATE authoring_outbox
    SET lease_id = ?, lease_expires_at = ?, attempts = attempts + 1
    WHERE id IN (SELECT id FROM authoring_outbox
      WHERE delivered_at IS NULL AND available_at <= ?
      AND (lease_expires_at IS NULL OR lease_expires_at <= ?)
      ${options.changeId ? 'AND change_id = ?' : ''}
      ORDER BY available_at, created_at, id LIMIT ?)
    RETURNING id, organization_id, change_id, document_kind, document_id,
      revision, event_kind, payload_json, attempts`)
    .bind(
      leaseId,
      now + 60_000,
      now,
      now,
      ...(options.changeId ? [options.changeId] : []),
      limit,
    )
    .all<OutboxEvent>();
  const result = { delivered: 0, deferred: 0, failed: 0 };
  for (const event of claim.results) {
    try {
      let complete = true;
      if (event.event_kind === 'invalidate_cache')
        complete = await invalidate(env.PROMPTS_CACHE, event);
      else {
        const notification: SavedRevisionNotification = {
          type: 'saved_revision',
          documentId: event.document_id,
          kind: event.document_kind,
          revision: event.revision,
          changeId: event.change_id,
        };
        await env.PRESENCE_ROOM.getByName(event.document_id).savedRevision(
          notification,
        );
      }
      const completedAt = options.now ?? Date.now();
      await db
        .prepare(`UPDATE authoring_outbox SET delivered_at = ?,
        available_at = ?, lease_id = NULL, lease_expires_at = NULL, last_error_code = NULL
        WHERE id = ? AND lease_id = ? AND delivered_at IS NULL`)
        .bind(complete ? completedAt : null, completedAt, event.id, leaseId)
        .run();
      if (complete) result.delivered += 1;
      else result.deferred += 1;
    } catch {
      const retryAt =
        (options.now ?? Date.now()) +
        Math.min(3_600_000, 1000 * 2 ** Math.min(event.attempts, 12));
      await db
        .prepare(`UPDATE authoring_outbox SET available_at = ?,
        lease_id = NULL, lease_expires_at = NULL, last_error_code = 'delivery_failed'
        WHERE id = ? AND lease_id = ? AND delivered_at IS NULL`)
        .bind(retryAt, event.id, leaseId)
        .run();
      result.failed += 1;
      // Operational logs contain event metadata, never saved content or tokens.
      console.warn('Authoring side-effect delivery failed', {
        eventId: event.id,
        kind: event.event_kind,
        attempts: event.attempts,
      });
    }
  }
  return result;
};

export const maintainAuthoring = async (env: OutboxEnvironment) => {
  const delivery = await deliverAuthoringEvents(env);
  const cleanup = await cleanupAuthoringPersistence(env.promptly);
  return { delivery, cleanup };
};
