import {
  publishSnippetDraft,
  saveSnippetDraft,
} from '../../app/lib/snippet-drafts.server';
import {
  applyAuthoringFixtureMigration,
  withAuthoringDatabase,
} from '../fixtures/authoring-database';
import { expect, test } from '../fixtures/base';

const actor = {
  snippetId: 'snippet',
  userId: 'alice',
  organizationId: 'workspace',
};
const withSnippetDatabase = async (run: (db: D1Database) => Promise<void>) =>
  withAuthoringDatabase(async (db) => {
    await applyAuthoringFixtureMigration(db, '0028_single_snippet_draft.sql');
    await db
      .prepare(
        "INSERT INTO member (id,user_id,organization_id,role,created_at) VALUES ('member','alice','workspace','owner',1)",
      )
      .run();
    await run(db);
  });

const deferred = () => {
  let resolve: () => void = () => {};
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
};
const holdBatch = (db: D1Database) => {
  const entered = deferred();
  const resume = deferred();
  return {
    entered,
    resume,
    db: {
      withSession: (constraint: string) => {
        const session = db.withSession(constraint);
        return {
          prepare: session.prepare.bind(session),
          getBookmark: session.getBookmark.bind(session),
          batch: async (statements: D1PreparedStatement[]) => {
            entered.resolve();
            await resume.promise;
            return session.batch(statements);
          },
        };
      },
    } as D1Database,
  };
};

test('snippet autosaves arriving after publication create one new draft and cannot change the publication', async () => {
  await withSnippetDatabase(async (db) => {
    await db
      .prepare(
        "UPDATE snippet_version SET content = 'Original content', config = '{\"model\":\"old\"}', labels = 'preserved' WHERE id = 'snippet-draft'",
      )
      .run();
    const held = holdBatch(db);
    const pending = saveSnippetDraft(held.db, {
      ...actor,
      field: 'content',
      value: 'Late autosave',
    });
    await held.entered.promise;
    const published = await publishSnippetDraft(db, {
      ...actor,
      major: 2,
      minor: 0,
      patch: 0,
    });
    held.resume.resolve();
    const saved = await pending;
    expect(saved.versionId).not.toBe(published.versionId);
    expect(
      await db
        .prepare(
          'SELECT content, config, labels FROM snippet_version WHERE id = ?',
        )
        .bind(published.versionId)
        .first(),
    ).toEqual({
      content: 'Original content',
      config: '{"model":"old"}',
      labels: 'preserved',
    });
    expect(
      await db
        .prepare(
          'SELECT content, config, labels FROM snippet_version WHERE id = ?',
        )
        .bind(saved.versionId)
        .first(),
    ).toEqual({
      content: 'Late autosave',
      config: '{"model":"old"}',
      labels: 'preserved',
    });
    const configHeld = holdBatch(db);
    const configPending = saveSnippetDraft(configHeld.db, {
      ...actor,
      field: 'config',
      value: '{"model":"new"}',
    });
    await configHeld.entered.promise;
    const second = await publishSnippetDraft(db, {
      ...actor,
      major: 3,
      minor: 0,
      patch: 0,
    });
    configHeld.resume.resolve();
    const configSaved = await configPending;
    expect(
      await db
        .prepare('SELECT config FROM snippet_version WHERE id = ?')
        .bind(second.versionId)
        .first('config'),
    ).toBe('{"model":"old"}');
    expect(
      await db
        .prepare('SELECT content, config FROM snippet_version WHERE id = ?')
        .bind(configSaved.versionId)
        .first(),
    ).toEqual({ content: 'Late autosave', config: '{"model":"new"}' });
    expect(
      await db
        .prepare(
          "SELECT COUNT(*) AS count FROM snippet_version WHERE snippet_id = 'snippet' AND published_at IS NULL",
        )
        .first('count'),
    ).toBe(1);
  });
});

test('concurrent snippet content and config saves preserve both fields in a single cloned draft', async () => {
  await withSnippetDatabase(async (db) => {
    await publishSnippetDraft(db, { ...actor, major: 2, minor: 0, patch: 0 });
    const [content, config] = await Promise.all([
      saveSnippetDraft(db, {
        ...actor,
        field: 'content',
        value: 'Content from writer one',
      }),
      saveSnippetDraft(db, {
        ...actor,
        field: 'config',
        value: '{"temperature":0.8}',
      }),
    ]);
    expect(content.versionId).toBe(config.versionId);
    expect(
      await db
        .prepare('SELECT content, config FROM snippet_version WHERE id = ?')
        .bind(content.versionId)
        .first(),
    ).toEqual({
      content: 'Content from writer one',
      config: '{"temperature":0.8}',
    });
    expect(
      await db
        .prepare(
          "SELECT COUNT(*) AS count FROM snippet_version WHERE snippet_id = 'snippet' AND published_at IS NULL",
        )
        .first('count'),
    ).toBe(1);
  });
});

test('snippet publication checks semver and current draft atomically while enforcing access at commit', async () => {
  await withSnippetDatabase(async (db) => {
    const outcomes = await Promise.allSettled([
      publishSnippetDraft(db, { ...actor, major: 2, minor: 0, patch: 0 }),
      publishSnippetDraft(db, { ...actor, major: 2, minor: 0, patch: 0 }),
    ]);
    expect(
      outcomes.filter((outcome) => outcome.status === 'fulfilled'),
    ).toHaveLength(1);
    expect(
      outcomes.filter((outcome) => outcome.status === 'rejected'),
    ).toHaveLength(1);
    await saveSnippetDraft(db, {
      ...actor,
      field: 'content',
      value: 'Next draft',
    });
    await expect(
      publishSnippetDraft(db, { ...actor, major: 1, minor: 9, patch: 0 }),
    ).rejects.toMatchObject({ code: 'publication_blocked' });
    const held = holdBatch(db);
    const pending = saveSnippetDraft(held.db, {
      ...actor,
      field: 'content',
      value: 'Unauthorized edit',
    });
    await held.entered.promise;
    await db.prepare("DELETE FROM member WHERE id = 'member'").run();
    held.resume.resolve();
    await expect(pending).rejects.toMatchObject({ code: 'content_not_found' });
    expect(
      await db
        .prepare(
          "SELECT content FROM snippet_version WHERE snippet_id = 'snippet' AND published_at IS NULL",
        )
        .first('content'),
    ).toBe('Next draft');
    await expect(
      publishSnippetDraft(db, { ...actor, major: 3, minor: 0, patch: 0 }),
    ).rejects.toMatchObject({ code: 'content_not_found' });
  });
});

test('snippet draft migration refuses existing duplicates without changing either saved definition', async () => {
  await withAuthoringDatabase(async (db) => {
    await db
      .prepare(
        "INSERT INTO snippet_version (id,snippet_id,content,config,created_by) VALUES ('duplicate','snippet','Preserve duplicate','{}','alice')",
      )
      .run();
    await expect(
      applyAuthoringFixtureMigration(db, '0028_single_snippet_draft.sql'),
    ).rejects.toThrow();
    expect(
      await db
        .prepare(
          "SELECT COUNT(*) AS count FROM snippet_version WHERE snippet_id = 'snippet' AND published_at IS NULL",
        )
        .first('count'),
    ).toBe(2);
    expect(
      await db
        .prepare("SELECT content FROM snippet_version WHERE id = 'duplicate'")
        .first('content'),
    ).toBe('Preserve duplicate');
  });
});
