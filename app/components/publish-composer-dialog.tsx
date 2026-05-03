'use client';

import {
  IconAlertTriangle,
  IconExternalLink,
  IconFileText,
  IconRss,
  IconTag,
} from '@tabler/icons-react';
import { useEffect, useState } from 'react';
import { useFetcher, useNavigate } from 'react-router';
import { PublishPromptDialog } from '~/components/publish-prompt-dialog';
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
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from '~/components/ui/item';
import { Label } from '~/components/ui/label';
import { VersionInput } from '~/components/ui/version-input';

type ActionData = {
  error?: string;
  success?: boolean;
};

export type UnresolvedReference = {
  promptId: string;
  promptName: string;
};

type PublishComposerDialogProps = {
  children: React.ReactNode;
  composerId: string;
  suggestedVersion: string;
  lastPublishedVersion: string | null;
  isSchemaChanged: boolean;
  unresolvedReferences: UnresolvedReference[];
  disabled?: boolean;
};

export const PublishComposerDialog = ({
  children,
  composerId,
  suggestedVersion,
  lastPublishedVersion,
  isSchemaChanged,
  unresolvedReferences,
  disabled,
}: PublishComposerDialogProps) => {
  const fetcher = useFetcher<ActionData>();
  const isSubmitting = fetcher.state === 'submitting';
  const navigate = useNavigate();

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
  const hasUnresolved = unresolvedReferences.length > 0;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild disabled={disabled}>
        {children}
      </DialogTrigger>
      <DialogContent
        className="sm:max-w-md"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        {hasUnresolved ? (
          <>
            <DialogHeader>
              <div className="flex size-10 items-center justify-center rounded-full bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400">
                <IconAlertTriangle size={20} />
              </div>
              <DialogTitle className="mt-3">Publish prompts first</DialogTitle>
              <DialogDescription>
                {unresolvedReferences.length === 1
                  ? 'This composer references a prompt that has no published version. Publish it before publishing the composer.'
                  : `This composer references ${unresolvedReferences.length} prompts that have no published version. Publish each one before publishing the composer.`}
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <ItemGroup className="gap-2">
                {unresolvedReferences.map((ref) => (
                  <Item key={ref.promptId} variant="outline" size="sm">
                    <ItemMedia variant="icon">
                      <IconFileText size={16} />
                    </ItemMedia>
                    <ItemContent>
                      <ItemTitle className="truncate">
                        {ref.promptName}
                      </ItemTitle>
                      <ItemDescription>No published version</ItemDescription>
                    </ItemContent>
                    <ItemActions>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setOpen(false);
                          navigate(`/prompts/${ref.promptId}`);
                        }}
                        title="Open prompt"
                      >
                        <IconExternalLink size={14} />
                      </Button>
                      <PublishPromptDialog
                        promptId={ref.promptId}
                        suggestedVersion="1.0.0"
                        lastPublishedVersion={null}
                        isSchemaChanged={false}
                      >
                        <Button type="button" size="sm">
                          <IconRss size={14} />
                          Publish
                        </Button>
                      </PublishPromptDialog>
                    </ItemActions>
                  </Item>
                ))}
              </ItemGroup>
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline" type="button">
                  Cancel
                </Button>
              </DialogClose>
            </DialogFooter>
          </>
        ) : (
          <fetcher.Form method="post" action="/api/composers/publish">
            <input type="hidden" name="composerId" value={composerId} />
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
                        ? 'Major version bump - schema fields changed'
                        : 'Minor version bump - content updated'}
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
                  <p className="text-destructive text-sm">
                    {fetcher.data.error}
                  </p>
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
        )}
      </DialogContent>
    </Dialog>
  );
};
