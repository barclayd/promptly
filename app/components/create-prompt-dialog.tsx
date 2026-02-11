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
import { useResourceLimits } from '~/hooks/use-resource-limits';
import { UpgradeGateModal } from './upgrade-gate-modal';

type ActionData = {
  errors?: {
    name?: string[];
    description?: string[];
  };
  limitExceeded?: boolean;
  resource?: 'prompts';
  current?: number;
  limit?: number;
};

interface CreatePromptDialogProps {
  children: React.ReactNode;
}

export const CreatePromptDialog = ({ children }: CreatePromptDialogProps) => {
  const actionData = useActionData<ActionData>();
  const location = useLocation();
  const navigation = useNavigation();
  const { canCreatePrompt, promptCount, promptLimit } = useResourceLimits();
  const [showUpgradeGate, setShowUpgradeGate] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const errors = actionData?.errors;
  const isSubmitting = navigation.state === 'submitting';

  // Server-side fallback: if the action returned limitExceeded, show the gate
  const serverLimitExceeded =
    actionData?.limitExceeded && actionData.resource === 'prompts';

  const handleDialogOpenChange = (open: boolean) => {
    if (open && !canCreatePrompt) {
      setShowUpgradeGate(true);
      return;
    }
    setDialogOpen(open);
  };

  return (
    <>
      <Dialog
        key={location.key}
        open={dialogOpen || serverLimitExceeded === true}
        onOpenChange={(open) => {
          if (serverLimitExceeded && !open) {
            // When closing after server limit exceeded, show upgrade gate
            setDialogOpen(false);
            setShowUpgradeGate(true);
            return;
          }
          handleDialogOpenChange(open);
        }}
      >
        <DialogTrigger asChild>{children}</DialogTrigger>
        <DialogContent
          id="onboarding-create-dialog"
          className="sm:max-w-106.25"
        >
          {serverLimitExceeded ? (
            // Server returned limit exceeded — close this and show gate
            <div className="py-4 text-center text-sm text-muted-foreground">
              Checking plan limits...
            </div>
          ) : (
            <Form method="post" action="/api/prompts/create">
              <DialogHeader>
                <DialogTitle>Create a new prompt</DialogTitle>
                <DialogDescription>
                  Create a new prompt. Click save when you&apos;re done.
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
          )}
        </DialogContent>
      </Dialog>

      <UpgradeGateModal
        open={showUpgradeGate}
        onOpenChange={setShowUpgradeGate}
        resource="prompts"
        current={actionData?.current ?? promptCount}
        limit={actionData?.limit ?? promptLimit}
      />
    </>
  );
};
