'use client';

import { IconMail, IconSend } from '@tabler/icons-react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select';
import { useResourceLimits } from '~/hooks/use-resource-limits';
import { roleDescriptions, roleLabels } from '~/lib/validations/team';
import { UpgradeGateModal } from './upgrade-gate-modal';

type ActionData = {
  success?: boolean;
  errors?: {
    email?: string[];
    role?: string[];
    _form?: string[];
  };
  limitExceeded?: boolean;
  resource?: 'team';
  current?: number;
  limit?: number;
};

interface InviteMemberDialogProps {
  children: React.ReactNode;
}

export const InviteMemberDialog = ({ children }: InviteMemberDialogProps) => {
  const actionData = useActionData<ActionData>();
  const location = useLocation();
  const navigation = useNavigation();
  const { canInviteMember, memberCount, memberLimit } = useResourceLimits();
  const [showUpgradeGate, setShowUpgradeGate] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const errors = actionData?.errors;
  const isSubmitting = navigation.state === 'submitting';

  // Server-side fallback: if the action returned limitExceeded, show the gate
  const serverLimitExceeded =
    actionData?.limitExceeded && actionData.resource === 'team';

  const handleDialogOpenChange = (open: boolean) => {
    if (open && !canInviteMember) {
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
            setDialogOpen(false);
            setShowUpgradeGate(true);
            return;
          }
          handleDialogOpenChange(open);
        }}
      >
        <DialogTrigger asChild>{children}</DialogTrigger>
        <DialogContent className="sm:max-w-md">
          {serverLimitExceeded ? (
            <div className="py-4 text-center text-sm text-muted-foreground">
              Checking plan limits...
            </div>
          ) : (
            <Form method="post" action="/api/team/invite">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <div className="flex size-8 items-center justify-center rounded-lg bg-muted">
                    <IconMail className="size-4 text-muted-foreground" />
                  </div>
                  Invite Team Member
                </DialogTitle>
                <DialogDescription>
                  Send an invitation to collaborate on your prompts.
                  They&apos;ll receive an email with instructions to join.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-5 py-5">
                <div className="grid gap-2">
                  <Label htmlFor="email" className="text-sm font-medium">
                    Email Address
                  </Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    placeholder="colleague@company.com"
                    autoComplete="email"
                    className="h-10"
                  />
                  {errors?.email && (
                    <p className="text-destructive text-sm flex items-center gap-1.5">
                      <span className="size-1 rounded-full bg-destructive" />
                      {errors.email[0]}
                    </p>
                  )}
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="role" className="text-sm font-medium">
                    Role
                  </Label>
                  <Select name="role" defaultValue="member">
                    <SelectTrigger className="w-full" size="lg">
                      <SelectValue placeholder="Select a role" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(roleLabels).map(([value, label]) => (
                        <SelectItem
                          key={value}
                          value={value}
                          className="py-2.5"
                        >
                          <div className="flex flex-col items-start gap-0.5">
                            <span className="font-medium">{label}</span>
                            <span className="text-xs text-muted-foreground">
                              {roleDescriptions[value]}
                            </span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors?.role && (
                    <p className="text-destructive text-sm flex items-center gap-1.5">
                      <span className="size-1 rounded-full bg-destructive" />
                      {errors.role[0]}
                    </p>
                  )}
                </div>
                {errors?._form && (
                  <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-3">
                    <p className="text-destructive text-sm">
                      {errors._form[0]}
                    </p>
                  </div>
                )}
              </div>
              <DialogFooter className="gap-2 sm:gap-0">
                <DialogClose asChild>
                  <Button variant="outline" type="button">
                    Cancel
                  </Button>
                </DialogClose>
                <Button type="submit" disabled={isSubmitting} className="gap-2">
                  {isSubmitting ? (
                    <>
                      <span className="size-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <IconSend className="size-4" />
                      Send Invitation
                    </>
                  )}
                </Button>
              </DialogFooter>
            </Form>
          )}
        </DialogContent>
      </Dialog>

      <UpgradeGateModal
        open={showUpgradeGate}
        onOpenChange={setShowUpgradeGate}
        resource="team"
        current={actionData?.current ?? memberCount}
        limit={actionData?.limit ?? memberLimit}
      />
    </>
  );
};
