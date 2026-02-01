import { useCallback, useEffect, useRef, useState } from 'react';

type CodeBlockProps = {
  code: string;
  delay?: number;
  charDelay?: number;
  onComplete?: () => void;
  className?: string;
};

type Token = {
  text: string;
  type:
    | 'keyword'
    | 'string'
    | 'function'
    | 'property'
    | 'comment'
    | 'operator'
    | 'punctuation'
    | 'variable'
    | 'text';
};

const tokenize = (code: string): Token[] => {
  const tokens: Token[] = [];
  const regex =
    /('.*?'|".*?"|`.*?`)|(\b(?:import|export|const|let|var|async|await|from|return|function|type|interface)\b)|(\b\w+)(?=\s*\()|(\b\w+)(?=\s*:)|([{}();,.:=<>])|(\s+)|(.)/g;

  let match: RegExpExecArray | null = regex.exec(code);
  while (match !== null) {
    if (match[1]) {
      tokens.push({ text: match[0], type: 'string' });
    } else if (match[2]) {
      tokens.push({ text: match[0], type: 'keyword' });
    } else if (match[3]) {
      tokens.push({ text: match[0], type: 'function' });
    } else if (match[4]) {
      tokens.push({ text: match[0], type: 'property' });
    } else if (match[5]) {
      tokens.push({ text: match[0], type: 'punctuation' });
    } else {
      tokens.push({ text: match[0], type: 'text' });
    }
    match = regex.exec(code);
  }

  return tokens;
};

const getTokenColor = (type: Token['type']): string => {
  switch (type) {
    case 'keyword':
      return 'text-purple-400';
    case 'string':
      return 'text-emerald-400';
    case 'function':
      return 'text-yellow-300';
    case 'property':
      return 'text-sky-300';
    case 'comment':
      return 'text-zinc-500';
    case 'operator':
    case 'punctuation':
      return 'text-zinc-400';
    default:
      return 'text-zinc-100';
  }
};

export const CodeBlock = ({
  code,
  delay = 0,
  charDelay = 20,
  onComplete,
  className,
}: CodeBlockProps) => {
  const [displayedChars, setDisplayedChars] = useState(0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const tokens = tokenize(code);

  useEffect(() => {
    // Reset state on mount
    setDisplayedChars(0);
    let charIndex = 0;

    const typeNextChar = () => {
      if (charIndex < code.length) {
        charIndex++;
        setDisplayedChars(charIndex);
        timeoutRef.current = setTimeout(typeNextChar, charDelay);
      } else {
        onComplete?.();
      }
    };

    timeoutRef.current = setTimeout(typeNextChar, delay);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [code, delay, charDelay, onComplete]);

  // Build displayed tokens
  let remainingChars = displayedChars;
  const displayedTokens: { token: Token; chars: number }[] = [];

  for (const token of tokens) {
    if (remainingChars <= 0) break;
    const charsToShow = Math.min(remainingChars, token.text.length);
    displayedTokens.push({ token, chars: charsToShow });
    remainingChars -= charsToShow;
  }

  return (
    <pre
      className={`font-mono text-xs leading-relaxed bg-zinc-950 rounded-lg p-3 overflow-x-auto ${className || ''}`}
    >
      <code>
        {displayedTokens.map((dt, i) => (
          <span key={i} className={getTokenColor(dt.token.type)}>
            {dt.token.text.slice(0, dt.chars)}
          </span>
        ))}
        <span
          className="inline-block w-0.5 h-[1.1em] bg-zinc-400 rounded-sm align-middle ml-0.5"
          style={{ animation: 'blink 1s step-end infinite' }}
        />
      </code>
    </pre>
  );
};
