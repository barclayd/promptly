'use client';

import {
  IconBrain,
  IconBrandGoogle,
  IconBrandOpenai,
  IconKey,
} from '@tabler/icons-react';
import { useNavigate } from 'react-router';
import { Button } from '~/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog';
import { useCanManageBilling } from '~/hooks/use-can-manage-billing';

const providers = [
  { icon: IconBrandOpenai, label: 'OpenAI' },
  { icon: IconBrain, label: 'Anthropic' },
  { icon: IconBrandGoogle, label: 'Google AI' },
];

interface NoLlmApiKeysModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const NoLlmApiKeysModal = ({
  open,
  onOpenChange,
}: NoLlmApiKeysModalProps) => {
  const navigate = useNavigate();
  const { canManageBilling } = useCanManageBilling();

  const handleGoToSettings = () => {
    onOpenChange(false);
    navigate('/settings?tab=llm-api-keys&open=create');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="space-y-3">
          <DialogTitle className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-full bg-teal-100 dark:bg-teal-900/30">
              <IconKey className="size-5 text-teal-600 dark:text-teal-400" />
            </div>
            Connect an AI provider
          </DialogTitle>
          <DialogDescription className="text-sm leading-relaxed">
            To test your prompts, add an API key for at least one provider. This
            takes about a minute.
          </DialogDescription>
        </DialogHeader>
        <div className="flex gap-2 py-4">
          {providers.map((p) => (
            <div
              key={p.label}
              className="flex items-center gap-2 rounded-full border bg-muted/50 px-3 py-1.5 text-sm text-muted-foreground"
            >
              <p.icon className="size-4" />
              {p.label}
            </div>
          ))}
        </div>
        <DialogFooter className="gap-3 pt-2 sm:flex-col">
          {canManageBilling ? (
            <Button onClick={handleGoToSettings} className="w-full">
              Go to Settings
            </Button>
          ) : (
            <Button disabled className="w-full">
              Contact your admin
            </Button>
          )}
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            className="w-full text-muted-foreground"
          >
            Not now
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
