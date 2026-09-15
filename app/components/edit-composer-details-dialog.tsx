'use client';

import { useCallback, useState } from 'react';
import { Link } from 'react-router';
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
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { Textarea } from '~/components/ui/textarea';
import { useAuthoringDialog } from '~/hooks/use-authoring-dialog';

type EditComposerDetailsDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  composer: { id: string; name: string; description: string };
};

export const EditComposerDetailsDialog = ({
  open,
  onOpenChange,
  composer,
}: EditComposerDetailsDialogProps) => {
  const authoring = useAuthoringDialog('composer', composer.id);
  const [hasName, setHasName] = useState(false);
  const nameRef = useCallback((node: HTMLInputElement | null) => {
    if (node) setHasName(node.value.trim().length > 0);
  }, []);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent ref={authoring.mount} className="sm:max-w-md">
        <form
          onSubmit={async (event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            const name = String(form.get('name') ?? '');
            if (!name.trim()) return;
            if (
              await authoring.saveDetails({
                name,
                description: String(form.get('description') ?? ''),
              })
            )
              onOpenChange(false);
          }}
        >
          <DialogHeader>
            <DialogTitle>Edit composer details</DialogTitle>
            <DialogDescription>
              Update the name and description for this composer.
            </DialogDescription>
          </DialogHeader>
          <div className="py-6 space-y-4">
            {authoring.loading ? (
              <p className="text-sm text-muted-foreground">
                Loading current details...
              </p>
            ) : (
              authoring.initialDetails && (
                <fieldset disabled={authoring.busy} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit-composer-name">Name</Label>
                    <Input
                      id="edit-composer-name"
                      name="name"
                      ref={nameRef}
                      onChange={(event) =>
                        setHasName(event.currentTarget.value.trim().length > 0)
                      }
                      defaultValue={authoring.initialDetails.name}
                      required
                      placeholder="Composer name"
                      autoFocus
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-composer-description">
                      Description
                    </Label>
                    <Textarea
                      id="edit-composer-description"
                      name="description"
                      defaultValue={authoring.initialDetails.description}
                      placeholder="Optional description"
                      rows={3}
                    />
                  </div>
                </fieldset>
              )
            )}
            {authoring.error && (
              <p role="alert" className="text-destructive text-sm">
                {authoring.error}{' '}
                {authoring.snapshot?.conflict && (
                  <Link to={`/composers/${composer.id}`} className="underline">
                    Open editor
                  </Link>
                )}
              </p>
            )}
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" type="button">
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" disabled={authoring.disabled || !hasName}>
              {authoring.busy
                ? 'Saving...'
                : authoring.retrying
                  ? 'Retry save'
                  : 'Save'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
