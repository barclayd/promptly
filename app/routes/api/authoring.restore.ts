import {
  browserAuthoringAction,
  browserAuthoringError,
} from '~/lib/authoring/browser.server';
import { AuthoringError } from '~/lib/authoring/types';
import type { Route } from './+types/authoring.restore';

export const action = async (args: Route.ActionArgs) => {
  const form = await args.request.clone().formData();
  const kind = form.get('kind');
  if (kind !== 'prompt' && kind !== 'composer')
    return browserAuthoringError(
      new AuthoringError(
        'invalid_input',
        'A prompt or composer kind is required.',
      ),
    );
  return browserAuthoringAction(args, kind, 'restore');
};
