import type { AuthoringReadInput } from '../validations/authoring';
import {
  loadAuthoringSnippetContents,
  loadComposerPromptDependencies,
} from './dependencies.server';
import {
  type AuthoringPreviewInput,
  prepareComposerPreview,
  preparePromptPreview,
} from './preview';
import { inspectComposerReadiness, inspectPromptReadiness } from './readiness';
import { getComposer, getPrompt } from './reads.server';
import type { AuthoringDiagnostic } from './types';

type PreviewRequest = AuthoringReadInput & { input: AuthoringPreviewInput };

const readInput = ({
  organizationId,
  id,
  version,
}: AuthoringReadInput): AuthoringReadInput => ({ organizationId, id, version });

const uniqueDiagnostics = (diagnostics: readonly AuthoringDiagnostic[]) => [
  ...new Map(
    diagnostics.map((entry) => [JSON.stringify(entry), entry]),
  ).values(),
];

export const previewPrompt = async (db: D1Database, input: PreviewRequest) => {
  const document = await getPrompt(db, readInput(input));
  const snippets = await loadAuthoringSnippetContents(
    db,
    input.organizationId,
    document.dependencies,
  );
  const prepared = preparePromptPreview(
    document.definition,
    input.input,
    snippets,
  );
  const diagnostics = uniqueDiagnostics([
    ...document.diagnostics,
    ...prepared.diagnostics,
  ]);
  return {
    ...prepared,
    metadata: document.metadata,
    version: document.version,
    dependencies: document.dependencies,
    diagnostics,
    valid: diagnostics.every((entry) => entry.severity !== 'error'),
  };
};

export const validatePrompt = async (
  db: D1Database,
  input: AuthoringReadInput,
) => {
  const document = await getPrompt(db, input);
  const snippets = await loadAuthoringSnippetContents(
    db,
    input.organizationId,
    document.dependencies,
  );
  const diagnostics = uniqueDiagnostics([
    ...document.diagnostics,
    ...inspectPromptReadiness(document.definition, { snippets }),
  ]);
  return {
    metadata: document.metadata,
    version: document.version,
    dependencies: document.dependencies,
    diagnostics,
    valid: diagnostics.every((entry) => entry.severity !== 'error'),
  };
};

const inspectComposer = async (
  db: D1Database,
  input: AuthoringReadInput,
  previewInput?: AuthoringPreviewInput,
) => {
  const document = await getComposer(db, readInput(input));
  const prompts = await loadComposerPromptDependencies(
    db,
    input.organizationId,
    document.dependencies,
  );
  const dependencyDiagnostics: AuthoringDiagnostic[] = [];
  for (const prompt of prompts) {
    const snippets = prompt.snippets;
    const selectedInput: AuthoringPreviewInput | undefined =
      previewInput?.source === 'saved_sample'
        ? {
            source: 'supplied',
            data: document.definition.config.inputData,
            rootName: document.definition.config.inputDataRootName,
          }
        : previewInput;
    const prepared = selectedInput
      ? preparePromptPreview(prompt.definition, selectedInput, snippets)
      : {
          diagnostics: inspectPromptReadiness(prompt.definition, { snippets }),
        };
    dependencyDiagnostics.push(
      ...[...prompt.diagnostics, ...prepared.diagnostics].map((entry) => ({
        ...entry,
        path: ['references', prompt.promptId, ...entry.path],
      })),
    );
  }
  return { document, prompts, dependencyDiagnostics };
};

export const validateComposer = async (
  db: D1Database,
  input: AuthoringReadInput,
) => {
  const { document, prompts, dependencyDiagnostics } = await inspectComposer(
    db,
    input,
  );
  const diagnostics = uniqueDiagnostics([
    ...document.diagnostics,
    ...dependencyDiagnostics,
    ...inspectComposerReadiness(document.definition, { prompts }),
  ]);
  return {
    metadata: document.metadata,
    version: document.version,
    dependencies: document.dependencies,
    diagnostics,
    valid: diagnostics.every((entry) => entry.severity !== 'error'),
  };
};

export const previewComposer = async (
  db: D1Database,
  input: PreviewRequest,
) => {
  const { document, prompts, dependencyDiagnostics } = await inspectComposer(
    db,
    input,
    input.input,
  );
  const prepared = prepareComposerPreview(
    document.definition,
    input.input,
    prompts,
  );
  const diagnostics = uniqueDiagnostics([
    ...document.diagnostics,
    ...dependencyDiagnostics,
    ...prepared.diagnostics,
  ]);
  return {
    ...prepared,
    metadata: document.metadata,
    version: document.version,
    dependencies: document.dependencies,
    diagnostics,
    valid: diagnostics.every((entry) => entry.severity !== 'error'),
  };
};
