import { readFile } from 'node:fs/promises';
import { convertV4MiniflareOptions, Miniflare } from 'miniflare';
import { searchMcpContent } from '../../app/lib/mcp/search.server';
import { expect, test } from '../fixtures/base';

const withDatabase = async (run: (db: D1Database) => Promise<void>) => {
  const runtime = new Miniflare(
    convertV4MiniflareOptions({
      modules: true,
      script:
        'export default { fetch: () => new Response("MCP search test") };',
      compatibilityDate: '2025-10-08',
      d1Databases: ['DB'],
    }),
  );
  try {
    const db = await runtime.getD1Database('DB');
    for (const name of [
      '0000_salty_green_goblin.sql',
      '0001_clammy_vertigo.sql',
      '0002_prompt_table.sql',
      '0014_drop_prompt_name_unique.sql',
      '0018_add_snippet_tables.sql',
      '0019_add_composer_tables.sql',
    ]) {
      const sql = await readFile(
        new URL(`../../migrations/drizzle/${name}`, import.meta.url),
        'utf8',
      );
      await db.batch(
        sql
          .replaceAll('--> statement-breakpoint', '')
          .split(';')
          .map((statement) => statement.trim())
          .filter(Boolean)
          .map((statement) => db.prepare(statement)),
      );
    }
    await db.batch([
      db.prepare(
        "INSERT INTO user (id, name, email) VALUES ('alice', 'Alice', 'alice@example.com')",
      ),
      db.prepare(`INSERT INTO organization (id, name, slug, created_at) VALUES
        ('workspace', 'Workspace', 'workspace', 1),
        ('other-workspace', 'Other Workspace', 'other-workspace', 1)`),
    ]);
    await run(db);
  } finally {
    await runtime.dispose();
  }
};

test('MCP search accepts the reported failing query and the full 200-character input range', async () => {
  await withDatabase(async (db) => {
    const longName = 'Ab'.repeat(100);
    const multibyteDescription = '漢字'.repeat(100);
    await db.batch([
      db
        .prepare(
          "INSERT INTO prompt (id, name, organization_id, created_by) VALUES ('long-name', ?, 'workspace', 'alice')",
        )
        .bind(`Prefix ${longName} suffix`),
      db
        .prepare(
          "INSERT INTO composer (id, name, description, organization_id, created_by) VALUES ('long-description', 'Long description', ?, 'workspace', 'alice')",
        )
        .bind(`Prefix ${multibyteDescription} suffix`),
    ]);

    const missing = await searchMcpContent(db, {
      organizationId: 'workspace',
      query: '__promptly_compatibility_nonexistent_20260915__',
      offset: 0,
      limit: 25,
    });
    expect(missing).toEqual({ items: [], nextOffset: null });

    const nameMatch = await searchMcpContent(db, {
      organizationId: 'workspace',
      query: longName.toLowerCase(),
      offset: 0,
      limit: 25,
    });
    expect(nameMatch.items.map((item) => item.id)).toEqual(['long-name']);

    const descriptionMatch = await searchMcpContent(db, {
      organizationId: 'workspace',
      query: multibyteDescription,
      offset: 0,
      limit: 25,
    });
    expect(descriptionMatch.items.map((item) => item.id)).toEqual([
      'long-description',
    ]);
  });
});

test('MCP search treats percent, underscore, and backslash as literal characters', async () => {
  await withDatabase(async (db) => {
    await db.batch(
      [
        ['percent', 'A 100% success rate'],
        ['underscore', 'An under_score'],
        ['backslash', 'A path C:\\templates'],
        ['ordinary', 'A 100 percent success rate with an under score'],
      ].map(([id, name]) =>
        db
          .prepare(
            "INSERT INTO prompt (id, name, organization_id, created_by) VALUES (?, ?, 'workspace', 'alice')",
          )
          .bind(id, name),
      ),
    );
    for (const [query, expectedId] of [
      ['%', 'percent'],
      ['_', 'underscore'],
      ['\\', 'backslash'],
      ['C:\\TEMPLATES', 'backslash'],
    ]) {
      const result = await searchMcpContent(db, {
        organizationId: 'workspace',
        query,
        offset: 0,
        limit: 25,
      });
      expect(result.items.map((item) => item.id)).toEqual([expectedId]);
    }
  });
});

