import { IconArrowRight } from '@tabler/icons-react';
import type { ReactNode } from 'react';
import { useInView } from '~/hooks/use-in-view';
import { cn } from '~/lib/utils';

type HowItWorksStepProps = {
  step: number;
  title: string;
  description: string;
  children: ReactNode;
  isLastStep?: boolean;
};

export const HowItWorksStep = ({
  step,
  title,
  description,
  children,
  isLastStep = false,
}: HowItWorksStepProps) => {
  const { ref, isInView } = useInView({ threshold: 0.2, triggerOnce: true });

  return (
    <div ref={ref} className="relative overflow-hidden">
      {/* Connector line (desktop only) - hidden on last step */}
      {!isLastStep && (
        <div className="hidden lg:block absolute top-12 left-full w-6 h-0.5 bg-gradient-to-r from-border to-transparent z-10">
          <IconArrowRight className="absolute -right-1 -top-[7px] size-4 text-muted-foreground/50" />
        </div>
      )}

      <div className="h-full flex flex-col">
        {/* Step number + title */}
        <div
          className={cn(
            'flex items-center gap-4 mb-6 opacity-0',
            isInView && 'animate-fade-in-up',
          )}
          style={{
            animationDelay: isInView ? '0ms' : undefined,
          }}
        >
          <div
            className={cn(
              'size-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white font-bold text-sm shadow-lg shadow-indigo-500/25',
              isInView && 'animate-step-activate',
            )}
          >
            {step}
          </div>
          <h3 className="text-xl font-semibold">{title}</h3>
        </div>

        {/* Visual */}
        <div
          className={cn(
            'mb-6 flex-1 opacity-0 max-w-full',
            isInView && 'animate-fade-in-up',
          )}
          style={{
            animationDelay: isInView ? '100ms' : undefined,
          }}
        >
          {children}
        </div>

        {/* Description */}
        <p
          className={cn(
            'text-muted-foreground leading-relaxed opacity-0',
            isInView && 'animate-fade-in-up',
          )}
          style={{
            animationDelay: isInView ? '200ms' : undefined,
          }}
        >
          {description}
        </p>
      </div>
    </div>
  );
};
