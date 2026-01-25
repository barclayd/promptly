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
import { CreateApiKeyDialog } from './create-api-key-dialog';

export const ApiKeysEmptyState = () => {
  return (
    <Empty className="bg-white/60 backdrop-blur-sm border border-gray-200/60 shadow-sm">
      <EmptyHeader>
        <EmptyMedia>
          <div className="flex items-center justify-center">
            <div className="size-14 rounded-full bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center shadow-sm">
              <IconKey className="size-7 text-gray-400" />
            </div>
          </div>
        </EmptyMedia>
        <EmptyTitle className="text-gray-900">No API keys yet</EmptyTitle>
        <EmptyDescription className="text-gray-500">
          Create an API key to access your prompts programmatically
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <CreateApiKeyDialog>
          <Button className="gap-2 shadow-sm">
            <IconKey className="size-4" />
            Add API Key
          </Button>
        </CreateApiKeyDialog>
      </EmptyContent>
    </Empty>
  );
};
