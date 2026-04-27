/**
 * Parses Tiptap HTML content containing <span data-prompt-ref data-prompt-id="..."> elements.
 * Must work in Cloudflare Workers (no DOM APIs) — uses regex on deterministic renderHTML output.
 */

import { reconstructFullData } from './input-data-utils';
import { formatValue, getNestedValue } from './prompt-interpolation';

const PROMPT_REF_TAG_REGEX =
  /<span[^>]*\sdata-prompt-ref(?:="[^"]*")?[^>]*\sdata-prompt-id="([a-zA-Z0-9_-]+)"[^>]*><\/span>/g;

const PROMPT_REF_TAG_ALT_REGEX =
  /<span[^>]*\sdata-prompt-id="([a-zA-Z0-9_-]+)"[^>]*\sdata-prompt-ref(?:="[^"]*")?[^>]*><\/span>/g;

export type ComposerSegment =
  | { type: 'static'; content: string }
  | { type: 'prompt'; promptId: string }
  | { type: 'html_block'; innerHtml: string };

const HTML_BLOCK_OPEN_REGEX =
  /<div\b[^>]*\sdata-html-block(?:="[^"]*")?[^>]*>/gi;

const RAW_HTML_ATTR_REGEX = /\sdata-raw-html="([^"]*)"/i;

// Decodes a `data-raw-html` attribute value as it appears in the
// serialized HTML string. Two layers of encoding are present:
//   1. Browser's HTML-attribute serialization: `&` → `&amp;`, `"` → `&quot;`
//   2. The extension's pre-encoding: `<` → `&lt;`, `>` → `&gt;`
// The browser's layer is undone first so that `&amp;lt;` becomes `&lt;`
// before being recognised by the inner-layer rule.
const decodeHtmlAttr = (s: string): string =>
  s
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'");

// Scans the document for <div data-html-block ...> ... </div> ranges.
// New format stores the payload in a `data-raw-html` attribute on the
// wrapper, which we extract and decode directly. Legacy blocks (no
// attribute) keep the depth-tracking scanner that walks <div> nesting
// and skips HTML comments so MSO conditional comments don't break
// matching.
const findHtmlBlockRanges = (
  content: string,
): Array<{ start: number; end: number; innerHtml: string }> => {
  const ranges: Array<{ start: number; end: number; innerHtml: string }> = [];
  HTML_BLOCK_OPEN_REGEX.lastIndex = 0;
  let openMatch: RegExpExecArray | null = HTML_BLOCK_OPEN_REGEX.exec(content);

  while (openMatch !== null) {
    const blockStart = openMatch.index;
    const innerStart = blockStart + openMatch[0].length;

    const rawAttrMatch = openMatch[0].match(RAW_HTML_ATTR_REGEX);
    if (rawAttrMatch) {
      const closeIdx = content.indexOf('</div>', innerStart);
      if (closeIdx === -1) {
        HTML_BLOCK_OPEN_REGEX.lastIndex = innerStart;
        openMatch = HTML_BLOCK_OPEN_REGEX.exec(content);
        continue;
      }
      const blockEnd = closeIdx + '</div>'.length;
      ranges.push({
        start: blockStart,
        end: blockEnd,
        innerHtml: decodeHtmlAttr(rawAttrMatch[1]),
      });
      HTML_BLOCK_OPEN_REGEX.lastIndex = blockEnd;
      openMatch = HTML_BLOCK_OPEN_REGEX.exec(content);
      continue;
    }

    let i = innerStart;
    let depth = 1;
    let matched = false;

    while (i < content.length) {
      if (content.startsWith('<!--', i)) {
        const commentEnd = content.indexOf('-->', i + 4);
        if (commentEnd === -1) break;
        i = commentEnd + 3;
        continue;
      }

      if (content[i] !== '<') {
        i++;
        continue;
      }

      const lower3 = content.slice(i, i + 5).toLowerCase();
      if (lower3.startsWith('<div') && /[\s/>]/.test(content[i + 4] ?? '')) {
        const tagClose = content.indexOf('>', i);
        if (tagClose === -1) break;
        const isSelfClosing = content[tagClose - 1] === '/';
        if (!isSelfClosing) depth++;
        i = tagClose + 1;
        continue;
      }

      if (lower3.startsWith('</div')) {
        const tagClose = content.indexOf('>', i);
        if (tagClose === -1) break;
        depth--;
        if (depth === 0) {
          ranges.push({
            start: blockStart,
            end: tagClose + 1,
            innerHtml: content.slice(innerStart, i),
          });
          HTML_BLOCK_OPEN_REGEX.lastIndex = tagClose + 1;
          matched = true;
          break;
        }
        i = tagClose + 1;
        continue;
      }

      i++;
    }

    if (!matched) {
      // Bail on this open tag — advance regex past it so we don't loop.
      HTML_BLOCK_OPEN_REGEX.lastIndex = innerStart;
    }
    openMatch = HTML_BLOCK_OPEN_REGEX.exec(content);
  }

  return ranges;
};

