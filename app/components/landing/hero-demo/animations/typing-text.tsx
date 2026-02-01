import { useCallback, useEffect, useRef, useState } from 'react';

type TypingTextProps = {
  text: string;
  delay?: number;
  charDelay?: number;
  onChar?: (index: number, char: string) => void;
  onComplete?: () => void;
  className?: string;
  renderChar?: (
    char: string,
    index: number,
    isLatest: boolean,
  ) => React.ReactNode;
};

export const TypingText = ({
  text,
  delay = 0,
  charDelay = 30,
  onChar,
  onComplete,
  className,
  renderChar,
}: TypingTextProps) => {
  const [displayedChars, setDisplayedChars] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasStarted = useRef(false);

  const startTyping = useCallback(() => {
    if (hasStarted.current) return;
    hasStarted.current = true;

    let charIndex = 0;
    const typeNextChar = () => {
      if (charIndex < text.length) {
        setDisplayedChars(charIndex + 1);
        onChar?.(charIndex, text[charIndex]);
        charIndex++;
        intervalRef.current = setTimeout(typeNextChar, charDelay);
      } else {
        onComplete?.();
      }
    };

    intervalRef.current = setTimeout(typeNextChar, delay);
  }, [text, delay, charDelay, onChar, onComplete]);

  useEffect(() => {
    startTyping();

    return () => {
      if (intervalRef.current) {
        clearTimeout(intervalRef.current);
      }
    };
  }, [startTyping]);

  const displayedText = text.slice(0, displayedChars);

  if (renderChar) {
    return (
      <span className={className}>
        {displayedText.split('').map((char, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: Characters are rendered in sequence and index is stable
          <span key={i}>{renderChar(char, i, i === displayedChars - 1)}</span>
        ))}
      </span>
    );
  }

  return <span className={className}>{displayedText}</span>;
};

export const BlinkingCursor = ({ className }: { className?: string }) => {
  return (
    <span
      className={`inline-block w-0.5 h-[1.1em] bg-foreground/70 rounded-sm align-middle ml-0.5 ${className || ''}`}
      style={{ animation: 'blink 1s step-end infinite' }}
    />
  );
};
