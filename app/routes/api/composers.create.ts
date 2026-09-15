import { browserAuthoringAction } from '~/lib/authoring/browser.server';
import type { Route } from './+types/composers.create';

export const action = (args: Route.ActionArgs) =>
  browserAuthoringAction(args, 'composer', 'create');
