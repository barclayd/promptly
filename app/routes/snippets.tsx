import type { Route } from './+types/snippets';

// biome-ignore lint/correctness/noEmptyPattern: react router default
export const meta = ({}: Route.MetaArgs) => [
  { title: 'Snippets | Promptly' },
  {
    name: 'description',
    content: 'Manage your snippets',
  },
];

const Snippets = () => {
  return <div>Snippets</div>;
};

export default Snippets;
