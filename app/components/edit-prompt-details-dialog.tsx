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

type EditPromptDetailsDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  prompt: {
    id: string;
    name: string;
    description: string;
  };
};

export const EditPromptDetailsDialog = ({
  open,
  onOpenChange,
  prompt,
}: EditPromptDetailsDialogProps) => {
  const fetcher = useFetcher<ActionData>();
  const isSubmitting = fetcher.state === 'submitting';

  const [name, setName] = useState(prompt.name);
  const [description, setDescription] = useState(prompt.description);

  // Reset form values when dialog opens/closes
  const handleOpenChange = (isOpen: boolean) => {
    onOpenChange(isOpen);
    if (!isOpen) {
      setName(prompt.name);
      setDescription(prompt.description);
    }
  };

  // Close dialog on success
  useEffect(() => {
    if (fetcher.data?.success) {
      onOpenChange(false);
    }
  }, [fetcher.data, onOpenChange]);

  // Sync form values when prompt prop changes
  useEffect(() => {
    setName(prompt.name);
    setDescription(prompt.description);
  }, [prompt.name, prompt.description]);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <fetcher.Form method="post" action="/api/prompts/update">
          <input type="hidden" name="promptId" value={prompt.id} />
          <DialogHeader>
            <DialogTitle>Edit details</DialogTitle>
            <DialogDescription>
              Update the name and description for this prompt.
            </DialogDescription>
          </DialogHeader>
          <div className="py-6 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-prompt-name">Name</Label>
              <Input
                id="edit-prompt-name"
                name="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Prompt name"
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-prompt-description">Description</Label>
              <Textarea
                id="edit-prompt-description"
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
