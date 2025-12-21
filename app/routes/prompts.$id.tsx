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
    <div className="px-4 lg:px-6">
      <h1>Prompts</h1>
    </div>
  );
}
