import { IconPlayerPlay, IconVariable } from '@tabler/icons-react';
import { cn } from '~/lib/utils';

export const ProductMockup = ({ className }: { className?: string }) => {
  return (
    <div
      className={cn(
        'relative rounded-2xl border border-border/50 bg-card shadow-2xl shadow-black/10 dark:shadow-black/30 overflow-hidden',
        className,
      )}
    >
      {/* Window chrome */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border/50 bg-muted/30">
        <div className="flex gap-1.5">
          <div className="size-3 rounded-full bg-red-400/80" />
          <div className="size-3 rounded-full bg-yellow-400/80" />
          <div className="size-3 rounded-full bg-green-400/80" />
        </div>
        <div className="flex-1 flex justify-center">
          <div className="px-4 py-1 rounded-md bg-muted/50 text-xs text-muted-foreground font-medium">
            welcome-email.prompt
          </div>
        </div>
        <div className="w-[52px]" /> {/* Balance the dots */}
      </div>

      {/* Editor content */}
      <div className="p-6 space-y-4 font-mono text-sm">
        {/* System prompt indicator */}
        <div className="flex items-center gap-2 text-muted-foreground text-xs">
          <span className="px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-medium">
            SYSTEM
          </span>
          <span>prompt</span>
        </div>

        {/* Prompt content with typing animation */}
        <div className="space-y-3 text-foreground/90 leading-relaxed">
          <p>
            You are a friendly customer success assistant for{' '}
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 font-medium">
              <IconVariable className="size-3" />
              company_name
            </span>
            .
          </p>
          <p>
            Write a warm welcome email for{' '}
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-medium">
              <IconVariable className="size-3" />
              user_name
            </span>{' '}
            who just signed up for the{' '}
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-purple-500/10 text-purple-600 dark:text-purple-400 font-medium">
              <IconVariable className="size-3" />
              plan_type
            </span>{' '}
            plan.
          </p>
          <p className="text-muted-foreground">
            Keep it concise, helpful, and include next steps.
          </p>
        </div>

        {/* Blinking cursor */}
        <span
          className="inline-block w-2 h-5 bg-foreground/70 rounded-sm"
          style={{ animation: 'cursor-blink 1s step-end infinite' }}
        />
      </div>

      {/* Bottom toolbar */}
      <div className="flex items-center justify-between px-4 py-3 border-t border-border/50 bg-muted/20">
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span>3 variables</span>
          <span>GPT-4o</span>
          <span className="text-emerald-500">Saved</span>
        </div>
        <button
          type="button"
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-indigo-500 hover:bg-indigo-600 text-white text-xs font-medium transition-colors shadow-lg shadow-indigo-500/25"
        >
          <IconPlayerPlay className="size-3.5" />
          Test
        </button>
      </div>

      {/* Floating output preview */}
      <div className="absolute -bottom-4 -right-4 w-64 rounded-xl border border-border/50 bg-card shadow-xl shadow-black/10 dark:shadow-black/30 p-4 transform rotate-2 animate-float">
        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
          <div className="size-2 rounded-full bg-emerald-500 animate-pulse" />
          Output preview
        </div>
        <p className="text-xs text-foreground/80 leading-relaxed">
          Hi Sarah! Welcome to Acme Inc. We're thrilled to have you on the Pro
          plan...
        </p>
      </div>
    </div>
  );
};
