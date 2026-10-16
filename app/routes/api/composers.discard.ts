import { browserAuthoringAction } from '~/lib/authoring/browser.server';
import type { Route } from './+types/composers.discard';

export const action = (args: Route.ActionArgs) =>
  browserAuthoringAction(args, 'composer', 'discard');
