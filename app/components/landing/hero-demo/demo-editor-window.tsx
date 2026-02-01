import { useCallback, useEffect, useRef, useState } from 'react';
import { BlinkingCursor, VariableBadge } from './animations';
import { DemoWindowFrame } from './demo-window-frame';

type DemoEditorWindowProps = {
  isActive: boolean;
  onAnimationComplete?: () => void;
};

const PROMPT_SEGMENTS = [
  {
    type: 'text' as const,
    content: 'You are a friendly customer success assistant for ',
  },
  {
    type: 'variable' as const,
    name: 'company_name',
    variant: 'company' as const,
  },
  { type: 'text' as const, content: '.' },
  { type: 'label' as const, label: 'USER', sublabel: 'prompt' },
  { type: 'text' as const, content: 'Write a warm welcome email for ' },
  { type: 'variable' as const, name: 'user_name', variant: 'user' as const },
  { type: 'text' as const, content: ' who just signed up for the ' },
  { type: 'variable' as const, name: 'plan_type', variant: 'plan' as const },
  { type: 'text' as const, content: ' plan.' },
];

export const DemoEditorWindow = ({
  isActive,
  onAnimationComplete,
}: DemoEditorWindowProps) => {
  const [typedChars, setTypedChars] = useState(0);
  const [visibleVariables, setVisibleVariables] = useState<Set<string>>(
    new Set(),
  );
  const [saved, setSaved] = useState(false);
  const [variableCount, setVariableCount] = useState(0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasAnimated = useRef(false);

  const reset = useCallback(() => {
    setTypedChars(0);
    setVisibleVariables(new Set());
    setSaved(false);
    setVariableCount(0);
    hasAnimated.current = false;
  }, []);

  useEffect(() => {
    if (!isActive) {
      // Reset when window becomes inactive
      const resetTimer = setTimeout(reset, 600);
      return () => clearTimeout(resetTimer);
    }

    if (hasAnimated.current) return;
    hasAnimated.current = true;

    let charIndex = 0;
    let currentSegmentIndex = 0;
    let currentSegmentCharIndex = 0;

    const typeNextChar = () => {
      const segment = PROMPT_SEGMENTS[currentSegmentIndex];
      if (!segment) {
        // Done typing, show saved
        timeoutRef.current = setTimeout(() => {
          setSaved(true);
          onAnimationComplete?.();
        }, 670); // slowed from 500
        return;
      }

      if (segment.type === 'text') {
        if (currentSegmentCharIndex < segment.content.length) {
          charIndex++;
          currentSegmentCharIndex++;
          setTypedChars(charIndex);
          timeoutRef.current = setTimeout(typeNextChar, 40); // slowed from 30
        } else {
          currentSegmentIndex++;
          currentSegmentCharIndex = 0;
          typeNextChar();
        }
      } else if (segment.type === 'variable') {
        // Show variable badge with animation
        setVisibleVariables((prev) => new Set([...prev, segment.name]));
        setVariableCount((prev) => prev + 1);
        currentSegmentIndex++;
        currentSegmentCharIndex = 0;
        timeoutRef.current = setTimeout(typeNextChar, 530); // slowed from 400
      } else if (segment.type === 'label') {
        // Show label with a brief pause
        currentSegmentIndex++;
        currentSegmentCharIndex = 0;
        timeoutRef.current = setTimeout(typeNextChar, 400);
      }
    };

    // Start typing after a short delay
    timeoutRef.current = setTimeout(typeNextChar, 400); // slowed from 300

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [isActive, onAnimationComplete, reset]);

  // Build displayed content
  const renderContent = () => {
    let textIndex = 0;
    const elements: React.ReactNode[] = [];

    for (let i = 0; i < PROMPT_SEGMENTS.length; i++) {
      const segment = PROMPT_SEGMENTS[i];
      if (segment.type === 'text') {
        const startIndex = textIndex;
        const endIndex = textIndex + segment.content.length;
        const charsToShow = Math.max(
          0,
          Math.min(typedChars - startIndex, segment.content.length),
        );
        textIndex = endIndex;

        if (charsToShow > 0) {
          const text = segment.content.slice(0, charsToShow);
          // Split by newlines to handle paragraph breaks
          const parts = text.split('\n');
          parts.forEach((part, partIndex) => {
            if (partIndex > 0) {
              // biome-ignore lint/suspicious/noArrayIndexKey: Part index combined with segment index creates stable unique key
              elements.push(<br key={`br-${i}-${partIndex}`} />);
              // biome-ignore lint/suspicious/noArrayIndexKey: Part index combined with segment index creates stable unique key
              elements.push(<br key={`br2-${i}-${partIndex}`} />);
            }
            if (part) {
              // biome-ignore lint/suspicious/noArrayIndexKey: Part index combined with segment index creates stable unique key
              elements.push(<span key={`text-${i}-${partIndex}`}>{part}</span>);
            }
          });
        }
      } else if (segment.type === 'label') {
        // Only show label if we've typed past it
        if (typedChars >= textIndex) {
          elements.push(
            <div
              key={`label-${i}`}
              className="flex items-center gap-2 text-muted-foreground text-[10px] mt-3 mb-1"
            >
              <span className="px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-medium font-sans">
                {segment.label}
              </span>
              <span className="font-sans">{segment.sublabel}</span>
            </div>,
          );
        }
      } else if (
        segment.type === 'variable' &&
        visibleVariables.has(segment.name)
      ) {
        elements.push(
          <VariableBadge
            key={`var-${segment.name}`}
            name={segment.name}
            variant={segment.variant}
            visible={visibleVariables.has(segment.name)}
          />,
        );
      }
    }

    return elements;
  };

  return (
    <DemoWindowFrame
      title="Promptly"
      bottomBar={
        <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
          <span>
            {variableCount} variable{variableCount !== 1 ? 's' : ''}
          </span>
          <span className={saved ? 'text-emerald-500' : ''}>
            {saved ? 'Saved ✓' : 'Auto-saving...'}
          </span>
          <span className="px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-[10px]">
            Claude Sonnet 4.5
          </span>
        </div>
      }
    >
      <div className="p-4 h-[195px] sm:h-[195px] lg:h-[215px] overflow-y-auto">
        {/* System prompt label */}
        <div className="flex items-center gap-2 text-muted-foreground text-[10px] mb-3">
          <span className="px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-medium">
            SYSTEM
          </span>
          <span>prompt</span>
        </div>

        {/* Prompt content */}
        <div className="text-xs sm:text-sm leading-relaxed text-foreground/90 font-mono">
          {renderContent()}
          {!saved && <BlinkingCursor />}
        </div>
      </div>
    </DemoWindowFrame>
  );
};
