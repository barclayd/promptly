/**
 * Convert an HTML fragment to plain text. Workers-safe (no DOM).
 *
 * Used by the composer run flow to derive a readable preview from an
 * HTML Block's `innerHtml` for the in-app Test panel. The `innerHtml`
 * itself remains untouched and is what downstream/programmatic
 * consumers receive.
 */

const HTML_COMMENT_REGEX = /<!--[\s\S]*?-->/g;
const BLOCK_END_REGEX =
  /<\/(p|div|h[1-6]|li|tr|td|th|blockquote|article|section|header|footer|ul|ol|table)>/gi;
const BR_REGEX = /<br\s*\/?>/gi;
const TAG_REGEX = /<[^>]+>/g;

const NAMED_ENTITY_MAP: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&apos;': "'",
  '&#39;': "'",
  '&nbsp;': ' ',
  '&emsp;': '  ',
  '&ensp;': ' ',
  '&copy;': '©',
  '&reg;': '®',
  '&trade;': '™',
  '&hellip;': '…',
  '&mdash;': '—',
  '&ndash;': '–',
};
const NAMED_ENTITY_REGEX =
  /&(?:amp|lt|gt|quot|apos|#39|nbsp|emsp|ensp|copy|reg|trade|hellip|mdash|ndash);/g;
const NUMERIC_ENTITY_REGEX = /&#(\d+);/g;
const HEX_ENTITY_REGEX = /&#x([0-9a-fA-F]+);/g;

const INLINE_WHITESPACE_REGEX = /[ \t]+/g;
const NEWLINE_COLLAPSE_REGEX = /\n{3,}/g;

export const htmlToPlainText = (html: string): string => {
  let out = html;
  out = out.replace(HTML_COMMENT_REGEX, '');
  out = out.replace(BR_REGEX, '\n');
  out = out.replace(BLOCK_END_REGEX, '\n');
  out = out.replace(TAG_REGEX, '');
  out = out.replace(
    NAMED_ENTITY_REGEX,
    (match) => NAMED_ENTITY_MAP[match] ?? match,
  );
  out = out.replace(NUMERIC_ENTITY_REGEX, (_match, code: string) => {
    const num = Number(code);
    return Number.isFinite(num) ? String.fromCodePoint(num) : _match;
  });
  out = out.replace(HEX_ENTITY_REGEX, (_match, code: string) => {
    const num = Number.parseInt(code, 16);
    return Number.isFinite(num) ? String.fromCodePoint(num) : _match;
  });
  out = out.replace(INLINE_WHITESPACE_REGEX, ' ');
  out = out.replace(NEWLINE_COLLAPSE_REGEX, '\n\n');
  return out
    .split('\n')
    .map((line) => line.trim())
    .join('\n')
    .trim();
};
