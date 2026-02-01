import { IconBrandPython, IconFileTypeTs } from '@tabler/icons-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { cn } from '~/lib/utils';

type Language = 'typescript' | 'python';

type MultiLanguageIdeDemoProps = {
  isVisible?: boolean;
};

const TYPESCRIPT_CODE = `import { getPrompt } from '@promptly/sdk';

const { text } = await getPrompt('marketing/welcome-email', {
  company_name: 'Acme Inc',
  user_name: 'Sarah',
  plan_type: 'Pro'
});

await sendEmail({
  to: user.email,
  subject: 'Welcome to Acme!',
  body: text
});`;

const PYTHON_CODE = `import requests

response = requests.get(
    f"https://app.promptlycms.com/api/prompts/get?promptId={prompt_id}",
    headers={"Authorization": f"Bearer {api_key}"},
)

data = response.json()
prompts, config = data["prompts"], data["config"]`;

const PAUSE_DURATION = 4000;
const CHAR_DELAY = 28;

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
    | 'decorator'
    | 'fstring'
    | 'text';
};

const tokenizeTypeScript = (code: string): Token[] => {
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

const tokenizePython = (code: string): Token[] => {
  const tokens: Token[] = [];
  // Handle f-strings, regular strings, keywords, functions, and punctuation
  const regex =
    /(f"[^"]*"|f'[^']*')|(".*?"|'.*?')|(#.*$)|(\b(?:import|from|as|def|class|return|if|else|elif|for|while|try|except|with|lambda|yield|raise|pass|break|continue|and|or|not|in|is|True|False|None)\b)|(\b\w+)(?=\s*\()|(@\w+)|([{}()[\];,.:=<>])|(\s+)|(.)/gm;

  let match: RegExpExecArray | null = regex.exec(code);
  while (match !== null) {
    if (match[1]) {
      // f-string
      tokens.push({ text: match[0], type: 'fstring' });
    } else if (match[2]) {
      // regular string
      tokens.push({ text: match[0], type: 'string' });
    } else if (match[3]) {
      // comment
      tokens.push({ text: match[0], type: 'comment' });
    } else if (match[4]) {
      // keyword
      tokens.push({ text: match[0], type: 'keyword' });
    } else if (match[5]) {
      // function
      tokens.push({ text: match[0], type: 'function' });
    } else if (match[6]) {
      // decorator
      tokens.push({ text: match[0], type: 'decorator' });
    } else if (match[7]) {
      // punctuation
      tokens.push({ text: match[0], type: 'punctuation' });
    } else {
      tokens.push({ text: match[0], type: 'text' });
    }
    match = regex.exec(code);
  }

  return tokens;
};

const getTokenColor = (type: Token['type'], language: Language): string => {
  if (language === 'python') {
    switch (type) {
      case 'keyword':
        return 'text-orange-400';
      case 'string':
        return 'text-emerald-400';
      case 'fstring':
        return 'text-amber-300';
      case 'function':
        return 'text-sky-400';
      case 'decorator':
        return 'text-yellow-400';
      case 'comment':
        return 'text-zinc-500';
      case 'punctuation':
        return 'text-zinc-400';
      default:
        return 'text-zinc-100';
    }
  }

  // TypeScript colors
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
    case 'punctuation':
      return 'text-zinc-400';
    default:
      return 'text-zinc-100';
  }
};

