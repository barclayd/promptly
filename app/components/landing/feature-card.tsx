import type { ComponentType } from 'react';
import { Badge } from '~/components/ui/badge';
import { cn } from '~/lib/utils';

type FeatureCardProps = {
  icon: ComponentType<{ className?: string }>;
  title: string;
  description: string;
  badge?: string | string[];
  className?: string;
};

export const FeatureCard = ({
  icon: Icon,
  title,
  description,
  badge,
  className,
}: FeatureCardProps) => {
  return (
    <div
      className={cn(
        'group relative p-6 rounded-2xl border border-border/50 bg-card hover:bg-card/80 transition-all duration-300 hover:shadow-lg hover:shadow-black/5 dark:hover:shadow-black/20 hover:border-border',
        className,
      )}
    >
      {/* Subtle gradient overlay on hover */}
      <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-indigo-500/5 via-transparent to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />

      <div className="relative space-y-4">
        <div className="flex items-start justify-between">
          <div className="size-11 rounded-xl bg-gradient-to-br from-indigo-500/10 to-purple-500/10 flex items-center justify-center group-hover:from-indigo-500/15 group-hover:to-purple-500/15 transition-colors">
            <Icon className="size-5 text-indigo-600 dark:text-indigo-400" />
          </div>
          {badge && (
            <div className="flex items-center gap-1.5">
              {(Array.isArray(badge) ? badge : [badge]).map((b) => (
                <Badge
                  key={b}
                  variant="secondary"
                  className={cn(
                    'text-[10px] font-medium px-2 py-0.5',
                    b === 'API' &&
                      'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700',
                  )}
                >
                  {b}
                </Badge>
              ))}
            </div>
          )}
        </div>

        <div>
          <h3 className="font-semibold text-foreground mb-2">{title}</h3>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {description}
          </p>
        </div>
      </div>
    </div>
  );
};
