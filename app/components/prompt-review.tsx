import { IconCopy, IconCornerDownLeft } from '@tabler/icons-react';
import { Check, CheckCircle2, InfoIcon, Loader2, Save } from 'lucide-react';
import { useEffect, useState } from 'react';

import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupText,
  InputGroupTextarea,
} from '~/components/ui/input-group';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '~/components/ui/tooltip';
import { cn } from '~/lib/utils';

const getPromptTooltipContent = (title: string) => {
  if (title === 'System Prompt') {
    return {
      heading: 'System Prompt',
      description:
        "Sets the AI's behavior and personality. Define the tone, rules, and context that apply to every response.",
      tip: 'Keep this static for prompt caching benefits. Place variables in the User Prompt instead.',
    };
  }
  return {
    heading: 'User Prompt',
    description:
      'The message template sent to the AI. Use ${variables} to insert dynamic values at runtime.',
  };
};

const formatRelativeTime = (timestamp: number): string => {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);

  if (seconds < 60) {
    return 'just now';
  }

  const minutes = Math.floor(seconds / 60);
  if (minutes === 1) {
    return '1 minute ago';
  }
  return `${minutes} minutes ago`;
};

const useRelativeTimeDisplay = (timestamp: number | null) => {
  const [display, setDisplay] = useState<string | null>(null);

  useEffect(() => {
    if (!timestamp) {
      setDisplay(null);
      return;
    }

    const update = () => setDisplay(formatRelativeTime(timestamp));
    update();

    const interval = setInterval(update, 60000);
    return () => clearInterval(interval);
  }, [timestamp]);

  return display;
};

const SaveStatus = ({
  isDirty,
  isPendingSave,
  isSaving,
  lastSavedAt,
}: {
  isDirty?: boolean;
  isPendingSave?: boolean;
  isSaving?: boolean;
  lastSavedAt?: number | null;
}) => {
  const relativeTime = useRelativeTimeDisplay(lastSavedAt ?? null);

  if (isPendingSave || isSaving) {
    return (
      <span className="inline-flex items-center gap-1.5 text-muted-foreground">
        <Loader2 className="size-3 animate-spin" />
        <span className="text-xs">Saving...</span>
      </span>
    );
  }

  if (relativeTime) {
    return (
      <span className="inline-flex items-center gap-1.5 text-muted-foreground animate-in fade-in duration-300">
        <CheckCircle2 className="size-3 text-emerald-500" />
        <span className="text-xs">
          Saved <span className="text-muted-foreground/70">{relativeTime}</span>
        </span>
      </span>
    );
  }

  if (!isDirty) {
    return (
      <span className="inline-flex items-center gap-1.5 text-muted-foreground/70">
        <CheckCircle2 className="size-3 text-emerald-500/70" />
        <span className="text-xs">Saved</span>
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 text-muted-foreground/60">
      <span className="size-1.5 rounded-full bg-muted-foreground/40" />
      <span className="text-xs italic">Unsaved changes</span>
    </span>
  );
};

export const PromptReview = ({
  title,
  value,
  onChange,
  isDirty,
  isPendingSave,
  isSaving,
  lastSavedAt,
  onTest,
  isTestRunning,
}: {
  title: string;
  value?: string;
  onChange?: (value: string) => void;
  isDirty?: boolean;
  isPendingSave?: boolean;
  isSaving?: boolean;
  lastSavedAt?: number | null;
  onTest?: () => void;
  isTestRunning?: boolean;
}) => {
  const isCurrentlySaving = isPendingSave || isSaving;
  const [copied, setCopied] = useState(false);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      onTest?.();
    }
  };

  const handleCopy = async () => {
    if (!value) return;
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 5000);
  };

  return (
    <div className="grid w-full gap-4">
      <InputGroup>
        <InputGroupTextarea
          id={`textarea-${title.toLowerCase().replace(/\s+/g, '-')}`}
          placeholder="Prompt text goes here"
          className={cn(
            'min-h-50 transition-opacity duration-200',
            isCurrentlySaving && 'opacity-90',
          )}
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
          onKeyDown={handleKeyDown}
          highlightVariables
        />
        <InputGroupAddon align="block-end" className="border-t">
          <InputGroupText className="min-w-0">
            <SaveStatus
              isDirty={isDirty}
              isPendingSave={isPendingSave}
              isSaving={isSaving}
              lastSavedAt={lastSavedAt}
            />
          </InputGroupText>
          <InputGroupButton
            size="sm"
            className="ml-auto"
            variant="default"
            onClick={onTest}
            disabled={isTestRunning}
          >
            {isTestRunning ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Running...
              </>
            ) : (
              <>
                Test <IconCornerDownLeft />
              </>
            )}
          </InputGroupButton>
        </InputGroupAddon>
        <InputGroupAddon align="block-start" className="border-b">
          <InputGroupText className="font-mono font-medium">
            {title}
          </InputGroupText>
          <div className="grow" />
          <Tooltip>
            <TooltipTrigger asChild>
              <InputGroupButton variant="ghost" size="icon-xs">
                <InfoIcon />
              </InputGroupButton>
            </TooltipTrigger>
            <TooltipContent
              side="bottom"
              className="max-w-72 p-3"
              sideOffset={4}
            >
              <p className="text-sm font-medium leading-none">
                {getPromptTooltipContent(title).heading}
              </p>
              <p className="mt-2 text-sm leading-relaxed opacity-90">
                {getPromptTooltipContent(title).description}
              </p>
              {getPromptTooltipContent(title).tip && (
                <p className="mt-2.5 border-t border-white/10 pt-2.5 text-xs leading-relaxed opacity-70">
                  {getPromptTooltipContent(title).tip}
                </p>
              )}
            </TooltipContent>
          </Tooltip>
          <InputGroupButton
            variant="ghost"
            size="icon-xs"
            className={cn(
              'transition-opacity duration-200',
              !isDirty && 'opacity-40 pointer-events-none',
            )}
            disabled={!isDirty}
          >
            {isCurrentlySaving ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Save className="cursor-not-allowed" />
            )}
          </InputGroupButton>
          <InputGroupButton variant="ghost" size="icon-xs" onClick={handleCopy}>
            {copied ? (
              <Check className="size-4 text-emerald-500 animate-in zoom-in duration-200" />
            ) : (
              <IconCopy />
            )}
          </InputGroupButton>
        </InputGroupAddon>
      </InputGroup>
    </div>
  );
};