export const MultiLanguageIdeDemo = ({
  isVisible = true,
}: MultiLanguageIdeDemoProps) => {
  const [activeLanguage, setActiveLanguage] = useState<Language>('typescript');
  const [displayedChars, setDisplayedChars] = useState(0);
  const [isTypingComplete, setIsTypingComplete] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);

  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const hasStarted = useRef(false);
  const isTypingRef = useRef(false);

  const currentCode =
    activeLanguage === 'typescript' ? TYPESCRIPT_CODE : PYTHON_CODE;
  const tokens =
    activeLanguage === 'typescript'
      ? tokenizeTypeScript(currentCode)
      : tokenizePython(currentCode);

  // Build displayed tokens
  let remainingChars = displayedChars;
  const displayedTokens: { token: Token; chars: number }[] = [];

  for (const token of tokens) {
    if (remainingChars <= 0) break;
    const charsToShow = Math.min(remainingChars, token.text.length);
    displayedTokens.push({ token, chars: charsToShow });
    remainingChars -= charsToShow;
  }

  // Calculate line numbers
  const displayedText = currentCode.slice(0, displayedChars);
  const lineCount = displayedText.split('\n').length;
  const totalLines = currentCode.split('\n').length;
  const lineNumberWidth = String(totalLines).length;

  // Run the typing animation loop
  const runAnimation = useCallback(() => {
    if (isTypingRef.current) return; // Prevent double-start
    isTypingRef.current = true;

    let currentLang: Language = 'typescript';
    let charIndex = 0;

    const getCode = (lang: Language) =>
      lang === 'typescript' ? TYPESCRIPT_CODE : PYTHON_CODE;

    const typeNextChar = () => {
      const code = getCode(currentLang);

      if (charIndex < code.length) {
        charIndex++;
        setDisplayedChars(charIndex);

        // Auto-scroll
        if (scrollContainerRef.current) {
          scrollContainerRef.current.scrollTop =
            scrollContainerRef.current.scrollHeight;
        }

        timeoutRef.current = setTimeout(typeNextChar, CHAR_DELAY);
      } else {
        // Typing complete for this language
        setIsTypingComplete(true);

        // Pause then switch to other language
        timeoutRef.current = setTimeout(() => {
          setIsTransitioning(true);

          // Fade out, then switch language
          timeoutRef.current = setTimeout(() => {
            // Switch language
            currentLang =
              currentLang === 'typescript' ? 'python' : 'typescript';
            setActiveLanguage(currentLang);
            charIndex = 0;
            setDisplayedChars(0);
            setIsTypingComplete(false);
            setIsTransitioning(false);

            // Reset scroll position
            if (scrollContainerRef.current) {
              scrollContainerRef.current.scrollTop = 0;
            }

            // Start typing the next language
            timeoutRef.current = setTimeout(typeNextChar, 400);
          }, 300);
        }, PAUSE_DURATION);
      }
    };

    // Reset scroll position
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0;
    }

    // Initial delay before typing starts
    timeoutRef.current = setTimeout(typeNextChar, 400);
  }, []);

  // Initialize animation when component becomes visible
  useEffect(() => {
    if (!isVisible) {
      // Reset everything when not visible
      hasStarted.current = false;
      isTypingRef.current = false;
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      return;
    }

    // Prevent double-start (especially in React StrictMode)
    if (hasStarted.current) return;
    hasStarted.current = true;

    // Reset state before starting
    setDisplayedChars(0);
    setIsTypingComplete(false);
    setIsTransitioning(false);
    setActiveLanguage('typescript');

    // Small delay to ensure state is settled before animation starts
    const startDelay = setTimeout(() => {
      runAnimation();
    }, 50);

    return () => {
      // Clean up on unmount or when effect re-runs
      clearTimeout(startDelay);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      // Reset refs so animation can restart on next mount
      hasStarted.current = false;
      isTypingRef.current = false;
    };
  }, [isVisible, runAnimation]);

  // Reset when not visible
  useEffect(() => {
    if (!isVisible) {
      const resetTimer = setTimeout(() => {
        setActiveLanguage('typescript');
        setDisplayedChars(0);
        setIsTypingComplete(false);
        setIsTransitioning(false);
        hasStarted.current = false;
      }, 600);
      return () => clearTimeout(resetTimer);
    }
  }, [isVisible]);

  const tabs = [
    {
      language: 'typescript' as Language,
      name: 'send-welcome.ts',
      icon: <IconFileTypeTs className="size-3.5 text-blue-400" />,
    },
    {
      language: 'python' as Language,
      name: 'email.py',
      icon: <IconBrandPython className="size-3.5 text-yellow-400" />,
    },
  ];

  return (
    <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xl shadow-black/10 dark:shadow-black/40 overflow-hidden">
      {/* Window chrome with tabs */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/80">
        <div className="flex gap-1.5">
          <div className="size-2.5 rounded-full bg-red-400 dark:bg-red-500" />
          <div className="size-2.5 rounded-full bg-yellow-400 dark:bg-yellow-500" />
          <div className="size-2.5 rounded-full bg-green-400 dark:bg-green-500" />
        </div>

        <div className="flex-1 flex items-center gap-1 ml-3">
          {tabs.map((tab) => (
            <div
              key={tab.language}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-all duration-300',
                activeLanguage === tab.language
                  ? 'bg-white dark:bg-zinc-800 text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {tab.icon}
              {tab.name}
            </div>
          ))}
        </div>

        {/* Language indicator badge */}
        <div
          className={cn(
            'px-2 py-0.5 rounded text-[10px] font-medium transition-all duration-300',
            activeLanguage === 'typescript'
              ? 'bg-blue-500/10 text-blue-500 dark:text-blue-400'
              : 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400',
          )}
        >
          {activeLanguage === 'typescript' ? 'TypeScript' : 'Python'}
        </div>
      </div>

      {/* Code editor area */}
      <div
        ref={scrollContainerRef}
        className={cn(
          'p-3 h-[240px] overflow-y-auto scrollbar-hide relative bg-zinc-950 transition-opacity duration-300',
          isTransitioning && 'opacity-0',
        )}
      >
        <pre className="font-mono text-xs leading-relaxed">
          <div className="flex">
            {/* Line numbers gutter */}
            <div className="flex-shrink-0 pr-3 mr-3 border-r border-zinc-800 text-zinc-600 select-none text-right">
              {Array.from(
                { length: displayedChars > 0 ? lineCount : 1 },
                (_, lineIndex) => {
                  const key = `line-${lineIndex}`;
                  return (
                    <div key={key} style={{ minWidth: `${lineNumberWidth}ch` }}>
                      {lineIndex + 1}
                    </div>
                  );
                },
              )}
            </div>

            {/* Code content */}
            <code className="flex-1 overflow-x-auto">
              {displayedTokens.map((dt, i) => {
                const key = `${dt.token.type}-${i}-${dt.token.text.slice(0, 8)}`;
                return (
                  <span
                    key={key}
                    className={getTokenColor(dt.token.type, activeLanguage)}
                  >
                    {dt.token.text.slice(0, dt.chars)}
                  </span>
                );
              })}
              {/* Blinking cursor */}
              <span
                className={cn(
                  'inline-block w-0.5 h-[1.1em] rounded-sm align-middle ml-0.5 transition-colors duration-300',
                  activeLanguage === 'typescript'
                    ? 'bg-blue-400'
                    : 'bg-yellow-400',
                )}
                style={{ animation: 'blink 1s step-end infinite' }}
              />
            </code>
          </div>
        </pre>
      </div>

      {/* Bottom status bar */}
      <div className="flex items-center justify-between px-3 py-2 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50">
        <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1">
            {activeLanguage === 'typescript' ? (
              <>
                <IconFileTypeTs className="size-3 text-blue-400" />
                TypeScript
              </>
            ) : (
              <>
                <IconBrandPython className="size-3 text-yellow-400" />
                Python
              </>
            )}
          </span>
          <span>UTF-8</span>
          <span>
            Ln {lineCount}, Col{' '}
            {displayedText.split('\n').pop()?.length ?? 0 + 1}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {isTypingComplete && (
            <span className="px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 text-[10px] animate-in fade-in duration-300">
              Ready to run
            </span>
          )}
          <span className="px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-[10px]">
            @promptly/sdk
          </span>
        </div>
      </div>
    </div>
  );
};
