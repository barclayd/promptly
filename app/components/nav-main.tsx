'use client';

import {
  type Icon,
  IconChevronDown,
  IconCirclePlusFilled,
  IconFileAi,
  IconPuzzle,
} from '@tabler/icons-react';
import { useNextStep } from 'nextstepjs';
import { useState } from 'react';
import { NavLink, useLocation } from 'react-router';

import { CreatePromptDialog } from '~/components/create-prompt-dialog';
import { CreateSnippetDialog } from '~/components/create-snippet-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '~/components/ui/dropdown-menu';
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

  const [snippetDialogOpen, setSnippetDialogOpen] = useState(false);
  const [promptDialogOpen, setPromptDialogOpen] = useState(false);

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
            <div className="flex w-full">
              <CreatePromptDialog>
                <SidebarMenuButton
                  id="onboarding-create-button"
                  tooltip="Create"
                  onClick={handleCreateClick}
                  className="bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground active:bg-primary/90 active:text-primary-foreground min-w-8 duration-200 ease-linear rounded-r-none"
                >
                  <IconCirclePlusFilled />
                  <span>Create</span>
                </SidebarMenuButton>
              </CreatePromptDialog>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="flex h-8 shrink-0 items-center justify-center rounded-r-md border-l border-primary-foreground/20 bg-primary px-1.5 text-primary-foreground transition-colors hover:bg-primary/90"
                  >
                    <IconChevronDown className="size-3.5" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" side="bottom">
                  <DropdownMenuItem onSelect={() => setPromptDialogOpen(true)}>
                    <IconFileAi className="size-4" />
                    Create Prompt
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => setSnippetDialogOpen(true)}>
                    <IconPuzzle className="size-4" />
                    Create Snippet
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </SidebarMenuItem>
        </SidebarMenu>
        <CreatePromptDialog
          open={promptDialogOpen}
          onOpenChange={setPromptDialogOpen}
        />
        <CreateSnippetDialog
          open={snippetDialogOpen}
          onOpenChange={setSnippetDialogOpen}
        />
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
