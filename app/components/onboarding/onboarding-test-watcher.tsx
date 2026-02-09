'use client';

import { useNextStep } from 'nextstepjs';
import { useEffect, useRef } from 'react';
import { ONBOARDING_TOUR_NAME } from '~/lib/onboarding-steps';
import { useOnboardingStore } from '~/stores/onboarding-store';

interface OnboardingTestWatcherProps {
  isComplete: boolean;
  isStreaming: boolean;
}

export const OnboardingTestWatcher = ({
  isComplete,
  isStreaming,
}: OnboardingTestWatcherProps) => {
  const { currentStep, currentTour, setCurrentStep, isNextStepVisible } =
    useNextStep();
  const isActive = useOnboardingStore((s) => s.isActive);
  const hasAdvanced = useRef(false);

  useEffect(() => {
    if (!isActive || !isNextStepVisible || currentTour !== ONBOARDING_TOUR_NAME)
      return;
    if (currentStep !== 7) {
      hasAdvanced.current = false;
      return;
    }
    if (isComplete && !isStreaming && !hasAdvanced.current) {
      hasAdvanced.current = true;
      const timer = setTimeout(() => {
        setCurrentStep(8);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [
    isActive,
    isNextStepVisible,
    currentTour,
    currentStep,
    isComplete,
    isStreaming,
    setCurrentStep,
  ]);

  return null;
};
