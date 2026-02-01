import { useCallback, useEffect, useRef, useState } from 'react';
import { cn } from '~/lib/utils';
import { DemoEditorWindow } from './demo-editor-window';
import { DemoIdeWindow } from './demo-ide-window';
import { DemoOutputWindow } from './demo-output-window';
import { DemoTestingWindow } from './demo-testing-window';

type HeroDemoStackProps = {
  className?: string;
};

const WINDOW_DURATION = 7800; // ~6.7 seconds per window (slowed by 0.75x)
const FINAL_WINDOW_PAUSE = 2000; // Extra 2 second pause after final window
const WINDOW_COUNT = 4;

const WINDOW_LABELS = [
  { text: 'Experts write prompts', emoji: '✍️' },
  { text: 'Test in seconds, not days', emoji: '⚡' },
  { text: 'Integrate anywhere', emoji: '🔌' },
  { text: 'Watch them shine', emoji: '✨' },
];

type AnimatedLabelProps = {
  text: string;
  emoji: string;
};

const AnimatedLabel = ({ text, emoji }: AnimatedLabelProps) => {
  const [displayedLabel, setDisplayedLabel] = useState({ text, emoji });
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    if (text !== displayedLabel.text) {
      setIsAnimating(true);
      const timeout = setTimeout(() => {
        setDisplayedLabel({ text, emoji });
        setIsAnimating(false);
      }, 200);
      return () => clearTimeout(timeout);
    }
  }, [text, emoji, displayedLabel.text]);

  return (
    <div
      className={cn(
        'inline-flex items-center gap-2.5 rounded-full px-5 py-2.5',
        'bg-gradient-to-r from-zinc-900/95 to-zinc-800/95 dark:from-zinc-800/95 dark:to-zinc-700/95',
        'border border-white/10 shadow-xl shadow-black/20',
        'backdrop-blur-sm',
        isAnimating ? 'animate-label-exit' : 'animate-label-enter',
      )}
    >
      <span
        className="text-lg transition-transform duration-300"
        role="img"
        aria-hidden="true"
        style={{ filter: 'drop-shadow(0 0 4px rgba(255,255,255,0.3))' }}
      >
        {displayedLabel.emoji}
      </span>
      <span className="text-sm font-medium tracking-wide text-white/95">
        {displayedLabel.text}
      </span>
    </div>
  );
};

// Stack positions for 4 windows
// Position 0 = front (active)
// Position 1 = back-right
// Position 2 = back-left
// Position 3 = hidden behind

const getPositionStyles = (position: number): React.CSSProperties => {
  switch (position) {
    case 0: // Front - active
      return {
        transform: 'scale(1) rotate(0deg) translate(0, 0)',
        zIndex: 40,
        opacity: 1,
      };
    case 1: // Back right
      return {
        transform: 'scale(0.92) rotate(2deg) translate(30px, -20px)',
        zIndex: 30,
        opacity: 0.6,
      };
    case 2: // Back left
      return {
        transform: 'scale(0.88) rotate(-2deg) translate(-30px, -35px)',
        zIndex: 20,
        opacity: 0.4,
      };
    case 3: // Hidden
      return {
        transform: 'scale(0.84) rotate(0deg) translate(0, -50px)',
        zIndex: 10,
        opacity: 0,
      };
    default:
      return {};
  }
};

export const HeroDemoStack = ({ className }: HeroDemoStackProps) => {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scheduleNext = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    setActiveIndex((prev) => {
      const next = (prev + 1) % WINDOW_COUNT;
      // Give output window (index 3) extra time for its longer animation
      const isOutputWindow = next === WINDOW_COUNT - 1;
      const delay = isOutputWindow
        ? WINDOW_DURATION + FINAL_WINDOW_PAUSE
        : WINDOW_DURATION;

      timeoutRef.current = setTimeout(scheduleNext, delay);
      return next;
    });
  }, []);

  useEffect(() => {
    if (isPaused) {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      return;
    }

    // Start the cycle
    timeoutRef.current = setTimeout(scheduleNext, WINDOW_DURATION);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [scheduleNext, isPaused]);

  // Calculate position for each window based on activeIndex
  const getWindowPosition = (windowIndex: number): number => {
    // Calculate how many positions behind the front this window is
    const diff = (windowIndex - activeIndex + WINDOW_COUNT) % WINDOW_COUNT;
    return diff;
  };

  const handleMouseEnter = useCallback(() => {
    setIsPaused(true);
  }, []);

  const handleMouseLeave = useCallback(() => {
    setIsPaused(false);
  }, []);

  // Flow: Write → Test → Integrate → Output
  const windows = [
    { id: 'editor', Component: DemoEditorWindow },
    { id: 'testing', Component: DemoTestingWindow },
    { id: 'ide', Component: DemoIdeWindow },
    { id: 'output', Component: DemoOutputWindow },
  ];

  return (
    <div
      role="region"
      aria-label="Product demo carousel"
      className={cn('flex flex-col items-center gap-6', className)}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Windows container with fixed height */}
      <div className="relative h-[280px] sm:h-[320px] lg:h-[340px] w-full flex items-start justify-center pt-12 overflow-hidden">
        {windows.map((window, index) => {
          const position = getWindowPosition(index);
          const isActive = position === 0;

          return (
            <div
              key={window.id}
              className="absolute w-[min(420px,85vw)] max-h-[245px] sm:max-h-[285px] lg:max-h-[305px] transition-all duration-500 ease-out"
              style={getPositionStyles(position)}
            >
              <window.Component
                isActive={isActive}
                onAnimationComplete={undefined}
              />
            </div>
          );
        })}
      </div>

      {/* Label and progress indicators - always visible below windows */}
      <div className="flex flex-col items-center gap-4">
        {/* Animated label */}
        <AnimatedLabel
          text={WINDOW_LABELS[activeIndex].text}
          emoji={WINDOW_LABELS[activeIndex].emoji}
        />

        {/* Progress indicators */}
        <div className="flex gap-2">
          {windows.map((window) => (
            <button
              type="button"
              key={window.id}
              className={cn(
                'h-1.5 rounded-full transition-all duration-300 ease-out',
                windows.findIndex((w) => w.id === window.id) === activeIndex
                  ? 'w-7 bg-gradient-to-r from-indigo-500 to-violet-500 shadow-md shadow-indigo-500/30'
                  : 'w-2 bg-zinc-400/50 dark:bg-zinc-600/50 hover:bg-zinc-400 dark:hover:bg-zinc-500',
              )}
              onClick={() =>
                setActiveIndex(windows.findIndex((w) => w.id === window.id))
              }
              aria-label={`Go to ${window.id} demo`}
            />
          ))}
        </div>
      </div>
    </div>
  );
};
