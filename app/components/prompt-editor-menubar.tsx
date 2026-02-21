import { IconCopy, IconLink, IconShare, IconTrash } from '@tabler/icons-react';
import { useState } from 'react';
import { useLocation } from 'react-router';
import { toast } from 'sonner';
import { DeletePromptDialog } from '~/components/delete-prompt-dialog';
import { EditPromptDetailsDialog } from '~/components/edit-prompt-details-dialog';
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
import { useUndoRedo } from '~/hooks/use-undo-redo';

type PromptEditorMenubarProps = {
  prompt: {
    id: string;
    name: string;
    description: string;
  };
  isOwner: boolean;
};

export const PromptEditorMenubar = ({
  prompt,
  isOwner,
}: PromptEditorMenubarProps) => {
  const { canUndo, canRedo, undo, redo } = useUndoRedo();
  const location = useLocation();
  const [editDetailsOpen, setEditDetailsOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const handleCopyLink = async () => {
    const url = `${window.location.origin}${location.pathname}`;
    await navigator.clipboard.writeText(url);
  };

  const handleCopyPromptId = async () => {
    await navigator.clipboard.writeText(prompt.id);
    toast.success('Prompt ID copied to clipboard', {
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
              <MenubarItem onClick={handleCopyPromptId}>
                <IconCopy className="size-4" />
                Copy Prompt ID
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
      <EditPromptDetailsDialog
        open={editDetailsOpen}
        onOpenChange={setEditDetailsOpen}
        prompt={prompt}
      />
      <DeletePromptDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        prompt={prompt}
      />
    </Menubar>
  );
};
