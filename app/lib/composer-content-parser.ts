/**
 * Parses Tiptap HTML content containing <span data-prompt-ref data-prompt-id="..."> elements.
 * Must work in Cloudflare Workers (no DOM APIs) — uses regex on deterministic renderHTML output.
 */

const PROMPT_REF_TAG_REGEX =
  /<span[^>]*\sdata-prompt-ref(?:="[^"]*")?[^>]*\sdata-prompt-id="([a-zA-Z0-9_-]+)"[^>]*><\/span>/g;

const PROMPT_REF_TAG_ALT_REGEX =
  /<span[^>]*\sdata-prompt-id="([a-zA-Z0-9_-]+)"[^>]*\sdata-prompt-ref(?:="[^"]*")?[^>]*><\/span>/g;

export type ComposerSegment =
  | { type: 'static'; content: string }
  | { type: 'prompt'; promptId: string };

export const parseComposerContent = (content: string): ComposerSegment[] => {
  const segments: ComposerSegment[] = [];
  let lastIndex = 0;

  // Collect all matches from both attribute orderings
  const matches: Array<{ index: number; length: number; promptId: string }> =
    [];

  for (const match of content.matchAll(PROMPT_REF_TAG_REGEX)) {
    matches.push({
      index: match.index,
      length: match[0].length,
      promptId: match[1],
    });
  }

  for (const match of content.matchAll(PROMPT_REF_TAG_ALT_REGEX)) {
    // Avoid duplicates from overlapping patterns
    if (!matches.some((m) => m.index === match.index)) {
      matches.push({
        index: match.index,
        length: match[0].length,
        promptId: match[1],
      });
    }
  }

  // Sort by position in the string
  matches.sort((a, b) => a.index - b.index);

  for (const match of matches) {
    if (match.index > lastIndex) {
      segments.push({
        type: 'static',
        content: content.slice(lastIndex, match.index),
      });
    }

    segments.push({ type: 'prompt', promptId: match.promptId });
    lastIndex = match.index + match.length;
  }

  if (lastIndex < content.length) {
    segments.push({ type: 'static', content: content.slice(lastIndex) });
  }

  return segments;
};

const PROMPT_ID_REGEX = /data-prompt-id="([a-zA-Z0-9_-]+)"/g;

export const extractPromptIds = (content: string): string[] => {
  const ids = new Set<string>();
  for (const match of content.matchAll(PROMPT_ID_REGEX)) {
    ids.add(match[1]);
  }
  return [...ids];
};

const VARIABLE_FIELD_ID_REGEX = /data-field-id="([a-zA-Z0-9_-]+)"/g;

export const extractVariableIds = (content: string): string[] => {
  const ids = new Set<string>();
  for (const match of content.matchAll(VARIABLE_FIELD_ID_REGEX)) {
    ids.add(match[1]);
  }
  return [...ids];
};
