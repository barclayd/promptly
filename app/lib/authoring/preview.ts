import {
  parseComposerContent,
  replaceVariableRefs,
} from '../composer-content-parser';
import { reconstructFullData } from '../input-data-utils';
import { getNestedValue, preparePrompts } from '../prompt-interpolation';
import type {
  ComposerDefinition,
  PromptDefinition,
} from '../validations/authoring';
import { validateAuthoringInput as validateInput } from './input-validation';
import { assertAuthoringJson } from './normalize';
import { inspectComposerReadiness, inspectPromptReadiness } from './readiness';
import type { AuthoringDiagnostic } from './types';

export type AuthoringPreviewInput =
  | { source: 'supplied'; data: unknown; rootName?: string | null }
  | { source: 'saved_sample' }
  | { source: 'empty' };

const previewDiagnostic = (
  code: string,
  path: (string | number)[],
  message: string,
): AuthoringDiagnostic => ({ code, path, message, severity: 'error' });

export const validateAuthoringInput = validateInput;

const chooseInput = (
  config: PromptDefinition['config'] | ComposerDefinition['config'],
  input: AuthoringPreviewInput,
) =>
  input.source === 'saved_sample'
    ? { data: config.inputData, rootName: config.inputDataRootName }
    : input.source === 'supplied'
      ? { data: input.data, rootName: input.rootName ?? null }
      : { data: {}, rootName: null };

export const preparePromptPreview = (
  definition: PromptDefinition,
  input: AuthoringPreviewInput,
  snippets: readonly { snippetId: string; content: string }[] = [],
) => {
  const selected = chooseInput(definition.config, input);
  const diagnostics = [
    ...inspectPromptReadiness(definition, { snippets }),
    ...validateAuthoringInput(
      definition.config.schema,
      selected.data,
      selected.rootName,
    ),
  ];
  const prefix = snippets
    .filter((snippet) => snippet.content !== '')
    .map((snippet) => snippet.content)
    .join('\n\n');
  const systemTemplate =
    (prefix ? `${prefix}\n\n` : '') + definition.systemMessage;
  const prepared = preparePrompts({
    systemMessage: systemTemplate,
    userMessage: definition.userMessage,
    inputDataJson: JSON.stringify(selected.data),
    inputDataRootName: selected.rootName,
  });
  for (const [field, text] of [
    ['systemMessage', systemTemplate],
    ['userMessage', definition.userMessage],
  ])
    if (
      [...text.matchAll(/\$\{([^}]+)\}/g)].some(
        (match) =>
          getNestedValue(
            reconstructFullData(selected.data, selected.rootName),
            match[1],
          ) === undefined,
      )
    )
      diagnostics.push(
        previewDiagnostic(
          'unresolved_input_value',
          [field],
          'A referenced input value is missing; the placeholder remains visible in the preview.',
        ),
      );
  const result = {
    valid: diagnostics.every((entry) => entry.severity !== 'error'),
    systemMessage: prepared.systemMessage,
    userMessage: prepared.userMessage,
    unusedFields: prepared.unusedFields,
    diagnostics,
    inputSource: input.source,
    executed: false as const,
  };
  assertAuthoringJson(result);
  return result;
};

export type ComposerPreviewSegment =
  | { kind: 'html'; html: string }
  | { kind: 'prompt_placeholder'; promptId: string; label: string };

export const prepareComposerPreview = (
  definition: ComposerDefinition,
  input: AuthoringPreviewInput,
  prompts: readonly { promptId: string; definition: PromptDefinition }[] = [],
) => {
  const selected = chooseInput(definition.config, input);
  const diagnostics = [
    ...inspectComposerReadiness(definition, { prompts }),
    ...validateAuthoringInput(
      definition.config.schema,
      selected.data,
      selected.rootName,
    ),
  ];
  const names = new Map(
    prompts.map((prompt) => [prompt.promptId, prompt.definition.name]),
  );
  for (const prompt of prompts)
    diagnostics.push(
      ...validateAuthoringInput(
        prompt.definition.config.schema,
        selected.data,
        selected.rootName,
      ).map((entry) => ({
        ...entry,
        path: ['references', prompt.promptId, ...entry.path],
      })),
    );
  const segments: ComposerPreviewSegment[] = [];
  const append = (html: string, depth = 0) => {
    if (depth > 8) {
      diagnostics.push(
        previewDiagnostic(
          'preview_nesting_limit',
          ['content'],
          'Raw HTML blocks exceed the preview nesting limit.',
        ),
      );
      return;
    }
    for (const segment of parseComposerContent(html)) {
      if (segment.type === 'html_block') append(segment.innerHtml, depth + 1);
      else if (segment.type === 'prompt')
        segments.push({
          kind: 'prompt_placeholder',
          promptId: segment.promptId,
          label: `Generated output from ${names.get(segment.promptId) ?? segment.promptId} (not executed)`,
        });
      else {
        let unresolved = false;
        const resolved = replaceVariableRefs(
          segment.content,
          selected.data,
          selected.rootName,
          () => {
            unresolved = true;
          },
        );
        if (unresolved)
          diagnostics.push(
            previewDiagnostic(
              'unresolved_input_value',
              ['content'],
              'A composer input value is missing.',
            ),
          );
        segments.push({ kind: 'html', html: resolved });
      }
    }
  };
  append(definition.content);
  const result = {
    valid: diagnostics.every((entry) => entry.severity !== 'error'),
    segments,
    diagnostics,
    inputSource: input.source,
    executed: false as const,
    rendering:
      'HTML is returned as data. Display it as text or in a sandbox that prohibits scripts, navigation, forms, and network requests.',
  };
  assertAuthoringJson(result);
  return result;
};
