import { useEffect, useRef, useState } from 'react';

type NumberTickerProps = {
  value: number;
  duration?: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  className?: string;
};

export const NumberTicker = ({
  value,
  duration = 1000,
  decimals = 0,
  prefix = '',
  suffix = '',
  className,
}: NumberTickerProps) => {
  const [displayValue, setDisplayValue] = useState(0);
  const rafRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const startValueRef = useRef(0);

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

    rafRef.current = requestAnimationFrame(animate);

    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [value, duration]);

  const formattedValue = displayValue.toFixed(decimals);

  return (
    <span className={className}>
      {prefix}
      {formattedValue}
      {suffix}
    </span>
  );
};
