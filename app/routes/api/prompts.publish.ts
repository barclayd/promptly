import { browserAuthoringAction } from '~/lib/authoring/browser.server';
import type { Route } from './+types/prompts.publish';

export const action = (args: Route.ActionArgs) =>
  browserAuthoringAction(args, 'prompt', 'publish');
