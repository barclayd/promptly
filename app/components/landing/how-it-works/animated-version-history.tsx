import { useEffect, useRef, useState } from 'react';
import { useInView } from '~/hooks/use-in-view';
import { cn } from '~/lib/utils';

const VERSIONS = [
  { version: 'v1', time: '2 days ago', isLatest: false },
  { version: 'v2', time: 'Yesterday', isLatest: false },
  { version: 'v3', time: 'Just now', isLatest: true },
];

const VERSION_DELAY = 300; // ms between each version appearing

export const AnimatedVersionHistory = () => {
  const { ref, isInView } = useInView({ threshold: 0.3, triggerOnce: true });
  const [visibleVersions, setVisibleVersions] = useState<number>(0);
  const [showLivePulse, setShowLivePulse] = useState(false);
  const timeoutRefs = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    // Clean up any existing timeouts
    const cleanupTimeouts = () => {
      timeoutRefs.current.forEach(clearTimeout);
      timeoutRefs.current = [];
    };

    if (!isInView) {
      cleanupTimeouts();
      return;
    }

    // Animate versions appearing sequentially
    VERSIONS.forEach((_, index) => {
      const timeout = setTimeout(
        () => {
          setVisibleVersions(index + 1);

          // Start pulse animation when last version appears
          if (index === VERSIONS.length - 1) {
            const pulseTimeout = setTimeout(() => {
              setShowLivePulse(true);
            }, 200);
            timeoutRefs.current.push(pulseTimeout);
          }
        },
        VERSION_DELAY * (index + 1),
      );
      timeoutRefs.current.push(timeout);
    });

    return cleanupTimeouts;
  }, [isInView]);

  return (
    <div
      ref={ref}
      className="rounded-xl border border-border/50 bg-card shadow-lg overflow-hidden"
    >
      <div className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground">
            Version History
          </span>
          <span
            className={cn(
              'text-[10px] text-emerald-500 font-medium px-1.5 py-0.5 rounded',
              showLivePulse && 'animate-live-pulse',
            )}
          >
            Live
          </span>
        </div>
        <div className="space-y-2">
          {VERSIONS.map((v, index) => {
            const isVisible = index < visibleVersions;
            const isLatestVisible = v.isLatest && isVisible;

            return (
              <div
                key={v.version}
                className={cn(
                  'flex items-center justify-between px-3 py-2 rounded-lg text-xs transition-all',
                  isLatestVisible
                    ? 'bg-emerald-500/10 border border-emerald-500/20'
                    : 'bg-muted/50',
                  !isVisible && 'opacity-0',
                  isVisible && 'animate-version-slide-in',
                )}
                style={{
                  animationDelay: isVisible ? '0ms' : undefined,
                }}
              >
                <span
                  className={cn(
                    isLatestVisible
                      ? 'text-emerald-600 dark:text-emerald-400 font-medium'
                      : 'text-muted-foreground',
                  )}
                >
                  {v.version}
                </span>
                <span className="text-muted-foreground">{v.time}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
