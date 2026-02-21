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

type CreateSnippetDialogProps = {
  children?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

export const CreateSnippetDialog = ({
  children,
  open: controlledOpen,
  onOpenChange,
}: CreateSnippetDialogProps) => {
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
        <Form method="post" action="/api/snippets/create">
          <DialogHeader>
            <DialogTitle>Create a new snippet</DialogTitle>
            <DialogDescription>
              Create a reusable system prompt snippet that can be composed into
              multiple prompts.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="snippet-name">Name</Label>
              <Input
                id="snippet-name"
                name="name"
                placeholder="e.g. Brand Voice Guidelines"
                autoFocus
              />
              {errors?.name && (
                <p className="text-destructive text-sm">{errors.name[0]}</p>
              )}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="snippet-description">
                Description (optional)
              </Label>
              <Textarea
                id="snippet-description"
                name="description"
                rows={3}
                placeholder="What does this snippet do?"
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
