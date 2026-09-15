import { browserAuthoringAction } from '~/lib/authoring/browser.server';
import type { Route } from './+types/prompts.save-snippets';

export const action = (args: Route.ActionArgs) =>
  browserAuthoringAction(args, 'prompt', 'references');
