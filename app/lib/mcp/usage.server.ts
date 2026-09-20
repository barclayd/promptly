export const MCP_REGISTRATION_SOURCE_LIMIT = 10;
export const MCP_REGISTRATION_GLOBAL_LIMIT = 60;
export const MCP_EXTERNAL_SOURCE_LIMIT = 120;
export const MCP_EXTERNAL_GLOBAL_LIMIT = 600;

const checkMcpPublicRateLimit = async (
  db: D1Database,
  source: string,
  namespace: string,
  sourceLimit: number,
  globalLimit: number,
  now = Date.now(),
) => {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(source),
  );
  const sourceHash = Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('');
  const sourceKey = `${namespace}:source:${sourceHash}`;
  const globalKey = `${namespace}:global`;
  const windowStart = Math.floor(now / 60_000) * 60_000;
  const results = await db.batch<{ request_count: number }>([
    db
      .prepare(
        `DELETE FROM mcp_rate_limit WHERE key IN (
           SELECT key FROM mcp_rate_limit WHERE window_start <= ? LIMIT 100
         )`,
      )
      .bind(windowStart - 10 * 60_000),
    db
      .prepare(
        `INSERT INTO mcp_rate_limit (key, window_start, request_count)
         SELECT ?, ?, 1 WHERE NOT EXISTS (
           SELECT 1 FROM mcp_rate_limit
           WHERE key = ? AND window_start = ? AND request_count >= ?
         )
         ON CONFLICT(key) DO UPDATE SET
           request_count = CASE WHEN window_start = excluded.window_start
             THEN MIN(request_count + 1, ?) ELSE 1 END,
           window_start = excluded.window_start
         RETURNING request_count`,
      )
      .bind(
        sourceKey,
        windowStart,
        globalKey,
        windowStart,
        globalLimit,
        sourceLimit + 1,
      ),
    db
      .prepare(
        `INSERT INTO mcp_rate_limit (key, window_start, request_count)
         SELECT ?, ?, 1 WHERE EXISTS (
           SELECT 1 FROM mcp_rate_limit
           WHERE key = ? AND window_start = ? AND request_count <= ?
         ) AND NOT EXISTS (
           SELECT 1 FROM mcp_rate_limit
           WHERE key = ? AND window_start = ? AND request_count >= ?
         )
         ON CONFLICT(key) DO UPDATE SET
           request_count = CASE WHEN window_start = excluded.window_start
             THEN request_count + 1 ELSE 1 END,
           window_start = excluded.window_start
         RETURNING request_count`,
      )
      .bind(
        globalKey,
        windowStart,
        sourceKey,
        windowStart,
        sourceLimit,
        globalKey,
        windowStart,
        globalLimit,
      ),
  ]);
  const sourceCount = results[1]?.results[0]?.request_count;
  const globalCount = results[2]?.results[0]?.request_count;
  return sourceCount !== undefined &&
    sourceCount <= sourceLimit &&
    globalCount !== undefined &&
    globalCount <= globalLimit
    ? null
    : Math.ceil((windowStart + 60_000 - now) / 1000);
};

export const checkMcpRegistrationRateLimit = (
  db: D1Database,
  source: string,
  now = Date.now(),
) =>
  checkMcpPublicRateLimit(
    db,
    source,
    'registration',
    MCP_REGISTRATION_SOURCE_LIMIT,
    MCP_REGISTRATION_GLOBAL_LIMIT,
    now,
  );

export const checkMcpExternalRateLimit = (
  db: D1Database,
  source: string,
  now = Date.now(),
) =>
  checkMcpPublicRateLimit(
    db,
    source,
    'external',
    MCP_EXTERNAL_SOURCE_LIMIT,
    MCP_EXTERNAL_GLOBAL_LIMIT,
    now,
  );

export const checkMcpRateLimit = async (
  db: D1Database,
  connectionId: string,
  organizationId: string,
) => {
  const now = Date.now();
  const windowStart = Math.floor(now / 60_000) * 60_000;
  const results = await db.batch<{ request_count: number }>(
    [`connection:${connectionId}`, `workspace:${organizationId}`].map((key) =>
      db
        .prepare(
          `INSERT INTO mcp_rate_limit (key, window_start, request_count) VALUES (?, ?, 1)
           ON CONFLICT(key) DO UPDATE SET
             request_count = CASE WHEN window_start = excluded.window_start THEN request_count + 1 ELSE 1 END,
             window_start = excluded.window_start
           RETURNING request_count`,
        )
        .bind(key, windowStart),
    ),
  );
  const limited = results.some(
    (result, index) =>
      (result.results[0]?.request_count ?? Infinity) >
      (index === 0 ? 120 : 600),
  );
  return limited ? Math.ceil((windowStart + 60_000 - now) / 1000) : null;
};

export const recordMcpToolCall = async (
  db: D1Database,
  organizationId: string,
  toolName: string,
) => {
  const period = new Date().toISOString().slice(0, 7);
  await db
    .prepare(
      `INSERT INTO mcp_usage (organization_id, period, tool_name, request_count)
       VALUES (?, ?, ?, 1)
       ON CONFLICT(organization_id, period, tool_name)
       DO UPDATE SET request_count = request_count + 1`,
    )
    .bind(organizationId, period, toolName)
    .run();
};
