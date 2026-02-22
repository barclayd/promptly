'use client';

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
} from '~/components/ui/dialog';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { Textarea } from '~/components/ui/textarea';

type ActionData = {
  error?: string;
  success?: boolean;
};

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
  const fetcher = useFetcher<ActionData>();
  const isSubmitting = fetcher.state === 'submitting';
  const [name, setName] = useState(composer.name);
  const [description, setDescription] = useState(composer.description);

  const handleOpenChange = (isOpen: boolean) => {
    onOpenChange(isOpen);
    if (!isOpen) {
      setName(composer.name);
      setDescription(composer.description);
    }
  };

  useEffect(() => {
    if (fetcher.data?.success) {
      onOpenChange(false);
    }
  }, [fetcher.data, onOpenChange]);

  useEffect(() => {
    setName(composer.name);
    setDescription(composer.description);
  }, [composer.name, composer.description]);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <fetcher.Form method="post" action="/api/composers/update">
          <input type="hidden" name="composerId" value={composer.id} />
          <DialogHeader>
            <DialogTitle>Edit composer details</DialogTitle>
            <DialogDescription>
              Update the name and description for this composer.
            </DialogDescription>
          </DialogHeader>
          <div className="py-6 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-composer-name">Name</Label>
              <Input
                id="edit-composer-name"
                name="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Composer name"
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-composer-description">Description</Label>
              <Textarea
                id="edit-composer-description"
                name="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional description"
                rows={3}
              />
            </div>
            {fetcher.data?.error && (
              <p className="text-destructive text-sm">{fetcher.data.error}</p>
            )}
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" type="button">
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" disabled={isSubmitting || !name.trim()}>
              {isSubmitting ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </fetcher.Form>
      </DialogContent>
    </Dialog>
  );
};