const splitOnPromptRefs = (
  content: string,
  baseOffset: number,
): ComposerSegment[] => {
  const segments: ComposerSegment[] = [];
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
    if (!matches.some((m) => m.index === match.index)) {
      matches.push({
        index: match.index,
        length: match[0].length,
        promptId: match[1],
      });
    }
  }

  matches.sort((a, b) => a.index - b.index);

  let lastIndex = 0;
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

  // baseOffset is currently unused but kept for future positional metadata.
  void baseOffset;
  return segments;
};

export const parseComposerContent = (content: string): ComposerSegment[] => {
  const htmlRanges = findHtmlBlockRanges(content);
  if (htmlRanges.length === 0) {
    return splitOnPromptRefs(content, 0);
  }

  const segments: ComposerSegment[] = [];
  let cursor = 0;
  for (const range of htmlRanges) {
    if (range.start > cursor) {
      segments.push(
        ...splitOnPromptRefs(content.slice(cursor, range.start), cursor),
      );
    }
    segments.push({ type: 'html_block', innerHtml: range.innerHtml });
    cursor = range.end;
  }

  if (cursor < content.length) {
    segments.push(...splitOnPromptRefs(content.slice(cursor), cursor));
  }

  return segments;
};

const PROMPT_ID_REGEX = /data-prompt-id="([a-zA-Z0-9_-]+)"/g;

// Yields the top-level content plus the decoded innerHtml of every
// html_block range, so regex extractors can find chips that are
// embedded (and therefore entity-escaped) inside a data-raw-html
// attribute. Without this, chips placed inside an HTML block would
// be invisible to the junction-table sync.
const collectScannableSlices = (content: string): string[] => {
  const slices = [content];
  for (const range of findHtmlBlockRanges(content)) {
    slices.push(range.innerHtml);
  }
  return slices;
};

export const extractPromptIds = (content: string): string[] => {
  const ids = new Set<string>();
  for (const slice of collectScannableSlices(content)) {
    for (const match of slice.matchAll(PROMPT_ID_REGEX)) {
      ids.add(match[1]);
    }
  }
  return [...ids];
};

const VARIABLE_FIELD_ID_REGEX = /data-field-id="([a-zA-Z0-9_-]+)"/g;

export const extractVariableIds = (content: string): string[] => {
  const ids = new Set<string>();
  for (const slice of collectScannableSlices(content)) {
    for (const match of slice.matchAll(VARIABLE_FIELD_ID_REGEX)) {
      ids.add(match[1]);
    }
  }
  return [...ids];
};

const VERSION_PIN_REGEX =
  /data-prompt-id="([a-zA-Z0-9_-]+)"[^>]*data-prompt-version-id="([a-zA-Z0-9_-]+)"/g;

const VERSION_PIN_ALT_REGEX =
  /data-prompt-version-id="([a-zA-Z0-9_-]+)"[^>]*data-prompt-id="([a-zA-Z0-9_-]+)"/g;

export const extractPromptVersionPins = (
  content: string,
): Map<string, string> => {
  const pins = new Map<string, string>();

  for (const slice of collectScannableSlices(content)) {
    for (const match of slice.matchAll(VERSION_PIN_REGEX)) {
      pins.set(match[1], match[2]);
    }

    for (const match of slice.matchAll(VERSION_PIN_ALT_REGEX)) {
      // Alt ordering: version-id first, then prompt-id
      if (!pins.has(match[2])) {
        pins.set(match[2], match[1]);
      }
    }
  }

  return pins;
};

const VARIABLE_REF_TAG_REGEX =
  /<span[^>]*\sdata-variable-ref(?:="[^"]*")?[^>]*\sdata-field-path="([^"]+)"[^>]*><\/span>/g;

const VARIABLE_REF_TAG_ALT_REGEX =
  /<span[^>]*\sdata-field-path="([^"]+)"[^>]*\sdata-variable-ref(?:="[^"]*")?[^>]*><\/span>/g;

const HREF_VARIABLE_REGEX = /href="([^"]*\{\{[^"]*\}\}[^"]*)"/g;
const MUSTACHE_REGEX = /\{\{([^}]+)\}\}/g;

export const replaceVariableRefs = (
  html: string,
  inputData: unknown,
  rootName: string | null,
): string => {
  const data = reconstructFullData(inputData, rootName);

  const replace = (_match: string, fieldPath: string): string => {
    const value = getNestedValue(data, fieldPath);
    if (value === undefined) return _match;
    return formatValue(value);
  };

  let result = html.replace(VARIABLE_REF_TAG_REGEX, replace);
  result = result.replace(VARIABLE_REF_TAG_ALT_REGEX, replace);

  // Also resolve {{fieldPath}} mustache templates inside href attributes
  result = result.replace(HREF_VARIABLE_REGEX, (_match, hrefValue: string) => {
    const resolved = hrefValue.replace(
      MUSTACHE_REGEX,
      (_m: string, fieldPath: string) => {
        const value = getNestedValue(data, fieldPath);
        if (value === undefined) return _m;
        return encodeURIComponent(formatValue(value));
      },
    );
    return `href="${resolved}"`;
  });

  return result;
};
