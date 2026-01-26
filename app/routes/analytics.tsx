import { BarChart3 } from 'lucide-react';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '~/components/ui/empty';
import { orgContext } from '~/context';
import type { Route } from './+types/analytics';

// biome-ignore lint/correctness/noEmptyPattern: react router default
export const meta = ({}: Route.MetaArgs) => [
  { title: 'Analytics | Promptly' },
  {
    name: 'description',
    content: 'View analytics and insights for your prompts',
  },
];

export const loader = async ({ context }: Route.LoaderArgs) => {
  const org = context.get(orgContext);

  if (!org) {
    throw new Response('Unauthorized', { status: 403 });
  }

  return null;
};

const Analytics = () => {
  return (
    <div className="flex flex-1 flex-col">
      <div className="@container/main flex flex-1 flex-col gap-2 bg-gray-100">
        <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
          <div className="px-4 lg:px-6">
            <div className="flex items-start justify-between mb-6">
              <div>
                <h1 className="text-2xl font-semibold text-gray-900">
                  Analytics
                </h1>
                <p className="text-gray-500 text-sm mt-1">
                  View analytics and insights for your prompts
                </p>
              </div>
            </div>

            <div className="flex min-h-[60vh] items-center justify-center">
              <Empty>
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <BarChart3 />
                  </EmptyMedia>
                  <EmptyTitle>Analytics Coming Soon</EmptyTitle>
                  <EmptyDescription>
                    We're building powerful analytics to help you understand
                    your prompt performance. Stay tuned!
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Analytics;
