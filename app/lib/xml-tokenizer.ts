export type TokenType =
  | 'text'
  | 'variable'
  | 'tag'
  | 'attr-name'
  | 'attr-value';

export type Token = { type: TokenType; value: string };

const XML_DETECT = /<\/?[a-zA-Z][\w.-]*[\s>/]/;

export const containsXml = (text: string): boolean => XML_DETECT.test(text);

export const tokenize = (text: string): Token[] => {
  const tokens: Token[] = [];
  let i = 0;

  const push = (type: TokenType, value: string) => {
    if (value.length > 0) {
      tokens.push({ type, value });
    }
  };

  const flushText = (buf: string) => {
    push('text', buf);
  };

  while (i < text.length) {
    // 1. Variable — always wins
    if (text[i] === '$' && text[i + 1] === '{') {
      const end = text.indexOf('}', i + 2);
      if (end !== -1) {
        push('variable', text.slice(i, end + 1));
        i = end + 1;
        continue;
      }
    }

    // 2. XML tag — <letter or </letter
    if (
      text[i] === '<' &&
      (isLetter(text[i + 1]) || (text[i + 1] === '/' && isLetter(text[i + 2])))
    ) {
      i = parseTag(text, i, tokens);
      continue;
    }

    // 3. Plain text — accumulate until next < or ${
    let buf = '';
    while (i < text.length) {
      if (text[i] === '$' && text[i + 1] === '{') break;
      if (
        text[i] === '<' &&
        (isLetter(text[i + 1]) ||
          (text[i + 1] === '/' && isLetter(text[i + 2])))
      )
        break;
      buf += text[i];
      i++;
    }
    flushText(buf);
  }

  return tokens;
};

const isLetter = (ch: string | undefined): boolean => {
  if (!ch) return false;
  const c = ch.charCodeAt(0);
  return (c >= 65 && c <= 90) || (c >= 97 && c <= 122);
};

const isTagNameChar = (ch: string | undefined): boolean => {
  if (!ch) return false;
  const c = ch.charCodeAt(0);
  return (
    (c >= 65 && c <= 90) || // A-Z
    (c >= 97 && c <= 122) || // a-z
    (c >= 48 && c <= 57) || // 0-9
    c === 45 || // -
    c === 46 || // .
    c === 95 // _
  );
};

const isAttrNameChar = (ch: string | undefined): boolean => {
  if (!ch) return false;
  const c = ch.charCodeAt(0);
  return (
    (c >= 65 && c <= 90) ||
    (c >= 97 && c <= 122) ||
    (c >= 48 && c <= 57) ||
    c === 45 ||
    c === 46 ||
    c === 95 ||
    c === 58 // : for namespaced attrs
  );
};

const parseTag = (text: string, start: number, tokens: Token[]): number => {
  let i = start;
  const push = (type: TokenType, value: string) => {
    if (value.length > 0) {
      tokens.push({ type, value });
    }
  };

  // Closing tag: </tagName>
  if (text[i + 1] === '/') {
    let j = i + 2;
    while (j < text.length && isTagNameChar(text[j])) j++;
    // Skip whitespace before >
    while (
      j < text.length &&
      (text[j] === ' ' || text[j] === '\t' || text[j] === '\n')
    )
      j++;
    if (j < text.length && text[j] === '>') {
      push('tag', text.slice(i, j + 1));
      return j + 1;
    }
    // No closing >, emit what we have as tag
    push('tag', text.slice(i, j));
    return j;
  }

  // Opening/self-closing tag: <tagName ...>
  // Emit <tagName
  let j = i + 1;
  while (j < text.length && isTagNameChar(text[j])) j++;
  push('tag', text.slice(i, j));
  i = j;

  // Parse attributes and find closing > or />
  while (i < text.length) {
    // Whitespace → text
    if (text[i] === ' ' || text[i] === '\t' || text[i] === '\n') {
      let ws = '';
      while (
        i < text.length &&
        (text[i] === ' ' || text[i] === '\t' || text[i] === '\n')
      ) {
        ws += text[i];
        i++;
      }
      push('text', ws);
      continue;
    }

    // Self-closing />
    if (text[i] === '/' && text[i + 1] === '>') {
      push('tag', '/>');
      return i + 2;
    }

    // Closing >
    if (text[i] === '>') {
      push('tag', '>');
      return i + 1;
    }

    // Variable inside tag
    if (text[i] === '$' && text[i + 1] === '{') {
      const end = text.indexOf('}', i + 2);
      if (end !== -1) {
        push('variable', text.slice(i, end + 1));
        i = end + 1;
        continue;
      }
    }

    // Attribute name
    if (isAttrNameChar(text[i])) {
      let name = '';
      while (i < text.length && isAttrNameChar(text[i])) {
        name += text[i];
        i++;
      }
      push('attr-name', name);

      // = sign
      if (i < text.length && text[i] === '=') {
        push('tag', '=');
        i++;

        // Attribute value (quoted)
        if (i < text.length && (text[i] === '"' || text[i] === "'")) {
          const quote = text[i];
          i = parseAttrValue(text, i, quote, tokens);
        }
      }
      continue;
    }

    // Anything else inside the tag — just emit as text and move on
    // This handles graceful degradation for malformed tags
    push('text', text[i]);
    i++;
  }

  // Reached end of text without finding closing >
  return i;
};

const parseAttrValue = (
  text: string,
  start: number,
  quote: string,
  tokens: Token[],
): number => {
  let i = start;
  const push = (type: TokenType, value: string) => {
    if (value.length > 0) {
      tokens.push({ type, value });
    }
  };

  // Opening quote
  push('tag', quote);
  i++;

  let buf = '';
  while (i < text.length && text[i] !== quote) {
    // Variable inside attribute value
    if (text[i] === '$' && text[i + 1] === '{') {
      const end = text.indexOf('}', i + 2);
      if (end !== -1) {
        push('attr-value', buf);
        buf = '';
        push('variable', text.slice(i, end + 1));
        i = end + 1;
        continue;
      }
    }
    buf += text[i];
    i++;
  }

  push('attr-value', buf);

  // Closing quote
  if (i < text.length && text[i] === quote) {
    push('tag', quote);
    i++;
  }

  return i;
};
