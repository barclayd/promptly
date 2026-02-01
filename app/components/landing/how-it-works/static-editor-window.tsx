import { IconVariable } from '@tabler/icons-react';
import { cn } from '~/lib/utils';
import { DemoWindowFrame } from '../hero-demo/demo-window-frame';

type StaticVariableBadgeProps = {
  name: string;
  variant: 'company' | 'user' | 'plan';
};

const variantStyles = {
  company:
    'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-400',
  user: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-400',
  plan: 'bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-400',
};

const StaticVariableBadge = ({ name, variant }: StaticVariableBadgeProps) => {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs font-medium',
        variantStyles[variant],
      )}
    >
      <IconVariable className="size-3" />
      {name}
    </span>
  );
};

export const StaticEditorWindow = () => {
  return (
    <DemoWindowFrame
      title="Promptly"
      bottomBar={
        <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
          <span>3 variables</span>
          <span className="text-emerald-500">Saved ✓</span>
          <span className="px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-[10px]">
            Claude Sonnet 4.5
          </span>
        </div>
      }
    >
      <div className="p-4 h-[200px] overflow-hidden">
        {/* System prompt label */}
        <div className="flex items-center gap-2 text-muted-foreground text-[10px] mb-3">
          <span className="px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-medium">
            SYSTEM
          </span>
          <span>prompt</span>
        </div>

        {/* Prompt content */}
        <div className="text-xs sm:text-sm leading-relaxed text-foreground/90 font-mono">
          <span>You are a friendly customer success assistant for </span>
          <StaticVariableBadge name="company_name" variant="company" />
          <span>.</span>

          {/* User prompt label */}
          <div className="flex items-center gap-2 text-muted-foreground text-[10px] mt-3 mb-1">
            <span className="px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-medium font-sans">
              USER
            </span>
            <span className="font-sans">prompt</span>
          </div>

          <span>Write a warm welcome email for </span>
          <StaticVariableBadge name="user_name" variant="user" />
          <span> who just signed up for the </span>
          <StaticVariableBadge name="plan_type" variant="plan" />
          <span> plan.</span>
        </div>
      </div>
    </DemoWindowFrame>
  );
};
