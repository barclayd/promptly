import {
  browserAuthoringError,
  readBrowserAuthoringDocument,
} from '~/lib/authoring/browser.server';
import { AuthoringError } from '~/lib/authoring/types';
import type { Route } from './+types/authoring.read';

export const loader = async ({ request, context }: Route.LoaderArgs) => {
  try {
    const url = new URL(request.url);
    const kind = url.searchParams.get('kind');
    const id = url.searchParams.get('id');
    if ((kind !== 'prompt' && kind !== 'composer') || !id) {
      throw new AuthoringError(
        'invalid_input',
        'A prompt or composer ID is required.',
      );
    }
    return Response.json(
      await readBrowserAuthoringDocument(context, kind, id),
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    return browserAuthoringError(error);
  }
};
