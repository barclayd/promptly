'use client';

import { type Icon, IconCirclePlusFilled } from '@tabler/icons-react';
import { useNextStep } from 'nextstepjs';
import { NavLink, useLocation } from 'react-router';

import { CreatePromptDialog } from '~/components/create-prompt-dialog';
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '~/components/ui/sidebar';
import { fillCreateDialogInputs } from '~/hooks/use-onboarding-orchestrator';
import { useOnboardingStore } from '~/stores/onboarding-store';

export const NavMain = ({
  items,
}: {
  items: {
    title: string;
    url: string;
    icon?: Icon;
  }[];
}) => {
  const location = useLocation();
  const currentSection = location.pathname.split('/').filter(Boolean)[0] || '';
  const { setCurrentStep } = useNextStep();
  const isOnboardingActive = useOnboardingStore((s) => s.isActive);
  const hasCreatedPrompt = useOnboardingStore(
    (s) => s.createdPromptId !== null,
  );

  const handleCreateClick = () => {
    // If onboarding is active and we haven't created a prompt yet,
    // advance the tour to step 2 (dialog highlight) and fill inputs.
    // The dialog itself opens via DialogTrigger from the click.
    if (isOnboardingActive && !hasCreatedPrompt) {
      setCurrentStep(2);
      const firstName = useOnboardingStore.getState().userName ?? 'there';
      fillCreateDialogInputs(firstName);
    }
  };

  return (
    <SidebarGroup>
      <SidebarGroupContent className="flex flex-col gap-2">
        <SidebarMenu>
          <SidebarMenuItem className="flex items-center gap-2">
            <CreatePromptDialog>
              <SidebarMenuButton
                id="onboarding-create-button"
                tooltip="Create"
                onClick={handleCreateClick}
                className="bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground active:bg-primary/90 active:text-primary-foreground min-w-8 duration-200 ease-linear"
              >
                <IconCirclePlusFilled />
                <span>Create</span>
              </SidebarMenuButton>
            </CreatePromptDialog>
          </SidebarMenuItem>
        </SidebarMenu>
        <SidebarMenu>
          {items.map((item) => {
            const isActive =
              item.title.toLowerCase() === currentSection.toLowerCase();
            return (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton
                  asChild
                  tooltip={item.title}
                  isActive={isActive}
                >
                  <NavLink to={item.url}>
                    {item.icon && <item.icon />}
                    <span>{item.title}</span>
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
};
