'use client';

import { IconAlertTriangle } from '@tabler/icons-react';
import type { Ref } from 'react';
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

type DiscardDraftDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  name: string;
  version: string;
  discard: {
    mount?: Ref<HTMLDivElement>;
    busy: boolean;
    disabled: boolean;
    retrying?: boolean;
    error?: string | null;
    discard: () => Promise<boolean>;
  };
};

export const DiscardDraftDialog = ({
  open,
  onOpenChange,
  name,
  version,
  discard,
}: DiscardDraftDialogProps) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent ref={discard.mount} className="sm:max-w-md">
      <form
        onSubmit={async (event) => {
          event.preventDefault();
          if (await discard.discard()) onOpenChange(false);
        }}
      >
        <DialogHeader>
          <div className="mx-auto sm:mx-0 flex size-12 items-center justify-center rounded-full bg-destructive/10 dark:bg-destructive/20">
            <IconAlertTriangle className="size-6 text-destructive" />
          </div>
          <DialogTitle className="pt-2">Discard draft</DialogTitle>
          <DialogDescription className="space-y-2">
            <span className="block">
              Your unpublished changes to{' '}
              <span className="font-medium text-foreground">{name}</span> will
              be removed and it will revert to{' '}
              <span className="font-medium text-foreground">v{version}</span>.
            </span>
            <span className="block text-destructive/90 dark:text-destructive">
              Published versions are not affected.
            </span>
          </DialogDescription>
        </DialogHeader>
        {discard.error && (
          <p role="alert" className="text-destructive text-sm py-4">
            {discard.error}
          </p>
        )}
        <DialogFooter className="pt-6">
          <DialogClose asChild>
            <Button variant="outline" type="button" disabled={discard.busy}>
              Cancel
            </Button>
          </DialogClose>
          <Button
            type="submit"
            variant="destructive"
            disabled={discard.disabled}
            className="gap-2"
          >
            {discard.busy ? (
              <>
                <span className="size-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Discarding...
              </>
            ) : discard.retrying ? (
              'Retry discard'
            ) : (
              'Discard draft'
            )}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
);
