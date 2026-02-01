import { useCallback, useEffect, useRef, useState } from 'react';
import { cn } from '~/lib/utils';

type Collaborator = {
  id: string;
  name: string;
  color: string;
  bgColor: string;
  borderColor: string;
  avatar: string;
  cursorPosition: number;
  isTyping: boolean;
};

const COLLABORATORS: Collaborator[] = [
  {
    id: 'sarah',
    name: 'Sarah',
    color: 'text-rose-600 dark:text-rose-400',
    bgColor: 'bg-rose-500',
    borderColor: 'border-rose-500',
    avatar: 'S',
    cursorPosition: 0,
    isTyping: false,
  },
  {
    id: 'alex',
    name: 'Alex',
    color: 'text-sky-600 dark:text-sky-400',
    bgColor: 'bg-sky-500',
    borderColor: 'border-sky-500',
    avatar: 'A',
    cursorPosition: 0,
    isTyping: false,
  },
  {
    id: 'jordan',
    name: 'Jordan',
    color: 'text-amber-600 dark:text-amber-400',
    bgColor: 'bg-amber-500',
    borderColor: 'border-amber-500',
    avatar: 'J',
    cursorPosition: 0,
    isTyping: false,
  },
];

const PROMPT_TEXT = `You are a helpful customer support assistant for {{company_name}}.

When a customer asks about {{topic}}, respond with empathy and provide clear, actionable solutions.

Always maintain a {{tone}} tone and sign off as {{agent_name}}.`;

type CollaborativeEditorDemoProps = {
  isVisible?: boolean;
};

