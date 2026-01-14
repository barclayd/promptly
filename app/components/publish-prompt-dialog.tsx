'use client';

import { IconTag } from '@tabler/icons-react';
import { useEffect, useState } from 'react';
import { useFetcher } from 'react-router';
import { Button } from '~/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '~/components/ui/dialog';
import {
  Item,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from '~/components/ui/item';
import { Label } from '~/components/ui/label';
import { VersionInput } from '~/components/ui/version-input';

type ActionData = {
  error?: string;
  success?: boolean;
};

type PublishPromptDialogProps = {
  children: React.ReactNode;
  promptId: string;
  folderId: string;
  suggestedVersion: string;
  lastPublishedVersion: number | null;
  isSchemaChanged: boolean;
  disabled?: boolean;
};

export const PublishPromptDialog = ({
  children,
  promptId,
  folderId,
  suggestedVersion,
  lastPublishedVersion,
  isSchemaChanged,
  disabled,
}: PublishPromptDialogProps) => {
  const fetcher = useFetcher<ActionData>();
  const isSubmitting = fetcher.state === 'submitting';

  const [version, setVersion] = useState(suggestedVersion);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setVersion(suggestedVersion);
  }, [suggestedVersion]);

  useEffect(() => {
    if (fetcher.data?.success) {
      setOpen(false);
    }
  }, [fetcher.data]);

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (!isOpen) {
      setVersion(suggestedVersion);
    }
  };

  const isFirstPublish = lastPublishedVersion === null;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild disabled={disabled}>
        {children}
      </DialogTrigger>
      <DialogContent
        className="sm:max-w-md"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <fetcher.Form method="post" action="/api/prompts/publish">
          <input type="hidden" name="promptId" value={promptId} />
          <input type="hidden" name="folderId" value={folderId} />
          <input type="hidden" name="version" value={version} />
          <DialogHeader>
            <DialogTitle>Publish version</DialogTitle>
            <DialogDescription>
              Publishing makes this version available for production use and
              accessible via the PromptlyCMS API.
            </DialogDescription>
          </DialogHeader>
          <div className="py-6">
            <Item variant="outline">
              <ItemMedia variant="icon">
                <IconTag size={16} />
              </ItemMedia>
              <ItemContent>
                <ItemTitle>Version {version || '?.?.?'}</ItemTitle>
                <ItemDescription>
                  {isFirstPublish
                    ? 'Initial release'
                    : isSchemaChanged
                      ? 'Major version bump — schema fields changed'
                      : 'Minor version bump — content updated'}
                </ItemDescription>
              </ItemContent>
            </Item>
            <div className="mt-6 space-y-2">
              <Label>Version number</Label>
              <VersionInput
                value={version}
                onChange={setVersion}
                autoFocus={open}
              />
              {fetcher.data?.error && (
                <p className="text-destructive text-sm">{fetcher.data.error}</p>
              )}
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" type="button">
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" disabled={isSubmitting || !version}>
              {isSubmitting ? 'Publishing...' : 'Publish'}
            </Button>
          </DialogFooter>
        </fetcher.Form>
      </DialogContent>
    </Dialog>
  );
};
