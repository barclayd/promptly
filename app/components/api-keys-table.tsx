'use client';

import { IconKey, IconTrash } from '@tabler/icons-react';
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
import { scopeLabels } from '~/lib/validations/settings';

type ApiKey = {
  id: string;
  name: string | null;
  start: string | null;
  prefix: string | null;
  createdAt: number;
  lastRequest: number | null;
  permissions: Record<string, string[]> | null;
};

interface ApiKeysTableProps {
  apiKeys: ApiKey[];
}

const formatKeyPreview = (prefix: string | null, start: string | null): string => {
  const prefixStr = prefix || 'promptly_';
  const prefixLength = prefixStr.length;

  // Extract unique characters after the prefix from the start field
  // Better Auth stores the first N characters of the full key (including prefix)
  const uniqueChars = start && start.length > prefixLength
    ? start.slice(prefixLength)
    : null;

  // Show unique chars if available, otherwise show asterisks
  const displayChars = uniqueChars || '****';

  return `${prefixStr}${displayChars}${'*'.repeat(16)}`;
};

const formatDate = (timestamp: number | null): string => {
  if (!timestamp) return 'Never';
  return new Date(timestamp).toLocaleDateString('en-GB', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

const permissionsToScopes = (permissions: Record<string, string[]> | null): string[] => {
  if (!permissions) return [];
  const scopes: string[] = [];
  for (const [resource, actions] of Object.entries(permissions)) {
    for (const action of actions) {
      scopes.push(`${resource}:${action}`);
    }
  }
  return scopes;
};

export const ApiKeysTable = ({ apiKeys }: ApiKeysTableProps) => {
  const fetcher = useFetcher();

  return (
    <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/30 hover:bg-muted/30">
            <TableHead className="font-semibold text-foreground">Name</TableHead>
            <TableHead className="font-semibold text-foreground">Key</TableHead>
            <TableHead className="font-semibold text-foreground">Scopes</TableHead>
            <TableHead className="font-semibold text-foreground">Created</TableHead>
            <TableHead className="font-semibold text-foreground">Last Used</TableHead>
            <TableHead className="font-semibold text-foreground w-16">
              <span className="sr-only">Actions</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {apiKeys.map((apiKey) => {
            const scopes = permissionsToScopes(apiKey.permissions);
            const isDeleting = fetcher.state !== 'idle' && fetcher.formData?.get('keyId') === apiKey.id;

            return (
              <TableRow key={apiKey.id} className={isDeleting ? 'opacity-50' : ''}>
                <TableCell className="py-3">
                  <div className="flex items-center gap-2">
                    <IconKey className="size-4 text-muted-foreground" />
                    <span className="font-medium text-foreground">
                      {apiKey.name || 'Unnamed Key'}
                    </span>
                  </div>
                </TableCell>
                <TableCell>
                  <code className="text-sm bg-muted px-2 py-1 rounded text-muted-foreground font-mono">
                    {formatKeyPreview(apiKey.prefix, apiKey.start)}
                  </code>
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {scopes.length > 0 ? (
                      scopes.map((scope) => (
                        <Badge key={scope} variant="secondary" className="text-xs">
                          {scopeLabels[scope] || scope}
                        </Badge>
                      ))
                    ) : (
                      <span className="text-muted-foreground text-sm">No scopes</span>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {formatDate(apiKey.createdAt)}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {formatDate(apiKey.lastRequest)}
                </TableCell>
                <TableCell>
                  <fetcher.Form method="post" action="/api/settings/delete-api-key">
                    <input type="hidden" name="keyId" value={apiKey.id} />
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
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
};
