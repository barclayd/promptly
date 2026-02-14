'use client';

import { IconKey } from '@tabler/icons-react';
import { Button } from '~/components/ui/button';
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '~/components/ui/empty';
import { useCanManageBilling } from '~/hooks/use-can-manage-billing';

interface LlmApiKeysEmptyStateProps {
  onAddKey: () => void;
}

export const LlmApiKeysEmptyState = ({
  onAddKey,
}: LlmApiKeysEmptyStateProps) => {
  const { canManageBilling } = useCanManageBilling();

  return (
    <Empty className="bg-card/60 backdrop-blur-sm border border-border shadow-sm">
      <EmptyHeader>
        <EmptyMedia>
          <div className="flex items-center justify-center">
            <div className="size-14 rounded-full bg-gradient-to-br from-muted to-accent flex items-center justify-center shadow-sm">
              <IconKey className="size-7 text-muted-foreground" />
            </div>
          </div>
        </EmptyMedia>
        <EmptyTitle className="text-foreground">No LLM API keys yet</EmptyTitle>
        <EmptyDescription className="text-muted-foreground">
          {canManageBilling
            ? 'Add an API key for OpenAI, Anthropic, or Google to test prompts against different models'
            : 'Ask an admin to add API keys for LLM providers'}
        </EmptyDescription>
      </EmptyHeader>
      {canManageBilling && (
        <EmptyContent>
          <Button className="gap-2 shadow-sm" onClick={onAddKey}>
            <IconKey className="size-4" />
            Add LLM API Key
          </Button>
        </EmptyContent>
      )}
    </Empty>
  );
};
