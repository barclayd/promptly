import { readFile } from 'node:fs/promises';
import { convertV4MiniflareOptions, Miniflare } from 'miniflare';

export const applyAuthoringFixtureMigration = async (
  db: D1Database,
  name: string,
) => {
  const sql = await readFile(
    new URL(`../../migrations/drizzle/${name}`, import.meta.url),
    'utf8',
  );
  const statements = name.startsWith('0027')
    ? sql.split('--> statement-breakpoint')
    : sql.replaceAll('--> statement-breakpoint', '').split(';');
  await db.batch(
    statements
      .map((statement) => statement.trim())
      .filter(Boolean)
      .map((statement) => db.prepare(statement)),
  );
};

export const initializeAuthoringFixtureDatabase = async (db: D1Database) => {
  for (const name of [
    '0000_salty_green_goblin.sql',
    '0001_clammy_vertigo.sql',
    '0002_prompt_table.sql',
    '0003_add_published_at.sql',
    '0004_allow_null_version.sql',
    '0005_semver_columns.sql',
    '0006_add_updated_at.sql',
    '0007_add_published_by.sql',
    '0009_add_last_output_tokens.sql',
    '0010_add_last_input_tokens.sql',
    '0014_drop_prompt_name_unique.sql',
    '0015_add_llm_api_key_table.sql',
    '0018_add_snippet_tables.sql',
    '0019_add_composer_tables.sql',
    '0020_add_snippet_sort_order.sql',
  ]) {
    await applyAuthoringFixtureMigration(db, name);
  }
  await db.batch([
    db.prepare(
      "INSERT INTO user (id, name, email) VALUES ('alice', 'Alice', 'alice@example.com')",
    ),
    db.prepare(
      "INSERT INTO organization (id, name, slug, created_at) VALUES ('workspace', 'Workspace', 'workspace', 1), ('foreign', 'Foreign', 'foreign', 1)",
    ),
    db.prepare(`INSERT INTO prompt (id, name, description, organization_id, created_by, deleted_at) VALUES
        ('prompt', 'Current prompt name', 'Current description', 'workspace', 'alice', NULL),
        ('empty-prompt', 'Empty prompt', '', 'workspace', 'alice', NULL),
        ('foreign-prompt', 'Private foreign name', '', 'foreign', 'alice', NULL),
        ('deleted-prompt', 'Deleted prompt', '', 'workspace', 'alice', 1)`),
    db.prepare(`INSERT INTO prompt_version (id, prompt_id, major, minor, patch, system_message, user_message, config, labels, created_by, created_at, published_at, last_output_tokens) VALUES
        ('prompt-draft', 'prompt', NULL, NULL, NULL, 'Draft system', 'Draft user', '{}', NULL, 'alice', 30, NULL, 987654),
        ('prompt-v2', 'prompt', 2, 0, 0, 'Second publication', 'Second user', '{}', 'saved-label', 'alice', 10, 10, 987654),
        ('prompt-v1', 'prompt', 1, 0, 0, 'First publication', 'First user', '{}', NULL, 'alice', 20, 20, 987654),
        ('foreign-prompt-v1', 'foreign-prompt', 1, 0, 0, 'Private foreign body', '', '{}', NULL, 'alice', 1, 1, NULL)`),
    db.prepare(`INSERT INTO composer (id, name, organization_id, created_by) VALUES
        ('composer', 'Composer name', 'workspace', 'alice'),
        ('foreign-composer', 'Private composer name', 'foreign', 'alice')`),
    db.prepare(`INSERT INTO composer_version (id, composer_id, content, config, created_by) VALUES
        ('composer-draft', 'composer', '<p>Hello</p>', '{}', 'alice')`),
    db.prepare(`INSERT INTO snippet (id, name, organization_id, created_by) VALUES
        ('snippet', 'Reusable snippet', 'workspace', 'alice'),
        ('other-snippet', 'Other snippet', 'workspace', 'alice'),
        ('foreign-snippet', 'Private snippet name', 'foreign', 'alice')`),
    db.prepare(`INSERT INTO snippet_version (id, snippet_id, major, minor, patch, content, config, created_by, published_at) VALUES
        ('snippet-v1', 'snippet', 1, 0, 0, 'Published snippet', '{}', 'alice', 1),
        ('snippet-draft', 'snippet', NULL, NULL, NULL, 'Snippet draft', '{}', 'alice', NULL),
        ('other-snippet-v1', 'other-snippet', 1, 0, 0, 'Other content', '{}', 'alice', 1),
        ('foreign-snippet-v1', 'foreign-snippet', 1, 0, 0, 'Private snippet body', '{}', 'alice', 1)`),
  ]);
};

export const withAuthoringDatabase = async (
  run: (db: D1Database) => Promise<void>,
) => {
  const runtime = new Miniflare(
    convertV4MiniflareOptions({
      modules: true,
      script:
        'export default { fetch: () => new Response("Authoring read test") };',
      compatibilityDate: '2025-10-08',
      d1Databases: ['DB'],
    }),
  );
  try {
    const db = await runtime.getD1Database('DB');
    await initializeAuthoringFixtureDatabase(db);
    await run(db);
  } finally {
    await runtime.dispose();
  }
};
