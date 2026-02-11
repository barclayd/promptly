'use client';

import { NextStepProvider, NextStepReact, useNextStep } from 'nextstepjs';
import { useReactRouterAdapter } from 'nextstepjs/adapters/react-router';
import { useCallback } from 'react';
import { useNavigate, useRouteLoaderData } from 'react-router';
import { OnboardingTourCard } from '~/components/onboarding/onboarding-tour-card';
import { useOnboardingOrchestrator } from '~/hooks/use-onboarding-orchestrator';
import {
  markOnboardingCompleted,
  markOnboardingSkipped,
} from '~/hooks/use-onboarding-tour';
import { onboardingTour } from '~/lib/onboarding-steps';
import type { loader as rootLoader } from '~/root';
import { useOnboardingStore } from '~/stores/onboarding-store';

const tours = [onboardingTour];

const OnboardingInner = ({ children }: { children: React.ReactNode }) => {
  const { setCurrentStep } = useNextStep();
  const navigate = useNavigate();
  const rootData = useRouteLoaderData<typeof rootLoader>('root');
  const userId = rootData?.user?.id ?? null;
  const { onStepChange, onComplete, onSkip } = useOnboardingOrchestrator(
    setCurrentStep,
    userId,
  );

  const handleComplete = useCallback(
    (tourName: string | null) => {
      onComplete(tourName);
      if (userId) markOnboardingCompleted(userId);
      navigate('/settings');
    },
    [onComplete, navigate, userId],
  );

  const handleSkip = useCallback(
    (step: number, tourName: string | null) => {
      onSkip(step, tourName);
      if (userId) markOnboardingSkipped(userId);
    },
    [onSkip, userId],
  );

  return (
    <NextStepReact
      steps={tours}
      navigationAdapter={useReactRouterAdapter}
      cardComponent={OnboardingTourCard}
      onStepChange={onStepChange}
      onComplete={handleComplete}
      onSkip={handleSkip}
      shadowRgb="0, 0, 0"
      shadowOpacity="0.5"
      displayArrow={true}
      clickThroughOverlay={false}
      disableConsoleLogs={true}
      scrollToTop={false}
    >
      {children}
    </NextStepReact>
  );
};

export const OnboardingProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => (
  <NextStepProvider>
    <OnboardingInner>{children}</OnboardingInner>
  </NextStepProvider>
);

// Hook to start the tour from the app layout
export const useStartOnboarding = () => {
  const { startNextStep, setCurrentStep, isNextStepVisible } = useNextStep();
  const isActive = useOnboardingStore((s) => s.isActive);

  const start = useCallback(
    (userName: string | null) => {
      useOnboardingStore.getState().start(userName);
      startNextStep('onboarding');
    },
    [startNextStep],
  );

  return { start, isNextStepVisible, isActive, setCurrentStep, startNextStep };
};
