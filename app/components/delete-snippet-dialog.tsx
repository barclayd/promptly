'use client';

import { IconAlertTriangle } from '@tabler/icons-react';
import { useEffect } from 'react';
import { useFetcher, useNavigate } from 'react-router';
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

type ActionData = { error?: string; success?: boolean };

type DeleteSnippetDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  snippet: { id: string; name: string };
};

export const DeleteSnippetDialog = ({
  open,
  onOpenChange,
  snippet,
}: DeleteSnippetDialogProps) => {
  const fetcher = useFetcher<ActionData>();
  const navigate = useNavigate();
  const isSubmitting = fetcher.state === 'submitting';

  useEffect(() => {
    if (fetcher.data?.success) {
      onOpenChange(false);
      navigate('/snippets');
    }
  }, [fetcher.data, onOpenChange, navigate]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <fetcher.Form method="post" action="/api/snippets/delete">
          <input type="hidden" name="snippetId" value={snippet.id} />
          <DialogHeader>
            <div className="mx-auto sm:mx-0 flex size-12 items-center justify-center rounded-full bg-destructive/10 dark:bg-destructive/20">
              <IconAlertTriangle className="size-6 text-destructive" />
            </div>
            <DialogTitle className="pt-2">Delete snippet</DialogTitle>
            <DialogDescription className="space-y-2">
              <span className="block">
                Are you sure you want to delete{' '}
                <span className="font-medium text-foreground">
                  {snippet.name}
                </span>
                ?
              </span>
              <span className="block text-destructive/90 dark:text-destructive">
                This action cannot be undone. Prompts referencing this snippet
                will no longer resolve its content.
              </span>
            </DialogDescription>
          </DialogHeader>
          {fetcher.data?.error && (
            <p className="text-destructive text-sm py-4">
              {fetcher.data.error}
            </p>
          )}
          <DialogFooter className="pt-6">
            <DialogClose asChild>
              <Button variant="outline" type="button" disabled={isSubmitting}>
                Cancel
              </Button>
            </DialogClose>
            <Button
              type="submit"
              variant="destructive"
              disabled={isSubmitting}
              className="gap-2"
            >
              {isSubmitting ? (
                <>
                  <span className="size-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Deleting...
                </>
              ) : (
                'Delete'
              )}
            </Button>
          </DialogFooter>
        </fetcher.Form>
      </DialogContent>
    </Dialog>
  );
};
