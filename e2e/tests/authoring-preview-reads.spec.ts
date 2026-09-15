import { generateComposerMarkup } from '../../app/lib/authoring/markup.server';
import {
  previewComposer,
  previewPrompt,
  validatePrompt,
} from '../../app/lib/authoring/previews.server';
import {
  extractPromptIds,
  extractPromptVersionPins,
  parseComposerContent,
} from '../../app/lib/composer-content-parser';
import { withAuthoringDatabase } from '../fixtures/authoring-database';
import { expect, test } from '../fixtures/base';

test('authoritative preview uses selected published snippets and reports dependencies with no publication', async () => {
  await withAuthoringDatabase(async (db) => {
    await db
      .prepare(
        "INSERT INTO prompt_version_snippet (id,prompt_version_id,snippet_id,snippet_version_id,sort_order) VALUES ('ref','prompt-draft','snippet',NULL,0)",
      )
      .run();
    const input = {
      organizationId: 'workspace',
      id: 'prompt',
      version: { kind: 'working' as const },
      input: { source: 'empty' as const },
    };
    const result = await previewPrompt(db, input);
    expect(result.valid).toBe(true);
    expect(result.systemMessage).toBe('Published snippet\n\nDraft system');
    expect(JSON.stringify(result)).not.toContain('Snippet draft');
    await db.prepare("DELETE FROM snippet_version WHERE id='snippet-v1'").run();
    const missing = await previewPrompt(db, input);
    expect(missing.valid).toBe(false);
    expect(missing.diagnostics).toContainEqual(
      expect.objectContaining({ code: 'missing_published_dependency' }),
    );
    await expect(
      previewPrompt(db, { ...input, organizationId: 'foreign' }),
    ).rejects.toMatchObject({ code: 'content_not_found' });
  });
});

test('definition validation allows required inputs without a sample while preview requires supplied values', async () => {
  await withAuthoringDatabase(async (db) => {
    await db
      .prepare('UPDATE prompt_version SET user_message=?,config=? WHERE id=?')
      .bind(
        `Hello \${customer}`,
        JSON.stringify({
          schema: [
            {
              id: 'customer',
              name: 'customer',
              type: 'string',
              params: {},
              validations: [],
            },
          ],
        }),
        'prompt-draft',
      )
      .run();
    const input = {
      organizationId: 'workspace',
      id: 'prompt',
      version: { kind: 'working' as const },
    };
    expect((await validatePrompt(db, input)).valid).toBe(true);
    expect(
      (await previewPrompt(db, { ...input, input: { source: 'empty' } })).valid,
    ).toBe(false);
  });
});

test('markup helpers resolve workspace names, pins and current variable paths while preserving raw HTML structure', async () => {
  await withAuthoringDatabase(async (db) => {
    await db
      .prepare('UPDATE composer_version SET config=? WHERE id=?')
      .bind(
        JSON.stringify({
          schema: [
            {
              id: 'field',
              name: 'customer',
              type: 'string',
              params: {},
              validations: [],
            },
          ],
        }),
        'composer-draft',
      )
      .run();
    const raw = '<table><tr><td>Hello & welcome</td></tr></table>';
    const result = await generateComposerMarkup(db, {
      organizationId: 'workspace',
      composerId: 'composer',
      parts: [
        { kind: 'prompt', promptId: 'prompt', versionId: 'prompt-v1' },
        { kind: 'variable', fieldId: 'field' },
        { kind: 'raw_html', html: raw },
      ],
    });
    expect(extractPromptIds(result.html)).toEqual(['prompt']);
    expect(extractPromptVersionPins(result.html).get('prompt')).toBe(
      'prompt-v1',
    );
    expect(result.html).toContain('data-prompt-name="Current prompt name"');
    expect(result.html).toContain('data-field-path="customer"');
    expect(parseComposerContent(result.html)).toContainEqual({
      type: 'html_block',
      innerHtml: raw,
    });
    await expect(
      generateComposerMarkup(db, {
        organizationId: 'workspace',
        parts: [{ kind: 'prompt', promptId: 'foreign-prompt' }],
      }),
    ).rejects.toMatchObject({ code: 'content_not_found' });
    await expect(
      generateComposerMarkup(db, {
        organizationId: 'workspace',
        parts: [
          {
            kind: 'prompt',
            promptId: 'prompt',
            versionId: 'foreign-prompt-v1',
          },
        ],
      }),
    ).rejects.toMatchObject({ code: 'version_not_found' });
  });
});

test('composer preview resolves the referenced publication while leaving prompt output as a placeholder', async () => {
  await withAuthoringDatabase(async (db) => {
    const markup = await generateComposerMarkup(db, {
      organizationId: 'workspace',
      parts: [{ kind: 'prompt', promptId: 'prompt', versionId: 'prompt-v1' }],
    });
    await db
      .prepare('UPDATE composer_version SET content=? WHERE id=?')
      .bind(`<p>${markup.html}</p>`, 'composer-draft')
      .run();
    await db
      .prepare(
        "INSERT INTO composer_version_prompt (id,composer_version_id,prompt_id,prompt_version_id,auto_update) VALUES ('ref','composer-draft','prompt','prompt-v1',0)",
      )
      .run();
    const result = await previewComposer(db, {
      organizationId: 'workspace',
      id: 'composer',
      version: { kind: 'working' },
      input: { source: 'empty' },
    });
    expect(result.valid).toBe(true);
    expect(result.dependencies[0].resolvedVersionId).toBe('prompt-v1');
    expect(result.segments).toContainEqual(
      expect.objectContaining({
        kind: 'prompt_placeholder',
        promptId: 'prompt',
      }),
    );
    expect(result.executed).toBe(false);
    expect(JSON.stringify(result)).not.toContain('Draft system');
  });
});
