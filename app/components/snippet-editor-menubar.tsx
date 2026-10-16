'use client';

import {
  IconArrowBackUp,
  IconCopy,
  IconLink,
  IconShare,
  IconTrash,
} from '@tabler/icons-react';
import { useState } from 'react';
import { useLocation, useRevalidator } from 'react-router';
import { toast } from 'sonner';
import { DeleteSnippetDialog } from '~/components/delete-snippet-dialog';
import { DiscardDraftDialog } from '~/components/discard-draft-dialog';
import { EditSnippetDetailsDialog } from '~/components/edit-snippet-details-dialog';
import {
  Menubar,
  MenubarContent,
  MenubarItem,
  MenubarMenu,
  MenubarSeparator,
  MenubarShortcut,
  MenubarSub,
  MenubarSubContent,
  MenubarSubTrigger,
  MenubarTrigger,
} from '~/components/ui/menubar';
import { useSnippetUndoRedo } from '~/hooks/use-snippet-undo-redo';

type SnippetEditorMenubarProps = {
  snippet: { id: string; name: string; description: string };
  isOwner: boolean;
  discardToVersion: string | null;
  onBeforeDiscard?: () => void;
  onDiscarded?: () => void;
};

export const SnippetEditorMenubar = ({
  snippet,
  isOwner,
  discardToVersion,
  onBeforeDiscard,
  onDiscarded,
}: SnippetEditorMenubarProps) => {
  const { canUndo, canRedo, undo, redo } = useSnippetUndoRedo();
  const location = useLocation();
  const [editDetailsOpen, setEditDetailsOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [discardDialogOpen, setDiscardDialogOpen] = useState(false);
  const [discardBusy, setDiscardBusy] = useState(false);
  const [discardError, setDiscardError] = useState<string | null>(null);
  const revalidator = useRevalidator();

  // ponytail: cancels the queued autosave only; a save already in flight can
  // land after the discard and recreate a draft. Gate on the fetcher if that bites.
  const discardDraft = async () => {
    setDiscardBusy(true);
    setDiscardError(null);
    onBeforeDiscard?.();
    try {
      const body = new FormData();
      body.set('snippetId', snippet.id);
      const response = await fetch('/api/snippets/discard', {
        method: 'POST',
        body,
      });
      if (!response.ok) {
        const { error } = (await response.json()) as { error?: string };
        setDiscardError(error ?? 'Unable to discard the draft.');
        return false;
      }
      await revalidator.revalidate();
      onDiscarded?.();
      return true;
    } catch {
      setDiscardError('Unable to discard the draft. Try again.');
      return false;
    } finally {
      setDiscardBusy(false);
    }
  };

  const handleCopyLink = async () => {
    const url = `${window.location.origin}${location.pathname}`;
    await navigator.clipboard.writeText(url);
  };

  const handleCopySnippetId = async () => {
    await navigator.clipboard.writeText(snippet.id);
    toast.success('Snippet ID copied to clipboard', {
      position: 'bottom-center',
    });
  };

  return (
    <Menubar className="w-fit">
      <MenubarMenu>
        <MenubarTrigger>File</MenubarTrigger>
        <MenubarContent>
          <MenubarSub>
            <MenubarSubTrigger>
              <IconShare className="size-4" />
              Share
            </MenubarSubTrigger>
            <MenubarSubContent>
              <MenubarItem onClick={handleCopyLink}>
                <IconLink className="size-4" />
                Copy link
              </MenubarItem>
              <MenubarItem onClick={handleCopySnippetId}>
                <IconCopy className="size-4" />
                Copy Snippet ID
              </MenubarItem>
            </MenubarSubContent>
          </MenubarSub>
          <MenubarSeparator />
          <MenubarItem
            variant="destructive"
            disabled={!discardToVersion}
            onClick={() => setDiscardDialogOpen(true)}
          >
            <IconArrowBackUp className="size-4" />
            Discard draft
          </MenubarItem>
          <MenubarItem
            variant="destructive"
            disabled={!isOwner}
            onClick={() => setDeleteDialogOpen(true)}
          >
            <IconTrash className="size-4" />
            Delete
          </MenubarItem>
        </MenubarContent>
      </MenubarMenu>
      <MenubarMenu>
        <MenubarTrigger>Edit</MenubarTrigger>
        <MenubarContent>
          <MenubarItem onClick={undo} disabled={!canUndo}>
            Undo <MenubarShortcut>⌘Z</MenubarShortcut>
          </MenubarItem>
          <MenubarItem onClick={redo} disabled={!canRedo}>
            Redo <MenubarShortcut>⇧⌘Z</MenubarShortcut>
          </MenubarItem>
          <MenubarSeparator />
          <MenubarItem onClick={() => setEditDetailsOpen(true)}>
            Edit Details...
          </MenubarItem>
        </MenubarContent>
      </MenubarMenu>
      <EditSnippetDetailsDialog
        open={editDetailsOpen}
        onOpenChange={setEditDetailsOpen}
        snippet={snippet}
      />
      <DeleteSnippetDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        snippet={snippet}
      />
      {discardToVersion && (
        <DiscardDraftDialog
          open={discardDialogOpen}
          onOpenChange={setDiscardDialogOpen}
          name={snippet.name}
          version={discardToVersion}
          discard={{
            busy: discardBusy,
            disabled: discardBusy,
            error: discardError,
            discard: discardDraft,
          }}
        />
      )}
    </Menubar>
  );
};
