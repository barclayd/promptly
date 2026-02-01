import { IconCheck } from '@tabler/icons-react';
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

  return (
    <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xl shadow-black/10 dark:shadow-black/40 overflow-hidden">
      {/* macOS Mail window chrome */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-zinc-200 dark:border-zinc-800 bg-gradient-to-b from-zinc-100 to-zinc-50 dark:from-zinc-800 dark:to-zinc-900">
        <div className="flex gap-1.5">
          <div className="size-2.5 rounded-full bg-red-400 dark:bg-red-500" />
          <div className="size-2.5 rounded-full bg-yellow-400 dark:bg-yellow-500" />
          <div className="size-2.5 rounded-full bg-green-400 dark:bg-green-500" />
        </div>
        <div className="flex-1 flex justify-center">
          <div className="px-3 py-0.5 rounded text-xs text-muted-foreground font-medium">
            New Message
          </div>
        </div>
        <div className="w-[52px]" />
      </div>

      {/* Email header fields */}
      <div className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50">
        {/* To field */}
        <div className="flex items-center gap-3 px-4 py-2 border-b border-zinc-100 dark:border-zinc-800">
          <span className="text-xs text-muted-foreground font-medium w-12">
            To:
          </span>
          <span className="px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 text-xs font-medium">
            sarah@example.com
          </span>
        </div>

        {/* Subject field */}
        <div className="flex items-center gap-3 px-4 py-2">
          <span className="text-xs text-muted-foreground font-medium w-12">
            Subject:
          </span>
          <span className="text-xs text-foreground font-medium">
            Welcome to Acme!
          </span>
        </div>
      </div>

      {/* Email body */}
      <div className="p-4 min-h-[120px] sm:min-h-[140px] relative">
        {/* Status indicator */}
        <div className="flex items-center gap-2 text-[10px] text-muted-foreground mb-3">
          {isComplete ? (
            <>
              <IconCheck className="size-3 text-emerald-500" />
              <span className="text-emerald-600 dark:text-emerald-400">
                Sent
              </span>
            </>
          ) : (
            <>
              <div className="size-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Composing...</span>
            </>
          )}
        </div>

        {/* Email content with ShineText */}
        <ShineText className="text-xs sm:text-sm leading-relaxed whitespace-pre-wrap font-sans block">
          {displayedText}
          {!isComplete && displayedWords > 0 && <BlinkingCursor />}
        </ShineText>

        {/* Confetti */}
        <ConfettiBurst active={showConfetti} />
      </div>

      {/* Bottom bar with token/cost info */}
      <div className="flex items-center justify-between px-3 py-2 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50">
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
            <NumberTicker
              value={cost}
              decimals={7}
              prefix="$"
              duration={100}
            />
          </span>
        </div>
      </div>
    </div>
  );
};
