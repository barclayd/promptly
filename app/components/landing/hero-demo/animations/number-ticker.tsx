import { useEffect, useRef, useState } from 'react';

type NumberTickerProps = {
  value: number;
  from?: number;
  delay?: number;
  duration?: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  className?: string;
};

export const NumberTicker = ({
  value,
  from = 0,
  delay = 0,
  duration = 1000,
  decimals = 0,
  prefix = '',
  suffix = '',
  className,
}: NumberTickerProps) => {
  const [displayValue, setDisplayValue] = useState(from);
  const rafRef = useRef<number | null>(null);
  const delayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const startValueRef = useRef(from);
  const isFirstRender = useRef(true);

  // biome-ignore lint/correctness/useExhaustiveDependencies: displayValue is intentionally captured at effect start to animate from current value
  useEffect(() => {
    startValueRef.current = displayValue;
    startTimeRef.current = null;

    const animate = (timestamp: number) => {
      if (startTimeRef.current === null) {
        startTimeRef.current = timestamp;
      }

      const elapsed = timestamp - startTimeRef.current;
      const progress = Math.min(elapsed / duration, 1);

      // Ease out cubic
      const eased = 1 - (1 - progress) ** 3;
      const currentValue =
        startValueRef.current + (value - startValueRef.current) * eased;

      setDisplayValue(currentValue);

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate);
      }
    };

    const startAnimation = () => {
      rafRef.current = requestAnimationFrame(animate);
    };

    // Only apply delay on first render
    if (isFirstRender.current && delay > 0) {
      isFirstRender.current = false;
      delayTimerRef.current = setTimeout(startAnimation, delay);
    } else {
      isFirstRender.current = false;
      startAnimation();
    }

    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
      if (delayTimerRef.current) {
        clearTimeout(delayTimerRef.current);
      }
    };
  }, [value, duration, delay]);

  const formattedValue = displayValue.toFixed(decimals);

  return (
    <span className={className}>
      {prefix}
      {formattedValue}
      {suffix}
    </span>
  );
};
