import type { ReactNode } from 'react';
import { useInView } from '~/hooks/use-in-view';
import { useReducedMotion } from '~/hooks/use-reduced-motion';
import { cn } from '~/lib/utils';

type AnimationDirection = 'up' | 'left' | 'right';

type AnimatedWrapperProps = {
  children: ReactNode;
  direction?: AnimationDirection;
  delay?: number;
  className?: string;
};

const animationClasses: Record<AnimationDirection, string> = {
  up: 'animate-fade-in-up',
  left: 'animate-fade-in-left',
  right: 'animate-fade-in-right',
};

export const AnimatedWrapper = ({
  children,
  direction = 'up',
  delay = 0,
  className,
}: AnimatedWrapperProps) => {
  const { ref, isInView } = useInView({ threshold: 0.1, triggerOnce: true });
  const prefersReducedMotion = useReducedMotion();

  // Skip animation entirely if user prefers reduced motion
  if (prefersReducedMotion) {
    return <div className={className}>{children}</div>;
  }

  return (
    <div
      ref={ref}
      className={cn(
        'opacity-0',
        isInView && animationClasses[direction],
        className,
      )}
      style={{
        animationDelay: isInView ? `${delay}ms` : undefined,
        animationFillMode: 'forwards',
      }}
    >
      {children}
    </div>
  );
};
