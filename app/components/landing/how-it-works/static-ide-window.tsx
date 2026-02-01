import { IconFileTypeTs } from '@tabler/icons-react';

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

type Token = {
  text: string;
  type: 'keyword' | 'string' | 'function' | 'property' | 'punctuation' | 'text';
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
    case 'punctuation':
      return 'text-zinc-400';
    default:
      return 'text-zinc-100';
  }
};

export const StaticIdeWindow = () => {
  const tokens = tokenizeTypeScript(TYPESCRIPT_CODE);
  const lines = TYPESCRIPT_CODE.split('\n');
  const lineNumberWidth = String(lines.length).length;

  // Build line-by-line tokens for rendering with line numbers
  const lineTokens: Token[][] = [];
  let currentLine: Token[] = [];

  for (const token of tokens) {
    const parts = token.text.split('\n');
    for (let i = 0; i < parts.length; i++) {
      if (i > 0) {
        lineTokens.push(currentLine);
        currentLine = [];
      }
      if (parts[i]) {
        currentLine.push({ text: parts[i], type: token.type });
      }
    }
  }
  if (currentLine.length > 0) {
    lineTokens.push(currentLine);
  }

  return (
    <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xl shadow-black/10 dark:shadow-black/40 overflow-hidden">
      {/* Window chrome with tab */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/80">
        <div className="flex gap-1.5">
          <div className="size-2.5 rounded-full bg-red-400 dark:bg-red-500" />
          <div className="size-2.5 rounded-full bg-yellow-400 dark:bg-yellow-500" />
          <div className="size-2.5 rounded-full bg-green-400 dark:bg-green-500" />
        </div>

        <div className="flex-1 flex items-center gap-1 ml-3">
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium bg-white dark:bg-zinc-800 text-foreground shadow-sm">
            <IconFileTypeTs className="size-3.5 text-blue-400" />
            send-welcome.ts
          </div>
        </div>

        {/* Language indicator badge */}
        <div className="px-2 py-0.5 rounded text-[10px] font-medium bg-blue-500/10 text-blue-500 dark:text-blue-400">
          TypeScript
        </div>
      </div>

      {/* Code editor area */}
      <div className="p-3 h-[200px] overflow-hidden bg-zinc-950">
        <pre className="font-mono text-xs leading-relaxed">
          <div className="flex">
            {/* Line numbers gutter */}
            <div className="flex-shrink-0 pr-3 mr-3 border-r border-zinc-800 text-zinc-600 select-none text-right">
              {lineTokens.map((_, lineIndex) => {
                const key = `line-${lineIndex}`;
                return (
                  <div key={key} style={{ minWidth: `${lineNumberWidth}ch` }}>
                    {lineIndex + 1}
                  </div>
                );
              })}
            </div>

            {/* Code content */}
            <code className="flex-1">
              {lineTokens.map((line, lineIndex) => {
                const key = `code-line-${lineIndex}`;
                return (
                  <div key={key}>
                    {line.map((token, tokenIndex) => {
                      const tokenKey = `${token.type}-${tokenIndex}-${token.text.slice(0, 8)}`;
                      return (
                        <span
                          key={tokenKey}
                          className={getTokenColor(token.type)}
                        >
                          {token.text}
                        </span>
                      );
                    })}
                  </div>
                );
              })}
            </code>
          </div>
        </pre>
      </div>

      {/* Bottom status bar */}
      <div className="flex items-center justify-between px-3 py-2 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50">
        <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <IconFileTypeTs className="size-3 text-blue-400" />
            TypeScript
          </span>
          <span>UTF-8</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 text-[10px]">
            Ready to run
          </span>
          <span className="px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-[10px]">
            @promptly/sdk
          </span>
        </div>
      </div>
    </div>
  );
};
