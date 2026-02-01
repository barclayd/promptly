import { useCallback, useEffect, useRef, useState } from 'react';
import { ShineText } from '~/components/ui/shine-text';
import { BlinkingCursor, ConfettiBurst, NumberTicker } from './animations';

type DemoOutputWindowProps = {
  isActive: boolean;
  onAnimationComplete?: () => void;
};

const OUTPUT_TEXT = `Hi Sarah!

Welcome to Acme Inc - we're thrilled to have you on the Pro plan!

Here's what you can do next:
• Explore your dashboard
• Set up your first project
• Join our community

Need help? Reply to this email anytime.

Cheers,
The Acme Team`;

const WORDS = OUTPUT_TEXT.split(/(\s+)/);
const FINAL_COST = 0.0000125;
const INPUT_TOKENS = 847;
const OUTPUT_TOKENS = 234;

export const DemoOutputWindow = ({
  isActive,
  onAnimationComplete,
}: DemoOutputWindowProps) => {
  const [displayedWords, setDisplayedWords] = useState(0);
  const [cost, setCost] = useState(0);
  const [showConfetti, setShowConfetti] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasAnimated = useRef(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const reset = useCallback(() => {
    setDisplayedWords(0);
    setCost(0);
    setShowConfetti(false);
    setIsComplete(false);
    hasAnimated.current = false;
  }, []);

  useEffect(() => {
    if (!isActive) {
      const resetTimer = setTimeout(reset, 600);
      return () => clearTimeout(resetTimer);
    }

    if (hasAnimated.current) return;
    hasAnimated.current = true;

    let wordIndex = 0;

    const streamNextWord = () => {
      if (wordIndex < WORDS.length) {
        wordIndex++;
        setDisplayedWords(wordIndex);
        // Increment cost proportionally
        setCost((FINAL_COST * wordIndex) / WORDS.length);
        timeoutRef.current = setTimeout(streamNextWord, 67);
      } else {
        // Animation complete
        timeoutRef.current = setTimeout(() => {
          setCost(FINAL_COST);
          setShowConfetti(true);
          setIsComplete(true);

          timeoutRef.current = setTimeout(() => {
            setShowConfetti(false);
            onAnimationComplete?.();
          }, 1600);
        }, 400);
      }
    };

    // Start streaming after a short delay
    timeoutRef.current = setTimeout(streamNextWord, 400);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [isActive, onAnimationComplete, reset]);

  const displayedText = WORDS.slice(0, displayedWords).join('');

  // Auto-scroll to bottom as content streams in
  useEffect(() => {
    if (scrollContainerRef.current && displayedWords > 0) {
      scrollContainerRef.current.scrollTop =
        scrollContainerRef.current.scrollHeight;
    }
  }, [displayedWords]);

  return (
    <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 shadow-2xl shadow-black/10 dark:shadow-black/40 overflow-hidden">
      {/* macOS Mail window chrome */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-800/80">
        <div className="flex gap-2">
          <div className="size-3 rounded-full bg-[#FF5F57]" />
          <div className="size-3 rounded-full bg-[#FFBD2E]" />
          <div className="size-3 rounded-full bg-[#28C840]" />
        </div>
        <div className="flex-1 flex justify-center">
          <span className="text-sm text-foreground font-medium">Mail</span>
        </div>
        <div className="w-[52px]" />
      </div>

      {/* Email header fields */}
      <div className="bg-zinc-100/80 dark:bg-zinc-800/50">
        {/* To field */}
        <div className="flex items-center gap-3 px-4 py-2.5 border-b border-zinc-200 dark:border-zinc-700/50">
          <span className="text-sm text-muted-foreground">To:</span>
          <span className="px-2.5 py-0.5 rounded-md bg-blue-500 text-white text-sm font-medium">
            Sarah Chen
          </span>
        </div>

        {/* Subject field */}
        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-zinc-200 dark:border-zinc-700/50">
          <span className="text-sm font-semibold text-foreground">
            Subject:
          </span>
          <span className="text-sm text-foreground">Welcome to Acme!</span>
        </div>
      </div>

      {/* Email body */}
      <div
        ref={scrollContainerRef}
        className="px-4 py-4 h-[135px] sm:h-[135px] lg:h-[155px] overflow-y-auto relative bg-white dark:bg-zinc-900"
      >
        {/* Email content with ShineText */}
        <ShineText className="text-sm leading-relaxed whitespace-pre-wrap font-sans block text-foreground">
          {displayedText}
          {!isComplete && displayedWords > 0 && <BlinkingCursor />}
        </ShineText>

        {/* Confetti */}
        <ConfettiBurst active={showConfetti} />
      </div>

      {/* Bottom bar with token/cost info */}
      <div className="flex items-center justify-between px-3 py-2 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-100/80 dark:bg-zinc-800/50">
        <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
          {isComplete ? (
            <>
              <span>Input: {INPUT_TOKENS} tokens</span>
              <span>Output: {OUTPUT_TOKENS} tokens</span>
            </>
          ) : (
            <span>Streaming...</span>
          )}
        </div>
        <div className="flex items-center gap-1.5 text-[10px]">
          <span className="text-muted-foreground">Cost:</span>
          <span className="text-emerald-600 dark:text-emerald-400 font-medium tabular-nums">
            <NumberTicker value={cost} decimals={7} prefix="$" duration={100} />
          </span>
        </div>
      </div>
    </div>
  );
};
