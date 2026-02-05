import { IconStarFilled } from '@tabler/icons-react';
import { cn } from '~/lib/utils';
import { NumberTicker } from './hero-demo/animations/number-ticker';

const AVATARS = [
  {
    id: 'avatar-1',
    url: 'https://images.keepfre.sh/app/images/user-1.webp',
  },
  {
    id: 'avatar-2',
    url: 'https://images.keepfre.sh/app/images/user-2.webp',
  },
  {
    id: 'avatar-3',
    url: 'https://images.keepfre.sh/app/images/user-3.webp',
  },
  {
    id: 'avatar-4',
    url: 'https://images.keepfre.sh/app/images/user-4.webp',
  },
  {
    id: 'avatar-5',
    url: 'https://images.keepfre.sh/app/images/user-5.webp',
  },
];

const STAR_IDS = ['star-1', 'star-2', 'star-3', 'star-4', 'star-5'];

export const SocialProofBadge = ({ className }: { className?: string }) => {
  return (
    <div
      className={cn('flex flex-col sm:flex-row items-center gap-4', className)}
    >
      {/* Avatar stack */}
      <div className="flex -space-x-2">
        {AVATARS.map((avatar) => (
          <img
            key={avatar.id}
            src={avatar.url}
            alt=""
            className="size-[30px] sm:size-[33px] rounded-full ring-2 ring-zinc-900 dark:ring-zinc-950 object-cover"
          />
        ))}
      </div>

      {/* Rating + text */}
      <div className="flex flex-col items-center sm:items-start gap-1">
        <div className="flex gap-0.5">
          {STAR_IDS.map((id) => (
            <IconStarFilled key={id} className="size-4 text-yellow-400" />
          ))}
        </div>
        <p className="text-sm text-muted-foreground">
          <NumberTicker
            value={122}
            from={0}
            delay={1000}
            duration={3000}
            className="font-semibold text-foreground"
          />{' '}
          teams ship AI faster
        </p>
      </div>
    </div>
  );
};
