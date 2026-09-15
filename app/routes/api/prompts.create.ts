import { browserAuthoringAction } from '~/lib/authoring/browser.server';
import type { Route } from './+types/prompts.create';

export const action = (args: Route.ActionArgs) =>
  browserAuthoringAction(args, 'prompt', 'create');
