import { useEffect, useRef, useState } from 'react';

type CodeBlockProps = {
  code: string;
  delay?: number;
  charDelay?: number;
  onComplete?: () => void;
  onProgress?: (chars: number) => void;
  showLineNumbers?: boolean;
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
  onProgress,
  showLineNumbers = false,
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
        onProgress?.(charIndex);
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
  }, [code, delay, charDelay, onComplete, onProgress]);

  // Build displayed tokens
  let remainingChars = displayedChars;
  const displayedTokens: { token: Token; chars: number }[] = [];

  for (const token of tokens) {
    if (remainingChars <= 0) break;
    const charsToShow = Math.min(remainingChars, token.text.length);
    displayedTokens.push({ token, chars: charsToShow });
    remainingChars -= charsToShow;
  }

  // Get the displayed text for line number calculation
  const displayedText = code.slice(0, displayedChars);
  const lines = displayedText.split('\n');
  const lineCount = lines.length;

  // Calculate total lines in the full code for line number width
  const totalLines = code.split('\n').length;
  const lineNumberWidth = String(totalLines).length;

  if (showLineNumbers) {
    // Only render line numbers for lines that have been typed to
    // This ensures the content height grows naturally as typing progresses
    const visibleLineCount = displayedChars > 0 ? lineCount : 1;

    return (
      <pre
        className={`font-mono text-xs leading-relaxed bg-zinc-950 ${className || ''}`}
      >
        <div className="flex">
          {/* Line numbers gutter - only render lines we've typed to */}
          <div className="flex-shrink-0 pr-3 mr-3 border-r border-zinc-800 text-zinc-600 select-none text-right">
            {Array.from({ length: visibleLineCount }, (_, lineIndex) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: Line numbers are static and ordered
              <div key={lineIndex} style={{ minWidth: `${lineNumberWidth}ch` }}>
                {lineIndex + 1}
              </div>
            ))}
          </div>

          {/* Code content */}
          <code className="flex-1 overflow-hidden">
            {displayedTokens.map((dt, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: Tokens are rendered in sequence
              <span key={i} className={getTokenColor(dt.token.type)}>
                {dt.token.text.slice(0, dt.chars)}
              </span>
            ))}
            <span
              className="inline-block w-0.5 h-[1.1em] bg-zinc-400 rounded-sm align-middle ml-0.5"
              style={{ animation: 'blink 1s step-end infinite' }}
            />
          </code>
        </div>
      </pre>
    );
  }

  return (
    <pre
      className={`font-mono text-xs leading-relaxed bg-zinc-950 rounded-lg p-3 overflow-hidden ${className || ''}`}
    >
      <code>
        {displayedTokens.map((dt, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: Tokens are rendered in sequence
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
