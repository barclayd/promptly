'use client';

import { IconChevronRight, IconRocket } from '@tabler/icons-react';
import { useNavigate } from 'react-router';
import { useStartOnboarding } from '~/components/onboarding/onboarding-provider';
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '~/components/ui/sidebar';
import { fillPromptEditor } from '~/hooks/use-onboarding-orchestrator';
import { useOnboardingProgress } from '~/hooks/use-onboarding-progress';
import { useOnboardingStore } from '~/stores/onboarding-store';

export const OnboardingProgressWidget = ({
  userId,
  firstName,
}: {
  userId: string | undefined;
  firstName: string | null;
}) => {
  const { visible, milestone, total, highestStep, promptId } =
    useOnboardingProgress(userId ?? null);
  const { start, setCurrentStep, startNextStep } = useStartOnboarding();
  const navigate = useNavigate();

  if (!visible || !userId) return null;

  const percentage = (milestone / total) * 100;

  const handleResume = () => {
    const name = firstName ?? 'there';

    if (highestStep !== null && highestStep >= 3 && promptId) {
      // Resume from prompt editor (step 4+)
      navigate(`/prompts/${promptId}`);
      useOnboardingStore.getState().start(name);
      useOnboardingStore.getState().setCreatedPromptId(promptId);

      setTimeout(() => {
        startNextStep('onboarding');
        setTimeout(() => {
          if (setCurrentStep) setCurrentStep(4);
          fillPromptEditor(name);
        }, 500);
      }, 1000);
    } else {
      // Resume from beginning (step 0)
      navigate('/dashboard');
      setTimeout(() => {
        start(name);
      }, 500);
    }
  };

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton
          onClick={handleResume}
          className="flex items-center gap-2"
        >
          <IconRocket className="size-4 text-primary" />
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-xs font-medium">Finish setup</span>
            <span className="text-xs text-muted-foreground">
              {milestone}/{total} complete
            </span>
          </span>
          <IconChevronRight className="size-3.5 text-muted-foreground" />
        </SidebarMenuButton>
        <div className="mx-3 mt-1 mb-1">
          <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all duration-300"
              style={{ width: `${percentage}%` }}
            />
          </div>
        </div>
      </SidebarMenuItem>
    </SidebarMenu>
  );
};
