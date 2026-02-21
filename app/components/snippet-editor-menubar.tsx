'use client';

import { IconCopy, IconLink, IconShare, IconTrash } from '@tabler/icons-react';
import { useState } from 'react';
import { useLocation } from 'react-router';
import { toast } from 'sonner';
import { DeleteSnippetDialog } from '~/components/delete-snippet-dialog';
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
};

export const SnippetEditorMenubar = ({
  snippet,
  isOwner,
}: SnippetEditorMenubarProps) => {
  const { canUndo, canRedo, undo, redo } = useSnippetUndoRedo();
  const location = useLocation();
  const [editDetailsOpen, setEditDetailsOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

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
    </Menubar>
  );
};
