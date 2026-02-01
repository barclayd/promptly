import { IconCheck } from '@tabler/icons-react';
import { Link } from 'react-router';
import { Badge } from '~/components/ui/badge';
import { Button } from '~/components/ui/button';
import type { PricingTier } from '~/lib/landing-data';
import { cn } from '~/lib/utils';

type PricingCardProps = PricingTier & {
  className?: string;
};

export const PricingCard = ({
  name,
  price,
  period,
  description,
  features,
  cta,
  popular,
  className,
}: PricingCardProps) => {
  return (
    <div
      className={cn(
        'relative flex flex-col p-8 rounded-2xl border transition-all duration-300',
        popular
          ? 'border-indigo-500/50 bg-gradient-to-b from-indigo-500/5 to-transparent shadow-xl shadow-indigo-500/10 dark:shadow-indigo-500/5 scale-105 z-10'
          : 'border-border/50 bg-card hover:border-border hover:shadow-lg hover:shadow-black/5 dark:hover:shadow-black/20',
        className,
      )}
    >
      {popular && (
        <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-indigo-500 text-white border-0">
          Most Popular
        </Badge>
      )}

      <div className="mb-6">
        <h3 className="text-xl font-semibold mb-2">{name}</h3>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>

      <div className="mb-6">
        <span className="text-4xl font-bold">{price}</span>
        <span className="text-muted-foreground">{period}</span>
      </div>

      <ul className="space-y-3 mb-8 flex-1">
        {features.map((feature) => (
          <li key={feature} className="flex items-start gap-3">
            <div
              className={cn(
                'shrink-0 size-5 rounded-full flex items-center justify-center mt-0.5',
                popular ? 'bg-indigo-500/10' : 'bg-emerald-500/10',
              )}
            >
              <IconCheck
                className={cn(
                  'size-3',
                  popular ? 'text-indigo-500' : 'text-emerald-500',
                )}
              />
            </div>
            <span className="text-sm text-foreground/80">{feature}</span>
          </li>
        ))}
      </ul>

      <Button
        size="lg"
        variant={popular ? 'default' : 'outline'}
        className={cn('w-full', popular && 'shadow-lg shadow-primary/25')}
        asChild
      >
        <Link to={name === 'Team' ? '/contact' : '/sign-up'}>{cta}</Link>
      </Button>
    </div>
  );
};
