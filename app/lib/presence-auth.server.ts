export type PresenceDocument = {
  id: string;
  organizationId: string;
  kind: 'prompt' | 'composer' | 'snippet';
};

export const getPresenceDocumentId = (pathname: string): string | null =>
  /^\/api\/presence\/([A-Za-z0-9_-]{1,128})$/.exec(pathname)?.[1] ?? null;

export const isTrustedPresenceOrigin = (
  request: Request,
  applicationUrl: string,
): boolean => {
  try {
    const trustedUrl = new URL(applicationUrl);
    return (
      (trustedUrl.protocol === 'https:' || trustedUrl.protocol === 'http:') &&
      request.headers.get('Origin') === trustedUrl.origin
    );
  } catch {
    return false;
  }
};

export const getAuthorizedPresenceDocument = (
  db: D1Database,
  userId: string,
  documentId: string,
): Promise<PresenceDocument | null> =>
  db
    .withSession('first-primary')
    .prepare(
      `WITH documents AS (
         SELECT id, organization_id, deleted_at, 'prompt' AS kind
         FROM prompt WHERE id = ?1
         UNION ALL
         SELECT id, organization_id, deleted_at, 'composer' AS kind
         FROM composer WHERE id = ?1
         UNION ALL
         SELECT id, organization_id, deleted_at, 'snippet' AS kind
         FROM snippet WHERE id = ?1
       )
       SELECT id, organization_id AS organizationId, kind
       FROM documents
       WHERE deleted_at IS NULL
         AND (SELECT COUNT(*) FROM documents) = 1
         AND EXISTS (
           SELECT 1 FROM member
           WHERE user_id = ?2 AND organization_id = documents.organization_id
         )`,
    )
    .bind(documentId, userId)
    .first<PresenceDocument>();
