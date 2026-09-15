export type McpContentSearchItem = {
  id: string;
  name: string;
  description: string;
  type: 'prompt' | 'composer' | 'snippet';
};

export type McpContentSearchInput = {
  organizationId: string;
  query: string;
  type?: McpContentSearchItem['type'];
  offset: number;
  limit: number;
};

export const searchMcpContent = async (
  db: D1Database,
  { organizationId, query, type, offset, limit }: McpContentSearchInput,
): Promise<{ items: McpContentSearchItem[]; nextOffset: number | null }> => {
  const rows = await db
    .prepare(
      `SELECT id, substr(name, 1, 200) AS name, substr(description, 1, 4000) AS description, type FROM (
         SELECT id, name, description, 'prompt' AS type FROM prompt WHERE organization_id = ? AND deleted_at IS NULL
         UNION ALL SELECT id, name, description, 'composer' AS type FROM composer WHERE organization_id = ? AND deleted_at IS NULL
         UNION ALL SELECT id, name, description, 'snippet' AS type FROM snippet WHERE organization_id = ? AND deleted_at IS NULL
       ) source WHERE (? IS NULL OR type = ?)
         AND (instr(lower(source.name), lower(?)) > 0 OR instr(lower(source.description), lower(?)) > 0)
       ORDER BY source.name COLLATE NOCASE, type, id LIMIT ? OFFSET ?`,
    )
    .bind(
      organizationId,
      organizationId,
      organizationId,
      type ?? null,
      type ?? null,
      query,
      query,
      limit + 1,
      offset,
    )
    .all<McpContentSearchItem>();
  return {
    items: rows.results.slice(0, limit),
    nextOffset: rows.results.length > limit ? offset + limit : null,
  };
};
