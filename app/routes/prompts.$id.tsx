import { PromptEntry } from '~/components/prompt-entry';
import { Separator } from '~/components/ui/separator';
import type { Route } from './+types/home';

// biome-ignore lint/correctness/noEmptyPattern: react router default
export function meta({}: Route.MetaArgs) {
  return [
    { title: 'Promptly' },
    {
      name: 'description',
      content:
        'The modern CMS for high performing teams to ship effective AI products at speed',
    },
  ];
}

export default function Home() {
  return (
    <div className="flex flex-1 flex-col">
      <div className="@container/main flex flex-1 flex-col gap-2">
        <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
          <div className="px-4 lg:px-6 flex flex-col gap-y-4">
            <h1 className="text-3xl">Review</h1>
            <p className="text-secondary-foreground">
              Selects and modifies a customer review that will most likely lead
              to an uplift in conversion
            </p>
            <Separator className="my-4" />
            <PromptEntry title="System Prompt" />
            <PromptEntry title="User Prompt" />
          </div>
        </div>
      </div>
    </div>
  );
}
