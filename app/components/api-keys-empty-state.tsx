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

interface ApiKeysEmptyStateProps {
  onAddKey: () => void;
}

export const ApiKeysEmptyState = ({ onAddKey }: ApiKeysEmptyStateProps) => {
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
        <EmptyTitle className="text-foreground">No API keys yet</EmptyTitle>
        <EmptyDescription className="text-muted-foreground">
          Create an API key to access your prompts programmatically
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button className="gap-2 shadow-sm" onClick={onAddKey}>
          <IconKey className="size-4" />
          Add API Key
        </Button>
      </EmptyContent>
    </Empty>
  );
};
