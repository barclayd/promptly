import { browserAuthoringAction } from '~/lib/authoring/browser.server';
import type { Route } from './+types/composers.delete';

export const action = (args: Route.ActionArgs) =>
  browserAuthoringAction(args, 'composer', 'delete');
