export const isMcpRevocationRequest = async (request: Request) => {
  if (
    request.method !== 'POST' ||
    new URL(request.url).pathname !== '/oauth/token' ||
    request.headers.get('Content-Type')?.split(';')[0].trim().toLowerCase() !==
      'application/x-www-form-urlencoded'
  ) {
    return false;
  }
  try {
    const form = await request.clone().formData();
    return !form.get('grant_type') && Boolean(form.get('token'));
  } catch {
    return false;
  }
};

export const withMcpRevocationKv = (
  db: D1Database,
  namespace: KVNamespace,
): KVNamespace => {
  // Provider 0.10.3 validates token ownership before deleting these keys.
  // Use this adapter only for its RFC 7009 path; storage-format changes must be reviewed.
  const revocations = new Map<string, Promise<void>>();
  const remove = async (key: string) => {
    const [prefix, userId, grantId, tokenId, extra] = key.split(':');
    if (
      !userId ||
      !grantId ||
      extra !== undefined ||
      !(
        (prefix === 'grant' && tokenId === undefined) ||
        (prefix === 'token' && Boolean(tokenId))
      )
    ) {
      throw new Error('Unexpected OAuth revocation storage key.');
    }
    const grantKey = `${userId}:${grantId}`;
    let revocation = revocations.get(grantKey);
    if (!revocation) {
      revocation = db
        .prepare(
          `UPDATE mcp_connection SET revoked_at = COALESCE(revoked_at, ?)
           WHERE user_id = ? AND grant_id = ?`,
        )
        .bind(Date.now(), userId, grantId)
        .run()
        .then(() => undefined);
      revocations.set(grantKey, revocation);
    }
    await revocation;
    await namespace.delete(key);
  };
  return new Proxy(namespace, {
    get: (target, property) => {
      if (property === 'delete') return remove;
      const value = Reflect.get(target, property, target);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
};
