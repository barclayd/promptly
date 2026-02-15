'use client';

import { IconKey } from '@tabler/icons-react';
import { useNavigate } from 'react-router';
import { useCanManageBilling } from '~/hooks/use-can-manage-billing';
import { NotifyAdminButton } from './notify-admin-button';
import { Button } from './ui/button';

export const NoModelsWarning = () => {
  const { canManageBilling } = useCanManageBilling();
  const navigate = useNavigate();

  return (
    <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
      <div className="flex items-start gap-2.5">
        <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-amber-500/10">
          <IconKey className="size-3.5 text-amber-600 dark:text-amber-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-foreground/80">
            No API keys configured
          </p>
          <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
            Add an LLM API key to enable model selection.
          </p>
        </div>
      </div>
      <div className="mt-2.5">
        {canManageBilling ? (
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={() => navigate('/settings?tab=llm-api-keys&open=create')}
          >
            <IconKey className="size-3.5" />
            Add API Key
          </Button>
        ) : (
          <NotifyAdminButton variant="compact" context="no-api-keys" />
        )}
      </div>
    </div>
  );
};
