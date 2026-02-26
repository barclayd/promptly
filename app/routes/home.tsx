import { lazy, Suspense } from 'react';
import { Skeleton } from '~/components/ui/skeleton';
import type { Route } from './+types/home';

const ChartAreaInteractive = lazy(() =>
  import('~/components/chart-area-interactive').then((m) => ({
    default: m.ChartAreaInteractive,
  })),
);

// biome-ignore lint/correctness/noEmptyPattern: react router default
export const meta = ({}: Route.MetaArgs) => [
  { title: 'Promptly' },
  {
    name: 'description',
    content: 'The CMS for building AI at scale',
  },
];

export default function Home() {
  return (
    <div className="flex flex-1 flex-col">
      <div className="@container/main flex flex-1 flex-col gap-2">
        <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
          <div className="px-4 lg:px-6">
            <Suspense
              fallback={<Skeleton className="h-[300px] w-full rounded-xl" />}
            >
              <ChartAreaInteractive />
            </Suspense>
          </div>
        </div>
      </div>
    </div>
  );
}
