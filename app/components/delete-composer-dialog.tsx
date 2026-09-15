'use client';

import { IconAlertTriangle } from '@tabler/icons-react';
import { useNavigate } from 'react-router';
import { Button } from '~/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog';
import { useAuthoringDialog } from '~/hooks/use-authoring-dialog';

type DeleteComposerDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  composer: { id: string; name: string };
};

export const DeleteComposerDialog = ({
  open,
  onOpenChange,
  composer,
}: DeleteComposerDialogProps) => {
  const authoring = useAuthoringDialog('composer', composer.id);
  const navigate = useNavigate();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent ref={authoring.mount} className="sm:max-w-md">
        <form
          onSubmit={async (event) => {
            event.preventDefault();
            if (await authoring.delete()) {
              onOpenChange(false);
              await navigate('/composers');
            }
          }}
        >
          <DialogHeader>
            <div className="mx-auto sm:mx-0 flex size-12 items-center justify-center rounded-full bg-destructive/10 dark:bg-destructive/20">
              <IconAlertTriangle className="size-6 text-destructive" />
            </div>
            <DialogTitle className="pt-2">Delete composer</DialogTitle>
            <DialogDescription className="space-y-2">
              <span className="block">
                Are you sure you want to delete{' '}
                <span className="font-medium text-foreground">
                  {composer.name}
                </span>
                ?
              </span>
              <span className="block text-destructive/90 dark:text-destructive">
                This action cannot be undone. Prompts referenced by this
                composer will not be affected.
              </span>
            </DialogDescription>
          </DialogHeader>
          {authoring.error && (
            <p role="alert" className="text-destructive text-sm py-4">
              {authoring.error}
            </p>
          )}
          <DialogFooter className="pt-6">
            <DialogClose asChild>
              <Button
                variant="outline"
                type="button"
                disabled={authoring.disabled}
              >
                Cancel
              </Button>
            </DialogClose>
            <Button
              type="submit"
              variant="destructive"
              disabled={authoring.disabled}
              className="gap-2"
            >
              {authoring.busy ? (
                <>
                  <span className="size-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Deleting...
                </>
              ) : authoring.retrying ? (
                'Retry delete'
              ) : (
                'Delete'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