test('MCP search bounds legacy display metadata while matching and sorting the full saved fields', async () => {
  await withDatabase(async (db) => {
    const prefix = 'x'.repeat(201);
    const description = `${'d'.repeat(4001)} searchtail`;
    await db.batch([
      db
        .prepare(
          "INSERT INTO prompt (id, name, description, organization_id, created_by) VALUES ('a', ?, ?, 'workspace', 'alice')",
        )
        .bind(`${prefix} Z namequery`, description),
      db
        .prepare(
          "INSERT INTO prompt (id, name, description, organization_id, created_by) VALUES ('z', ?, ?, 'workspace', 'alice')",
        )
        .bind(`${prefix} A namequery`, description),
    ]);
    for (const query of ['namequery', 'searchtail']) {
      const result = await searchMcpContent(db, {
        organizationId: 'workspace',
        query,
        offset: 0,
        limit: 25,
      });
      expect(result.items.map((item) => item.id)).toEqual(['z', 'a']);
      expect(
        result.items.every(
          (item) =>
            item.name === 'x'.repeat(200) &&
            item.description === 'd'.repeat(4000),
        ),
      ).toBe(true);
    }
  });
});

test('MCP search preserves workspace isolation, type filtering, deleted exclusions, and stable pagination', async () => {
  await withDatabase(async (db) => {
    await db.batch([
      db.prepare(`INSERT INTO prompt (id, name, organization_id, created_by, deleted_at) VALUES
        ('prompt-b', 'ALPHA', 'workspace', 'alice', NULL),
        ('prompt-a', 'Alpha', 'workspace', 'alice', NULL),
        ('beta', 'Beta', 'workspace', 'alice', NULL),
        ('other-prompt', 'Alpha', 'other-workspace', 'alice', NULL),
        ('deleted-prompt', 'Alpha', 'workspace', 'alice', 1)`),
      db.prepare(`INSERT INTO composer (id, name, organization_id, created_by, deleted_at) VALUES
        ('composer', 'alpha', 'workspace', 'alice', NULL),
        ('other-composer', 'Alpha', 'other-workspace', 'alice', NULL),
        ('deleted-composer', 'Alpha', 'workspace', 'alice', 1)`),
      db.prepare(`INSERT INTO snippet (id, name, organization_id, created_by, deleted_at) VALUES
        ('snippet', 'aLpHa', 'workspace', 'alice', NULL),
        ('other-snippet', 'Alpha', 'other-workspace', 'alice', NULL),
        ('deleted-snippet', 'Alpha', 'workspace', 'alice', 1)`),
    ]);

    const first = await searchMcpContent(db, {
      organizationId: 'workspace',
      query: '',
      offset: 0,
      limit: 2,
    });
    expect(first.items.map((item) => item.id)).toEqual([
      'composer',
      'prompt-a',
    ]);
    expect(first.nextOffset).toBe(2);
    const second = await searchMcpContent(db, {
      organizationId: 'workspace',
      query: '',
      offset: 2,
      limit: 2,
    });
    expect(second.items.map((item) => item.id)).toEqual([
      'prompt-b',
      'snippet',
    ]);
    expect(second.nextOffset).toBe(4);
    const last = await searchMcpContent(db, {
      organizationId: 'workspace',
      query: '',
      offset: 4,
      limit: 2,
    });
    expect(last.items.map((item) => item.id)).toEqual(['beta']);
    expect(last.nextOffset).toBeNull();

    const filtered = await searchMcpContent(db, {
      organizationId: 'workspace',
      query: 'ALpHa',
      type: 'prompt',
      offset: 0,
      limit: 2,
    });
    expect(filtered.items.map((item) => item.id)).toEqual([
      'prompt-a',
      'prompt-b',
    ]);
    expect(filtered.nextOffset).toBeNull();
  });
});
