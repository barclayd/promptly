import {
  AUTHORING_LIMITS,
  type ComposerAuthoringEditInput,
  type ComposerDefinition,
  composerAuthoringEditSchema,
  type PromptAuthoringEditInput,
  type PromptDefinition,
  promptAuthoringEditSchema,
} from '../validations/authoring';
import {
  assertAuthoringJson,
  normalizeComposerDefinition,
  normalizePromptDefinition,
  parseAuthoringValue,
} from './normalize';
import { AuthoringError } from './types';

type TextReplacement<Field extends string> = {
  field: Field;
  oldText: string;
  newText: string;
};

const replaceExactText = <Field extends string>(
  source: Record<Field, string>,
  replacements: TextReplacement<Field>[],
  changedFields: string[],
): Partial<Record<Field, string>> => {
  const result: Partial<Record<Field, string>> = {};
  const spans: { field: Field; start: number; end: number; newText: string }[] =
    [];
  for (const [index, replacement] of replacements.entries()) {
    const text = source[replacement.field];
    const start = text.indexOf(replacement.oldText);
    if (changedFields.includes(replacement.field))
      throw new AuthoringError(
        'invalid_input',
        'A content field cannot be both replaced and edited in the same request.',
        [
          {
            code: 'conflicting_edit',
            severity: 'error',
            path: ['replacements', index, 'field'],
            message: 'Remove the replacement or the full field change.',
          },
        ],
      );
    if (start === -1 || text.indexOf(replacement.oldText, start + 1) !== -1)
      throw new AuthoringError(
        'invalid_input',
        'Each text replacement must match exactly once in the original content.',
        [
          {
            code:
              start === -1 ? 'replacement_not_found' : 'replacement_ambiguous',
            severity: 'error',
            path: ['replacements', index, 'oldText'],
            message:
              'Read the current content and provide a unique exact source string.',
          },
        ],
      );
    const end = start + replacement.oldText.length;
    if (
      spans.some(
        (span) =>
          span.field === replacement.field &&
          start < span.end &&
          end > span.start,
      )
    )
      throw new AuthoringError(
        'invalid_input',
        'Text replacements must not overlap.',
        [
          {
            code: 'overlapping_replacements',
            severity: 'error',
            path: ['replacements', index],
            message:
              'Combine overlapping replacements into one exact source edit.',
          },
        ],
      );
    spans.push({
      field: replacement.field,
      start,
      end,
      newText: replacement.newText,
    });
  }
  for (const span of spans.toSorted((a, b) => b.start - a.start)) {
    const text = result[span.field] ?? source[span.field];
    result[span.field] =
      text.slice(0, span.start) + span.newText + text.slice(span.end);
  }
  return result;
};

export const applyPromptEdits = (
  current: PromptDefinition,
  rawEdit: PromptAuthoringEditInput,
) => {
  assertAuthoringJson(rawEdit);
  const edit = parseAuthoringValue(promptAuthoringEditSchema, rawEdit);
  if (edit.mode === 'replace')
    return normalizePromptDefinition(edit.definition);
  const changes = edit.changes ?? {};
  const replacements = replaceExactText(
    current,
    edit.replacements ?? [],
    Object.keys(changes),
  );
  return normalizePromptDefinition({
    ...current,
    ...changes,
    ...replacements,
    config: { ...current.config, ...changes.config },
  });
};

export const applyComposerEdits = (
  current: ComposerDefinition,
  rawEdit: ComposerAuthoringEditInput,
) => {
  assertAuthoringJson(rawEdit);
  const edit = parseAuthoringValue(composerAuthoringEditSchema, rawEdit);
  if (edit.mode === 'replace')
    return normalizeComposerDefinition(edit.definition);
  const changes = edit.changes ?? {};
  const replacements = replaceExactText(
    current,
    edit.replacements ?? [],
    Object.keys(changes),
  );
  return normalizeComposerDefinition({
    ...current,
    ...changes,
    ...replacements,
    config: { ...current.config, ...changes.config },
  });
};

const canonicalJson = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value !== null && typeof value === 'object')
    return `{${Object.entries(value)
      .toSorted(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([key, entry]) => `${JSON.stringify(key)}:${canonicalJson(entry)}`)
      .join(',')}}`;
  const serialized = JSON.stringify(value);
  if (serialized === undefined)
    throw new AuthoringError(
      'invalid_input',
      'Request intent must contain JSON values.',
    );
  return serialized;
};

export const canonicalAuthoringRequestHash = async (
  intent: unknown,
): Promise<string> => {
  assertAuthoringJson(intent, AUTHORING_LIMITS.definitionBytes + 8192);
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(canonicalJson(intent)),
  );
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('');
};
