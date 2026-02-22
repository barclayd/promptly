'use client';

import { IconCopy, IconLink, IconShare, IconTrash } from '@tabler/icons-react';
import { useState } from 'react';
import { useLocation } from 'react-router';
import { toast } from 'sonner';
import { DeleteComposerDialog } from '~/components/delete-composer-dialog';
import { EditComposerDetailsDialog } from '~/components/edit-composer-details-dialog';
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
import { useComposerUndoRedo } from '~/hooks/use-composer-undo-redo';

type ComposerEditorMenubarProps = {
  composer: { id: string; name: string; description: string };
  isOwner: boolean;
};

export const ComposerEditorMenubar = ({
  composer,
  isOwner,
}: ComposerEditorMenubarProps) => {
  const { canUndo, canRedo, undo, redo } = useComposerUndoRedo();
  const location = useLocation();
  const [editDetailsOpen, setEditDetailsOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const handleCopyLink = async () => {
    const url = `${window.location.origin}${location.pathname}`;
    await navigator.clipboard.writeText(url);
  };

  const handleCopyComposerId = async () => {
    await navigator.clipboard.writeText(composer.id);
    toast.success('Composer ID copied to clipboard', {
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
              <MenubarItem onClick={handleCopyComposerId}>
                <IconCopy className="size-4" />
                Copy Composer ID
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
      <EditComposerDetailsDialog
        open={editDetailsOpen}
        onOpenChange={setEditDetailsOpen}
        composer={composer}
      />
      <DeleteComposerDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        composer={composer}
      />
    </Menubar>
  );
};
