import { AUTHORING_LIMITS } from '../validations/authoring';
import {
  type ComposerMarkupParts,
  composerMarkupPartsSchema,
} from '../validations/composer-markup';
import { assertAuthoringJson, parseAuthoringValue } from './normalize';
import { readComposerDefinition, readPromptDefinition } from './reads.server';
import { type AuthoringDiagnostic, AuthoringError } from './types';

const attribute = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

export const generateComposerMarkup = async (
  db: D1Database,
  input: {
    organizationId: string;
    composerId?: string;
    parts: ComposerMarkupParts;
  },
) => {
  assertAuthoringJson(input.parts, AUTHORING_LIMITS.contentBytes);
  const parts = parseAuthoringValue(composerMarkupPartsSchema, input.parts);
  const composer = parts.some((part) => part.kind === 'variable')
    ? input.composerId
      ? await readComposerDefinition(db, {
          organizationId: input.organizationId,
          id: input.composerId,
          version: { kind: 'working' },
        })
      : null
    : null;
  const diagnostics: AuthoringDiagnostic[] = [];
  const html: string[] = [];
  for (const part of parts) {
    if (part.kind === 'raw_html') {
      const encoded = part.html.replace(/</g, '&lt;').replace(/>/g, '&gt;');
      html.push(
        `<div data-html-block=""${encoded ? ` data-raw-html="${attribute(encoded)}"` : ''}></div>`,
      );
    } else if (part.kind === 'variable') {
      const field = composer?.definition.config.schema.find(
        (field) => field.id === part.fieldId,
      );
      if (!field)
        throw new AuthoringError(
          'invalid_input',
          'Variable markup requires an accessible composer and a field ID from its working schema.',
        );
      html.push(
        `<span data-field-id="${attribute(field.id)}" data-field-path="${attribute(field.name)}" data-variable-ref=""></span>`,
      );
    } else {
      const prompt = await readPromptDefinition(db, {
        organizationId: input.organizationId,
        id: part.promptId,
        version: part.versionId
          ? { kind: 'published', versionId: part.versionId }
          : { kind: 'working' },
      });
      const pin = part.versionId
        ? ` data-prompt-version-id="${attribute(part.versionId)}" data-prompt-version-label="${attribute(prompt.version.version ?? '')}"`
        : '';
      html.push(
        `<span data-prompt-id="${attribute(part.promptId)}" data-prompt-name="${attribute(prompt.definition.name)}"${pin} data-prompt-ref=""></span>`,
      );
    }
  }
  const result = { html: html.join(''), diagnostics };
  assertAuthoringJson(result, AUTHORING_LIMITS.contentBytes);
  return result;
};