export const CollaborativeEditorDemo = ({
  isVisible = true,
}: CollaborativeEditorDemoProps) => {
  const [collaborators, setCollaborators] =
    useState<Collaborator[]>(COLLABORATORS);
  const [displayText, setDisplayText] = useState(PROMPT_TEXT);
  const animationRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasStarted = useRef(false);
  const isAnimatingRef = useRef(false);

  // Run the cursor animation loop
  const runAnimation = useCallback(() => {
    if (isAnimatingRef.current) return; // Prevent double-start
    isAnimatingRef.current = true;

    const textLength = PROMPT_TEXT.length;

    // Initialize cursor positions
    setCollaborators((prev) =>
      prev.map((collab, idx) => ({
        ...collab,
        cursorPosition: [55, 130, textLength - 40][idx],
      })),
    );

    const moveCursors = () => {
      setCollaborators((prev) =>
        prev.map((collab) => {
          let newPosition = collab.cursorPosition;
          const movement = Math.random();

          if (collab.id === 'sarah') {
            // Sarah focuses on the beginning - variables area
            if (movement < 0.3) {
              newPosition = Math.min(newPosition + 1, 80);
            } else if (movement < 0.5) {
              newPosition = Math.max(newPosition - 1, 40);
            } else {
              // Jump to a variable
              const variablePositions = [45, 78, 150, 200];
              newPosition =
                variablePositions[
                  Math.floor(Math.random() * variablePositions.length)
                ];
            }
          } else if (collab.id === 'alex') {
            // Alex works in the middle section
            if (movement < 0.4) {
              newPosition = Math.min(newPosition + 2, 180);
            } else if (movement < 0.6) {
              newPosition = Math.max(newPosition - 1, 100);
            } else {
              newPosition = 100 + Math.floor(Math.random() * 80);
            }
          } else {
            // Jordan focuses on the end
            if (movement < 0.3) {
              newPosition = Math.min(newPosition + 1, textLength - 10);
            } else if (movement < 0.5) {
              newPosition = Math.max(newPosition - 2, textLength - 80);
            } else {
              newPosition = textLength - 80 + Math.floor(Math.random() * 70);
            }
          }

          return {
            ...collab,
            cursorPosition: Math.max(0, Math.min(newPosition, textLength)),
            isTyping: Math.random() > 0.6,
          };
        }),
      );
    };

    const animate = () => {
      moveCursors();
      animationRef.current = setTimeout(animate, 800 + Math.random() * 600);
    };

    // Start animation after a short delay
    animationRef.current = setTimeout(animate, 500);
  }, []);

  // Initialize animation when component becomes visible
  useEffect(() => {
    if (!isVisible) {
      // Reset everything when not visible
      hasStarted.current = false;
      isAnimatingRef.current = false;
      if (animationRef.current) {
        clearTimeout(animationRef.current);
        animationRef.current = null;
      }
      return;
    }

    // Prevent double-start (especially in React StrictMode)
    if (hasStarted.current) return;
    hasStarted.current = true;

    // Reset state before starting
    setCollaborators(COLLABORATORS);
    setDisplayText(PROMPT_TEXT);

    // Small delay to ensure state is settled before animation starts
    const startDelay = setTimeout(() => {
      runAnimation();
    }, 50);

    return () => {
      // Clean up on unmount or when effect re-runs
      clearTimeout(startDelay);
      if (animationRef.current) {
        clearTimeout(animationRef.current);
        animationRef.current = null;
      }
      // Reset refs so animation can restart on next mount
      hasStarted.current = false;
      isAnimatingRef.current = false;
    };
  }, [isVisible, runAnimation]);

  // Render text with cursors
  const renderTextWithCursors = () => {
    const elements: React.ReactNode[] = [];
    const sortedCursors = [...collaborators].sort(
      (a, b) => a.cursorPosition - b.cursorPosition,
    );

    let lastIndex = 0;

    // Process each cursor position
    for (const cursor of sortedCursors) {
      const pos = cursor.cursorPosition;

      // Add text before this cursor
      if (pos > lastIndex) {
        const textSegment = displayText.slice(lastIndex, pos);
        elements.push(
          <span key={`text-${lastIndex}`}>
            {renderTextSegment(textSegment)}
          </span>,
        );
      }

      // Add cursor
      elements.push(
        <span
          key={`cursor-${cursor.id}`}
          className="relative inline-block w-0"
          style={{ height: '1.2em' }}
        >
          {/* Cursor line */}
          <span
            className={cn(
              'absolute top-0 w-[2px] h-[1.1em] rounded-full animate-pulse',
              cursor.bgColor,
            )}
            style={{
              animationDuration: cursor.isTyping ? '0.4s' : '1s',
            }}
          />
          {/* Name label */}
          <span
            className={cn(
              'absolute -top-5 left-0 px-1.5 py-0.5 rounded text-[9px] font-medium text-white whitespace-nowrap',
              'transform -translate-x-1/2 opacity-90',
              'transition-all duration-300 ease-out',
              cursor.bgColor,
            )}
          >
            {cursor.name}
            {cursor.isTyping && (
              <span className="ml-1 inline-flex gap-0.5">
                <span
                  className="w-1 h-1 bg-white/80 rounded-full animate-bounce"
                  style={{ animationDelay: '0ms' }}
                />
                <span
                  className="w-1 h-1 bg-white/80 rounded-full animate-bounce"
                  style={{ animationDelay: '150ms' }}
                />
                <span
                  className="w-1 h-1 bg-white/80 rounded-full animate-bounce"
                  style={{ animationDelay: '300ms' }}
                />
              </span>
            )}
          </span>
        </span>,
      );

      lastIndex = pos;
    }

    // Add remaining text
    if (lastIndex < displayText.length) {
      elements.push(
        <span key={`text-end`}>
          {renderTextSegment(displayText.slice(lastIndex))}
        </span>,
      );
    }

    return elements;
  };

  // Render text segment with variable highlighting
  const renderTextSegment = (text: string) => {
    const parts = text.split(/(\{\{[^}]+\}\})/g);
    return parts.map((part, i) => {
      if (part.startsWith('{{') && part.endsWith('}}')) {
        const varName = part.slice(2, -2);
        return (
          <span
            // biome-ignore lint/suspicious/noArrayIndexKey: Static text segments with unique part content
            key={i}
            className="inline-flex items-center px-1.5 py-0.5 mx-0.5 rounded bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 text-[10px] font-medium"
          >
            {varName}
          </span>
        );
      }
      // biome-ignore lint/suspicious/noArrayIndexKey: Static text segments with unique part content
      return <span key={i}>{part}</span>;
    });
  };

  return (
    <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xl shadow-black/10 dark:shadow-black/40 overflow-hidden">
      {/* Window chrome with avatars */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/80">
        <div className="flex items-center gap-3">
          <div className="flex gap-1.5">
            <div className="size-2.5 rounded-full bg-red-400 dark:bg-red-500" />
            <div className="size-2.5 rounded-full bg-yellow-400 dark:bg-yellow-500" />
            <div className="size-2.5 rounded-full bg-green-400 dark:bg-green-500" />
          </div>
          <div className="px-2 py-0.5 rounded text-xs text-muted-foreground font-medium">
            welcome-email.prompt
          </div>
        </div>

        {/* Collaborator avatars */}
        <div className="flex items-center gap-1">
          <div className="flex -space-x-2">
            {collaborators.map((collab, idx) => (
              <div
                key={collab.id}
                className={cn(
                  'size-6 rounded-full flex items-center justify-center text-[10px] font-semibold text-white border-2 border-white dark:border-zinc-900',
                  'transition-transform duration-300 hover:scale-110 hover:z-10',
                  collab.bgColor,
                  collab.isTyping &&
                    'ring-2 ring-offset-1 ring-offset-white dark:ring-offset-zinc-900',
                  collab.isTyping && collab.id === 'sarah' && 'ring-rose-400',
                  collab.isTyping && collab.id === 'alex' && 'ring-sky-400',
                  collab.isTyping && collab.id === 'jordan' && 'ring-amber-400',
                )}
                style={{ zIndex: collaborators.length - idx }}
              >
                {collab.avatar}
              </div>
            ))}
          </div>
          <span className="ml-2 text-[10px] text-muted-foreground">
            3 editing
          </span>
        </div>
      </div>

      {/* Editor content */}
      <div className="p-4 h-[240px] overflow-hidden">
        {/* System prompt label */}
        <div className="flex items-center gap-2 text-muted-foreground text-[10px] mb-3">
          <span className="px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-medium">
            SYSTEM
          </span>
          <span>prompt</span>
        </div>

        {/* Prompt content with cursors */}
        <div className="text-xs leading-relaxed text-foreground/90 font-mono whitespace-pre-wrap relative">
          {renderTextWithCursors()}
        </div>
      </div>

      {/* Bottom bar */}
      <div className="flex items-center justify-between px-3 py-2 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50">
        <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
          <span>4 variables</span>
          <span className="text-emerald-500 flex items-center gap-1">
            <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
            All changes saved
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-[10px]">
            v2.3
          </span>
          <span className="px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 text-[10px]">
            Published
          </span>
        </div>
      </div>
    </div>
  );
};
