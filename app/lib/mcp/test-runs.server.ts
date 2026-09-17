import { z } from 'zod';
import { AuthoringError } from '../authoring/types';

export const MCP_TEST_REPLAY_MS = 24 * 60 * 60 * 1000;
const RUN_UNCERTAIN_MS = 60_000;

export const mcpTestRequestKeySchema = z.string().min(1).max(200);
export const mcpTestLookupSchema = z.strictObject({
  requestKey: mcpTestRequestKeySchema,
});

export const mcpTestErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
  diagnostics: z.array(z.json()).optional(),
});
export type McpTestError = z.infer<typeof mcpTestErrorSchema>;

export const mcpTestRunOutputSchema = z.object({
  requestKey: mcpTestRequestKeySchema,
  status: z.enum(['running', 'completed', 'failed', 'uncertain']),
  expiresAt: z.number(),
  result: z.record(z.string(), z.json()).optional(),
  error: mcpTestErrorSchema.optional(),
  message: z.string().optional(),
});
export type McpTestRunOutput = z.infer<typeof mcpTestRunOutputSchema>;

type RunRow = {
  request_hash: string;
  status: 'running' | 'completed' | 'failed';
  result_json: string | null;
  created_at: number;
  expires_at: number;
};

const canonicalJson = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    return `{${Object.entries(value)
      .filter(([, entry]) => entry !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => `${JSON.stringify(key)}:${canonicalJson(entry)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
};

const requestHash = async (operation: string, input: unknown) => {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(canonicalJson({ operation, input })),
  );
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('');
};

const toResult = (row: RunRow, requestKey: string): McpTestRunOutput => {
  if (row.status === 'running') {
    const uncertain = Date.now() - row.created_at > RUN_UNCERTAIN_MS;
    return {
      requestKey,
      status: uncertain ? 'uncertain' : 'running',
      expiresAt: row.expires_at,
      message: uncertain
        ? 'The previous test did not record a final result and may have incurred provider usage. This request key will not run again. Start a new test only when the user asks to retry.'
        : 'The test is already running. Use get_test_result with this request key; do not start another billed test.',
    };
  }
  return mcpTestRunOutputSchema.parse(JSON.parse(row.result_json ?? 'null'));
};

const findRun = (
  db: D1DatabaseSession,
  connectionId: string,
  requestKey: string,
) =>
  db
    .prepare(
      `SELECT request_hash, status, result_json, created_at, expires_at
       FROM mcp_test_run WHERE connection_id = ? AND request_key = ?
       AND (status = 'running' OR expires_at > ?)`,
    )
    .bind(connectionId, requestKey, Date.now())
    .first<RunRow>();

export const getStoredMcpTest = async (
  db: D1Database,
  connectionId: string,
  requestKey: string,
): Promise<McpTestRunOutput> => {
  const row = await findRun(
    db.withSession('first-primary'),
    connectionId,
    requestKey,
  );
  if (!row)
    throw new AuthoringError(
      'content_not_found',
      'No test result exists for this connection and request key, or its 24-hour retention has expired.',
    );
  return toResult(row, requestKey);
};

export const runStoredMcpTest = async (
  db: D1Database,
  options: {
    connectionId: string;
    requestKey: string;
    operation: string;
    input: unknown;
    run: () => Promise<Record<string, unknown>>;
    toError: (error: unknown) => McpTestError;
  },
): Promise<McpTestRunOutput> => {
  const session = db.withSession('first-primary');
  const hash = await requestHash(options.operation, options.input);
  const now = Date.now();
  await session
    .prepare(
      `DELETE FROM mcp_test_run WHERE connection_id = ? AND request_key = ?
       AND status != 'running' AND expires_at <= ?`,
    )
    .bind(options.connectionId, options.requestKey, now)
    .run();
  const claimed = await session
    .prepare(
      `INSERT INTO mcp_test_run
       (connection_id, request_key, request_hash, status, created_at, expires_at)
       VALUES (?, ?, ?, 'running', ?, ?)
       ON CONFLICT(connection_id, request_key) DO NOTHING RETURNING request_key`,
    )
    .bind(
      options.connectionId,
      options.requestKey,
      hash,
      now,
      now + MCP_TEST_REPLAY_MS,
    )
    .first();
  if (!claimed) {
    const existing = await findRun(
      session,
      options.connectionId,
      options.requestKey,
    );
    if (!existing) throw new Error('Test run could not be read');
    if (existing.request_hash !== hash)
      throw new AuthoringError(
        'idempotency_conflict',
        'This request key belongs to a different test. Use the same inputs to retrieve it, or a new request key for a new test.',
      );
    return toResult(existing, options.requestKey);
  }
  let outcome: McpTestRunOutput;
  try {
    const result = await options.run();
    outcome = mcpTestRunOutputSchema.parse({
      requestKey: options.requestKey,
      status: 'completed',
      result,
      expiresAt: now + MCP_TEST_REPLAY_MS,
    });
  } catch (error) {
    outcome = {
      requestKey: options.requestKey,
      status: 'failed',
      error: options.toError(error),
      expiresAt: now + MCP_TEST_REPLAY_MS,
    };
  }
  await session
    .prepare(
      `UPDATE mcp_test_run SET status = ?, result_json = ?
       WHERE connection_id = ? AND request_key = ? AND request_hash = ?`,
    )
    .bind(
      outcome.status,
      JSON.stringify(outcome),
      options.connectionId,
      options.requestKey,
      hash,
    )
    .run();
  return outcome;
};

export const cleanupMcpTestRuns = async (db: D1Database) =>
  db
    .prepare(
      `DELETE FROM mcp_test_run WHERE (connection_id, request_key) IN
       (SELECT connection_id, request_key FROM mcp_test_run
        WHERE status != 'running' AND expires_at <= ? ORDER BY expires_at LIMIT 100)`,
    )
    .bind(Date.now())
    .run();
