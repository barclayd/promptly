import {
  browserAuthoringAction,
  browserAuthoringError,
} from '~/lib/authoring/browser.server';
import { AuthoringError } from '~/lib/authoring/types';
import type { Route } from './+types/authoring.save';

export const action = async (args: Route.ActionArgs) => {
  const form = await args.request.clone().formData();
  const kind = form.get('kind');
  if (kind !== 'prompt' && kind !== 'composer') {
    return browserAuthoringError(
      new AuthoringError('invalid_input', 'Choose a prompt or composer.'),
    );
  }
  return browserAuthoringAction(args, kind, 'save');
};
