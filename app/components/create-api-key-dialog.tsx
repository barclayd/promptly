'use client';

import {
  IconAlertTriangle,
  IconCheck,
  IconCopy,
  IconKey,
} from '@tabler/icons-react';
import { useCallback, useRef, useState } from 'react';
import { useFetcher } from 'react-router';
import { Button } from '~/components/ui/button';
import { Checkbox } from '~/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '~/components/ui/dialog';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import {
  availableScopes,
  scopeDescriptions,
  scopeLabels,
} from '~/lib/validations/settings';

type ActionData = {
  success?: boolean;
  apiKey?: {
    key: string;
    id: string;
    name: string;
  };
  errors?: {
    name?: string[];
    scopes?: string[];
    _form?: string[];
  };
};

interface CreateApiKeyDialogProps {
  children: React.ReactNode;
}

export const CreateApiKeyDialog = ({ children }: CreateApiKeyDialogProps) => {
  const fetcher = useFetcher<ActionData>();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  // Store the created key in state to persist it after page revalidation
  const [storedKey, setStoredKey] = useState<string | null>(null);
  const lastFetcherDataRef = useRef<ActionData | undefined>(undefined);

  const isSubmitting = fetcher.state === 'submitting';
  const errors = fetcher.data?.errors;

  // Track fetcher data changes and store the key when created
  // Only process when dialog is open to prevent stale data on reopen
  const isNewFetcherData = open && fetcher.data !== lastFetcherDataRef.current;
  const hasNewApiKey =
    isNewFetcherData && fetcher.data?.apiKey?.key && !storedKey;

  if (isNewFetcherData) {
    lastFetcherDataRef.current = fetcher.data;
  }

  if (hasNewApiKey) {
    setStoredKey(fetcher.data.apiKey.key);
  }

  const createdKey = storedKey;

  const handleCopy = useCallback(async () => {
    if (createdKey) {
      await navigator.clipboard.writeText(createdKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [createdKey]);

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    if (!newOpen) {
      // Reset UI state when dialog closes
      // Note: Don't reset lastFetcherDataRef - keeping it synced with fetcher.data
      // prevents stale data from being processed as "new" on reopen
      setCopied(false);
      setStoredKey(null);
    }
  };

  const handleClose = () => {
    setOpen(false);
    setCopied(false);
    setStoredKey(null);
  };

  // Show key created view
  if (createdKey) {
    return (
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogTrigger asChild>{children}</DialogTrigger>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader className="space-y-3">
            <DialogTitle className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
                <IconCheck className="size-5 text-green-600 dark:text-green-400" />
              </div>
              API Key Created
            </DialogTitle>
            <DialogDescription className="text-sm leading-relaxed">
              Your API key has been created successfully. Make sure to copy it
              now - you won't be able to see it again.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-5 py-2">
            <div className="flex items-start gap-3 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/20 p-4">
              <IconAlertTriangle className="mt-0.5 size-5 shrink-0 text-amber-600 dark:text-amber-400" />
              <p className="text-sm leading-relaxed text-amber-800 dark:text-amber-200">
                This is the only time you'll see this key. Store it securely -
                it cannot be recovered if lost.
              </p>
            </div>
            <div className="space-y-2.5">
              <Label className="text-sm font-medium">Your API Key</Label>
              <div className="flex gap-2">
                <code className="flex-1 break-all rounded-lg border bg-muted px-4 py-3 font-mono text-sm">
                  {createdKey}
                </code>
                <Button
                  type="button"
                  variant={copied ? 'default' : 'outline'}
                  onClick={handleCopy}
                  className={`shrink-0 min-w-[100px] transition-all duration-200 ${
                    copied
                      ? 'bg-green-600 hover:bg-green-600 text-white'
                      : 'hover:border-muted-foreground'
                  }`}
                >
                  {copied ? (
                    <>
                      <IconCheck className="size-4" />
                      Copied
                    </>
                  ) : (
                    <>
                      <IconCopy className="size-4" />
                      Copy
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
          <DialogFooter className="pt-4 sm:flex-col sm:space-y-2">
            <Button onClick={handleClose} size="lg" className="w-full">
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  // Show create form
  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <fetcher.Form method="post" action="/api/settings/create-api-key">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="flex size-8 items-center justify-center rounded-lg bg-muted">
                <IconKey className="size-4 text-muted-foreground" />
              </div>
              Create API Key
            </DialogTitle>
            <DialogDescription>
              Create an API key to access your prompts programmatically.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-5 py-5">
            <div className="grid gap-2">
              <Label htmlFor="name" className="text-sm font-medium">
                Name
              </Label>
              <Input
                id="name"
                name="name"
                placeholder="e.g. Staging API Key"
                className="h-10"
              />
              {errors?.name && (
                <p className="text-destructive text-sm flex items-center gap-1.5">
                  <span className="size-1 rounded-full bg-destructive" />
                  {errors.name[0]}
                </p>
              )}
            </div>
            <div className="grid gap-2">
              <Label className="text-sm font-medium">Scopes</Label>
              <div className="space-y-3 rounded-lg border p-3">
                {availableScopes.map((scope) => (
                  <div key={scope} className="flex items-start gap-3">
                    <Checkbox
                      id={scope}
                      name="scopes"
                      value={scope}
                      defaultChecked
                    />
                    <div className="grid gap-0.5">
                      <Label
                        htmlFor={scope}
                        className="text-sm font-medium cursor-pointer"
                      >
                        {scopeLabels[scope]}
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        {scopeDescriptions[scope]}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
              {errors?.scopes && (
                <p className="text-destructive text-sm flex items-center gap-1.5">
                  <span className="size-1 rounded-full bg-destructive" />
                  {errors.scopes[0]}
                </p>
              )}
            </div>
            {errors?._form && (
              <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-3">
                <p className="text-destructive text-sm">{errors._form[0]}</p>
              </div>
            )}
          </div>
          <DialogFooter className="gap-3 pt-2">
            <Button
              variant="ghost"
              type="button"
              onClick={() => setOpen(false)}
              className="text-muted-foreground hover:text-foreground"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="min-w-[140px] transition-all duration-200"
            >
              {isSubmitting ? (
                <span className="flex items-center gap-2">
                  <span className="size-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Creating...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <IconKey className="size-4" />
                  Create API Key
                </span>
              )}
            </Button>
          </DialogFooter>
        </fetcher.Form>
      </DialogContent>
    </Dialog>
  );
};
