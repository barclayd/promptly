import { browserAuthoringAction } from '~/lib/authoring/browser.server';
import type { Route } from './+types/prompts.delete';

export const action = (args: Route.ActionArgs) =>
  browserAuthoringAction(args, 'prompt', 'delete');
