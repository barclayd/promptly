'use client';

import {
  IconCheck,
  IconLoader2,
  IconMail,
  IconSend2,
} from '@tabler/icons-react';
import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import { cn } from '~/lib/utils';
import { Button } from './ui/button';

type NotifyState =
  | 'idle'
  | 'composing'
  | 'loading'
  | 'success'
  | 'already_notified'
  | 'error';

interface NotifyAdminButtonProps {
  variant: 'block' | 'inline' | 'compact';
  context?: string;
  className?: string;
  style?: React.CSSProperties;
  linkClassName?: string;
}

export const NotifyAdminButton = ({
  variant,
  context = 'general',
  className,
  style,
  linkClassName,
}: NotifyAdminButtonProps) => {
  const [state, setState] = useState<NotifyState>('idle');
  const [personalNote, setPersonalNote] = useState('');

  const sendNotification = useCallback(
    async (note?: string) => {
      setState('loading');
      try {
        const formData = new FormData();
        formData.set('context', context);
        if (note) formData.set('personalNote', note);

        const response = await fetch('/api/request-upgrade', {
          method: 'POST',
          body: formData,
        });

        const result = (await response.json()) as {
          success: boolean;
          alreadyNotified?: boolean;
        };

        if (result.success) {
          if (result.alreadyNotified) {
            setState('already_notified');
            toast(
              'Your admin was already notified — we\u2019ll only send one email per day',
              { icon: '\u2709\uFE0F' },
            );
          } else {
            setState('success');
            toast.success('Your admin has been notified via email');
          }
        } else {
          setState('error');
          toast.error('Something went wrong. Try again later.');
        }
      } catch {
        setState('error');
        toast.error('Something went wrong. Try again later.');
      }
    },
    [context],
  );

  if (variant === 'inline') {
    return (
      <InlineVariant
        state={state}
        onSend={() => sendNotification()}
        linkClassName={linkClassName}
        className={className}
        style={style}
      />
    );
  }

  if (variant === 'compact') {
    return (
      <CompactVariant
        state={state}
        onSend={() => sendNotification()}
        className={className}
        style={style}
      />
    );
  }

  return (
    <BlockVariant
      state={state}
      personalNote={personalNote}
      onNoteChange={setPersonalNote}
      onStartComposing={() => setState('composing')}
      onSend={() => sendNotification(personalNote || undefined)}
      className={className}
      style={style}
    />
  );
};

// --- Block variant ---

interface BlockVariantProps {
  state: NotifyState;
  personalNote: string;
  onNoteChange: (note: string) => void;
  onStartComposing: () => void;
  onSend: () => void;
  className?: string;
  style?: React.CSSProperties;
}

