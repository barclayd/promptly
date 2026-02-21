import type { Route } from './+types/snippets.snippetId';

// biome-ignore lint/correctness/noEmptyPattern: react router default
export const meta = ({}: Route.MetaArgs) => [{ title: 'Snippet | Promptly' }];

const SnippetDetail = () => {
  return <div>Snippet Detail</div>;
};

export default SnippetDetail;
