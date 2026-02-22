const PROMPT_REF_REGEX = /\$\{prompt:([a-zA-Z0-9_-]+)\}/g;

export type ComposerSegment =
  | { type: 'static'; content: string }
  | { type: 'prompt'; promptId: string };

export const parseComposerContent = (content: string): ComposerSegment[] => {
  const segments: ComposerSegment[] = [];
  let lastIndex = 0;

  for (const match of content.matchAll(PROMPT_REF_REGEX)) {
    // Add static text before this match
    if (match.index > lastIndex) {
      segments.push({
        type: 'static',
        content: content.slice(lastIndex, match.index),
      });
    }

    segments.push({ type: 'prompt', promptId: match[1] });
    lastIndex = match.index + match[0].length;
  }

  // Add trailing static text
  if (lastIndex < content.length) {
    segments.push({ type: 'static', content: content.slice(lastIndex) });
  }

  return segments;
};

export const extractPromptIds = (content: string): string[] => {
  const ids = new Set<string>();
  for (const match of content.matchAll(PROMPT_REF_REGEX)) {
    ids.add(match[1]);
  }
  return [...ids];
};
