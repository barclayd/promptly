import { IconVariable } from '@tabler/icons-react';
import { cn } from '~/lib/utils';

type VariableBadgeProps = {
  name: string;
  variant: 'company' | 'user' | 'plan';
  visible?: boolean;
  className?: string;
};

const variantStyles = {
  company:
    'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-400',
  user: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-400',
  plan: 'bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-400',
};

export const VariableBadge = ({
  name,
  variant,
  visible = true,
  className,
}: VariableBadgeProps) => {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs font-medium transition-all duration-300',
        variantStyles[variant],
        visible ? 'opacity-100 scale-100' : 'opacity-0 scale-0',
        className,
      )}
      style={{
        animation: visible ? 'badge-pop 0.3s ease-out forwards' : 'none',
      }}
    >
      <IconVariable className="size-3" />
      {name}
    </span>
  );
};
