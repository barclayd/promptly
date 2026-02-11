'use client';

import { IconArrowLeft, IconArrowRight, IconX } from '@tabler/icons-react';
import type { CardComponentProps } from 'nextstepjs';
import { Button } from '~/components/ui/button';
import { cn } from '~/lib/utils';

export const OnboardingTourCard = ({
  step,
  currentStep,
  totalSteps,
  nextStep,
  prevStep,
  skipTour,
  arrow,
}: CardComponentProps) => {
  const isFirst = currentStep === 0;
  const isLast = currentStep === totalSteps - 1;
  const isWaiting = currentStep === 3; // Creating prompt
  const isTestStep = currentStep === 7; // User must click Test

  return (
    <div className="relative w-[340px] max-w-[90vw] translate-y-2.5">
      <span className="text-card">{arrow}</span>
      <div className="rounded-xl border bg-card p-5 shadow-lg">
        {/* Skip button */}
        {step.showSkip && (
          <button
            type="button"
            onClick={skipTour}
            className="absolute top-3 right-3 p-1.5 rounded-md text-muted-foreground/60 hover:text-foreground hover:bg-muted/80 transition-colors"
            aria-label="Skip tour"
          >
            <IconX className="size-4" />
          </button>
        )}

        {/* Icon + title */}
        <div className="flex items-center gap-2 mb-2 pr-6">
          {step.icon && <span className="text-lg">{step.icon}</span>}
          <h3 className="text-sm font-semibold text-foreground">
            {step.title}
          </h3>
        </div>

        {/* Content */}
        <p className="text-sm text-muted-foreground leading-relaxed mb-4">
          {step.content}
        </p>

        {/* Progress dots + nav */}
        <div className="flex items-center justify-between">
          {/* Progress dots */}
          <div className="flex gap-1.5">
            {Array.from({ length: totalSteps }, (_, i) => (
              <div
                // biome-ignore lint/suspicious/noArrayIndexKey: static progress dots never reorder
                key={i}
                className={cn(
                  'size-1.5 rounded-full transition-all duration-300',
                  i === currentStep
                    ? 'bg-primary w-4 rounded-full'
                    : i < currentStep
                      ? 'bg-primary/40'
                      : 'bg-muted-foreground/20',
                )}
              />
            ))}
          </div>

          {/* Navigation buttons */}
          {step.showControls && !isWaiting && !isTestStep && (
            <div className="flex items-center gap-2">
              {!isFirst && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={prevStep}
                  className="h-8 px-2"
                >
                  <IconArrowLeft className="size-4" />
                </Button>
              )}
              <Button size="sm" onClick={nextStep} className="h-8">
                {isLast ? 'Setup account' : 'Next'}
                {!isLast && <IconArrowRight className="size-3.5" />}
              </Button>
            </div>
          )}

          {/* Waiting indicator */}
          {isWaiting && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span className="size-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
