import type { ActionFunctionArgs, LoaderFunctionArgs } from 'react-router';
import { getAuth } from '~/lib/auth.server';

export const loader = async ({ request, context }: LoaderFunctionArgs) => {
  const auth = getAuth(context);

  return auth.handler(request);
};

export const action = async ({ request, context }: ActionFunctionArgs) => {
  const auth = getAuth(context);

  return auth.handler(request);
};