const BlockVariant = ({
  state,
  personalNote,
  onNoteChange,
  onStartComposing,
  onSend,
  className,
  style,
}: BlockVariantProps) => {
  if (state === 'success' || state === 'already_notified') {
    return (
      <div
        className={cn(
          'text-center py-3.5 px-5 rounded-xl bg-emerald-500/10 ring-1 ring-emerald-500/20',
          className,
        )}
        style={style}
      >
        <div className="flex items-center justify-center gap-2.5">
          <div className="flex size-5 items-center justify-center rounded-full bg-emerald-500/15">
            <IconCheck className="size-3 text-emerald-600 dark:text-emerald-400" />
          </div>
          <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
            Your admin has been notified
          </p>
        </div>
      </div>
    );
  }

  if (state === 'composing' || state === 'loading') {
    return (
      <div
        className={cn(
          'rounded-xl bg-muted/40 ring-1 ring-border/40 overflow-hidden',
          className,
        )}
        style={style}
      >
        {/* Composing header */}
        <div className="px-4 pt-3.5 pb-2.5">
          <label
            htmlFor="upgrade-note"
            className="text-[13px] font-medium text-foreground/70"
          >
            Add a note for your admin{' '}
            <span className="font-normal text-muted-foreground/60">
              (optional)
            </span>
          </label>
        </div>
        {/* Textarea area */}
        <div className="px-4 pb-3">
          <textarea
            id="upgrade-note"
            value={personalNote}
            onChange={(e) => onNoteChange(e.target.value)}
            placeholder="Hey, I need Pro to finish..."
            maxLength={280}
            rows={2}
            className="w-full rounded-lg border border-border/60 bg-background px-3 py-2.5 text-sm leading-relaxed placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-ring/40 focus:border-ring/40 resize-none transition-shadow"
            disabled={state === 'loading'}
          />
        </div>
        {/* Send button */}
        <div className="px-4 pb-4">
          <Button
            className="w-full gap-2.5"
            onClick={onSend}
            disabled={state === 'loading'}
          >
            {state === 'loading' ? (
              <>
                <IconLoader2 className="size-4 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <IconSend2 className="size-4" />
                Send notification
              </>
            )}
          </Button>
        </div>
      </div>
    );
  }

  if (state === 'error') {
    return (
      <div
        className={cn(
          'text-center py-3.5 px-5 rounded-xl bg-muted/50 ring-1 ring-border/50',
          className,
        )}
        style={style}
      >
        <p className="text-sm text-muted-foreground">
          Something went wrong. Try again later.
        </p>
      </div>
    );
  }

  // Idle state
  return (
    <button
      type="button"
      onClick={onStartComposing}
      className={cn(
        'w-full py-3.5 px-5 rounded-xl bg-muted/40 ring-1 ring-border/40 hover:bg-muted/70 hover:ring-border/60 transition-all duration-200 cursor-pointer group',
        className,
      )}
      style={style}
    >
      <div className="flex items-center gap-3.5">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-foreground/[0.06] ring-1 ring-foreground/[0.06] group-hover:bg-foreground/[0.09] transition-colors dark:bg-foreground/[0.08] dark:ring-foreground/[0.06] dark:group-hover:bg-foreground/[0.12]">
          <IconMail className="size-[18px] text-muted-foreground group-hover:text-foreground/70 transition-colors" />
        </div>
        <div className="text-left min-w-0">
          <p className="text-sm font-medium text-foreground/80 group-hover:text-foreground/90 transition-colors">
            Notify your admin
          </p>
          <p className="text-xs text-muted-foreground/70 mt-0.5">
            Let them know you'd like Pro
          </p>
        </div>
      </div>
    </button>
  );
};

// --- Inline variant ---

interface InlineVariantProps {
  state: NotifyState;
  onSend: () => void;
  linkClassName?: string;
  className?: string;
  style?: React.CSSProperties;
}

const InlineVariant = ({
  state,
  onSend,
  linkClassName,
  className,
  style,
}: InlineVariantProps) => {
  if (state === 'success' || state === 'already_notified') {
    return (
      <span className={cn('ml-1 opacity-75', className)} style={style}>
        Admin notified &#x2713;
      </span>
    );
  }

  if (state === 'loading') {
    return (
      <span className={cn('ml-1 opacity-75', className)} style={style}>
        Notifying...
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={onSend}
      className={cn(
        'ml-1 underline underline-offset-2 opacity-75 hover:opacity-100 transition-opacity cursor-pointer bg-transparent border-none p-0 font-inherit text-inherit',
        linkClassName,
        className,
      )}
      style={style}
    >
      Notify your admin
    </button>
  );
};

// --- Compact variant ---

interface CompactVariantProps {
  state: NotifyState;
  onSend: () => void;
  className?: string;
  style?: React.CSSProperties;
}

const CompactVariant = ({
  state,
  onSend,
  className,
  style,
}: CompactVariantProps) => {
  if (state === 'success' || state === 'already_notified') {
    return (
      <div className={cn('text-center', className)} style={style}>
        <div className="flex items-center justify-center gap-1.5">
          <IconCheck className="size-3.5 text-emerald-600 dark:text-emerald-400" />
          <span className="text-sm text-emerald-700 dark:text-emerald-300">
            Admin notified
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className={className} style={style}>
      <Button
        variant="outline"
        size="sm"
        className="w-full"
        onClick={onSend}
        disabled={state === 'loading'}
      >
        {state === 'loading' ? (
          <>
            <IconLoader2 className="size-3.5 animate-spin" />
            Notifying...
          </>
        ) : (
          <>
            <IconMail className="size-3.5" />
            Notify your admin
          </>
        )}
      </Button>
    </div>
  );
};
