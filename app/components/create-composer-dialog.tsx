'use client';

import { useState } from 'react';
import { Form, useActionData, useLocation, useNavigation } from 'react-router';
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
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { Textarea } from '~/components/ui/textarea';

type ActionData = {
  errors?: { name?: string[]; description?: string[] };
};

type CreateComposerDialogProps = {
  children?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

export const CreateComposerDialog = ({
  children,
  open: controlledOpen,
  onOpenChange,
}: CreateComposerDialogProps) => {
  const actionData = useActionData<ActionData>();
  const navigation = useNavigation();
  const location = useLocation();
  const [internalOpen, setInternalOpen] = useState(false);
  const dialogOpen = controlledOpen ?? internalOpen;
  const setDialogOpen = onOpenChange ?? setInternalOpen;
  const errors = actionData?.errors;
  const isSubmitting = navigation.state === 'submitting';

  return (
    <Dialog key={location.key} open={dialogOpen} onOpenChange={setDialogOpen}>
      {children && <DialogTrigger asChild>{children}</DialogTrigger>}
      <DialogContent className="sm:max-w-106.25">
        <Form method="post" action="/api/composers/create">
          <DialogHeader>
            <DialogTitle>Create a new composer</DialogTitle>
            <DialogDescription>
              Create a composer that orchestrates multiple prompts into a single
              output.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="composer-name">Name</Label>
              <Input
                id="composer-name"
                name="name"
                placeholder="e.g. Blog Post Generator"
                autoFocus
              />
              {errors?.name && (
                <p className="text-destructive text-sm">{errors.name[0]}</p>
              )}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="composer-description">
                Description (optional)
              </Label>
              <Textarea
                id="composer-description"
                name="description"
                rows={3}
                placeholder="What does this composer do?"
              />
              {errors?.description && (
                <p className="text-destructive text-sm">
                  {errors.description[0]}
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
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Creating...' : 'Create'}
            </Button>
          </DialogFooter>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
