'use client';

import {
  IconBrain,
  IconBrandGoogle,
  IconBrandOpenai,
  IconTrash,
} from '@tabler/icons-react';
import { useFetcher } from 'react-router';
import { Badge } from '~/components/ui/badge';
import { Button } from '~/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '~/components/ui/table';
import { useCanManageBilling } from '~/hooks/use-can-manage-billing';
import type { LlmApiKey } from '~/lib/llm-api-key-types';
import { MODEL_PRICING } from '~/lib/model-pricing';

const providerConfig = {
  openai: {
    label: 'OpenAI',
    icon: IconBrandOpenai,
    badgeClass:
      'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  },
  anthropic: {
    label: 'Anthropic',
    icon: IconBrain,
    badgeClass:
      'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
  },
  google: {
    label: 'Google',
    icon: IconBrandGoogle,
    badgeClass:
      'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  },
} as const;

const formatDate = (timestamp: number): string => {
  return new Date(timestamp).toLocaleDateString('en-GB', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

const getModelDisplayName = (modelId: string): string => {
  return MODEL_PRICING[modelId]?.displayName ?? modelId;
};

interface LlmApiKeysTableProps {
  llmApiKeys: LlmApiKey[];
}

export const LlmApiKeysTable = ({ llmApiKeys }: LlmApiKeysTableProps) => {
  const fetcher = useFetcher();
  const { canManageBilling } = useCanManageBilling();

  return (
    <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/30 hover:bg-muted/30">
            <TableHead className="font-semibold text-foreground">
              Name
            </TableHead>
            <TableHead className="font-semibold text-foreground">
              Provider
            </TableHead>
            <TableHead className="font-semibold text-foreground">Key</TableHead>
            <TableHead className="font-semibold text-foreground">
              Models
            </TableHead>
            <TableHead className="font-semibold text-foreground">
              Created
            </TableHead>
            {canManageBilling && (
              <TableHead className="font-semibold text-foreground w-16">
                <span className="sr-only">Actions</span>
              </TableHead>
            )}
          </TableRow>
        </TableHeader>
        <TableBody>
          {llmApiKeys.map((key) => {
            const config = providerConfig[key.provider];
            const Icon = config.icon;
            const isDeleting =
              fetcher.state !== 'idle' &&
              fetcher.formData?.get('id') === key.id;
            const visibleModels = key.enabledModels.slice(0, 3);
            const extraCount = key.enabledModels.length - 3;

            return (
              <TableRow key={key.id} className={isDeleting ? 'opacity-50' : ''}>
                <TableCell className="py-3">
                  <span className="font-medium text-foreground">
                    {key.name}
                  </span>
                </TableCell>
                <TableCell>
                  <Badge
                    variant="secondary"
                    className={`gap-1.5 ${config.badgeClass}`}
                  >
                    <Icon className="size-3.5" />
                    {config.label}
                  </Badge>
                </TableCell>
                <TableCell>
                  <code className="text-sm bg-muted px-2 py-1 rounded text-muted-foreground font-mono">
                    ••••{key.keyHint}
                  </code>
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {visibleModels.map((modelId) => (
                      <Badge
                        key={modelId}
                        variant="secondary"
                        className="text-xs"
                      >
                        {getModelDisplayName(modelId)}
                      </Badge>
                    ))}
                    {extraCount > 0 && (
                      <Badge variant="outline" className="text-xs">
                        +{extraCount} more
                      </Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {formatDate(key.createdAt)}
                </TableCell>
                {canManageBilling && (
                  <TableCell>
                    <fetcher.Form
                      method="post"
                      action="/api/settings/delete-llm-api-key"
                    >
                      <input type="hidden" name="id" value={key.id} />
                      <Button
                        type="submit"
                        variant="ghost"
                        size="sm"
                        className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                        disabled={isDeleting}
                      >
                        <IconTrash className="size-4" />
                        <span className="sr-only">Delete</span>
                      </Button>
                    </fetcher.Form>
                  </TableCell>
                )}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
};
