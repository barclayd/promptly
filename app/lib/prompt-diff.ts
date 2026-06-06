/**
 * Token-level diff engine for the Compare Versions page.
 *
 * Computes word-level differences between a baseline text and a candidate
 * version, returning an ordered op list the renderer turns into highlighter
 * marks. Pure TS, no dependencies.
 */

export type DiffOpType = 'equal' | 'insert' | 'delete';

export type DiffOp = {
  type: DiffOpType;
  text: string;
};

/**
 * Split into tokens, keeping whitespace runs as their own tokens so the text
 * reconstructs exactly. Words + punctuation stay glued (good enough for prose).
 */
export const tokenize = (text: string): string[] => {
  if (!text) return [];
  return text.match(/\s+|[^\s]+/g) ?? [];
};

export const isSpace = (token: string): boolean => /^\s+$/.test(token);

/**
 * Classic LCS over the token arrays → ordered ops.
 * a = baseline tokens, b = version tokens.
 */
export const diffTokens = (a: string[], b: string[]): DiffOp[] => {
  const n = a.length;
  const m = b.length;
  // DP table of LCS lengths.
  const dp = Array.from({ length: n + 1 }, () => new Int32Array(m + 1));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      if (a[i] === b[j]) {
        dp[i][j] = dp[i + 1][j + 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i + 1][j], dp[i][j + 1]);
      }
    }
  }
  const ops: DiffOp[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      ops.push({ type: 'equal', text: b[j] });
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      ops.push({ type: 'delete', text: a[i] });
      i++;
    } else {
      ops.push({ type: 'insert', text: b[j] });
      j++;
    }
  }
  while (i < n) {
    ops.push({ type: 'delete', text: a[i] });
    i++;
  }
  while (j < m) {
    ops.push({ type: 'insert', text: b[j] });
    j++;
  }
  return ops;
};

/** Diff candidate text vs baseline text. Returns the ordered op list. */
export const computeDiff = (
  baselineText: string,
  versionText: string,
): DiffOp[] => diffTokens(tokenize(baselineText), tokenize(versionText));
