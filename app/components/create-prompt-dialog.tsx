'use client';

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
  DialogTrigger,
} from '~/components/ui/dialog';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select';
import { Textarea } from '~/components/ui/textarea';

type ActionData = {
  errors?: {
    name?: string[];
    description?: string[];
    project?: string[];
  };
  success?: boolean;
};

interface CreatePromptDialogProps {
  children: React.ReactNode;
}

export const CreatePromptDialog = ({ children }: CreatePromptDialogProps) => {
  const fetcher = useFetcher<ActionData>();
  const errors = fetcher.data?.errors;
  const isSubmitting = fetcher.state === 'submitting';

  return (
    <Dialog>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <fetcher.Form method="post" action="/api/prompts/create">
          <DialogHeader>
            <DialogTitle>Create a new prompt</DialogTitle>
            <DialogDescription>
              Make a standalone prompt or add it to an existing project. Click
              save when you&apos;re done.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="prompt">Name</Label>
              <Input id="prompt" name="name" />
              {errors?.name && (
                <p className="text-destructive text-sm">{errors.name[0]}</p>
              )}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="description">Description</Label>
              <Textarea id="description" name="description" />
              {errors?.description && (
                <p className="text-destructive text-sm">
                  {errors.description[0]}
                </p>
              )}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="project">Project</Label>
              <Select name="project">
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a project" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="intro">Intro</SelectItem>
                  <SelectItem value="review">Review</SelectItem>
                  <SelectItem value="outro">Outro</SelectItem>
                </SelectContent>
              </Select>
              {errors?.project && (
                <p className="text-destructive text-sm">{errors.project[0]}</p>
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
        </fetcher.Form>
      </DialogContent>
    </Dialog>
  );
};
