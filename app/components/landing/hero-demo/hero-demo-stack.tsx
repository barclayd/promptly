import { useCallback, useEffect, useRef, useState } from 'react';
import { cn } from '~/lib/utils';
import { DemoEditorWindow } from './demo-editor-window';
import { DemoIdeWindow } from './demo-ide-window';
import { DemoOutputWindow } from './demo-output-window';
import { DemoTestingWindow } from './demo-testing-window';

type HeroDemoStackProps = {
  className?: string;
};

const WINDOW_DURATION = 6700; // ~6.7 seconds per window (slowed by 0.75x)
const WINDOW_COUNT = 4;

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
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const cycleNext = useCallback(() => {
    setActiveIndex((prev) => (prev + 1) % WINDOW_COUNT);
  }, []);

  useEffect(() => {
    if (isPaused) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    intervalRef.current = setInterval(cycleNext, WINDOW_DURATION);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [cycleNext, isPaused]);

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
      className={cn(
        'relative h-[320px] sm:h-[380px] lg:h-[420px] w-full flex items-center justify-center',
        className,
      )}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {windows.map((window, index) => {
        const position = getWindowPosition(index);
        const isActive = position === 0;

        return (
          <div
            key={window.id}
            className="absolute w-[min(420px,85vw)] transition-all duration-500 ease-out"
            style={getPositionStyles(position)}
          >
            <window.Component
              isActive={isActive}
              onAnimationComplete={undefined}
            />
          </div>
        );
      })}

      {/* Progress indicators */}
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 flex gap-1.5">
        {windows.map((window) => (
          <button
            type="button"
            key={window.id}
            className={cn(
              'h-1.5 rounded-full transition-all duration-300',
              windows.findIndex((w) => w.id === window.id) === activeIndex
                ? 'w-6 bg-indigo-500'
                : 'w-1.5 bg-zinc-300 dark:bg-zinc-600 hover:bg-zinc-400 dark:hover:bg-zinc-500',
            )}
            onClick={() =>
              setActiveIndex(windows.findIndex((w) => w.id === window.id))
            }
            aria-label={`Go to ${window.id} demo`}
          />
        ))}
      </div>
    </div>
  );
};
