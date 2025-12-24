import type { ActionFunctionArgs, LoaderFunctionArgs } from 'react-router';
import { createAuth } from '~/lib/auth.server';

export const loader = async ({ request, context }: LoaderFunctionArgs) => {
  const auth = createAuth(context.cloudflare.env);
  return auth.handler(request);
};

export const action = async ({ request, context }: ActionFunctionArgs) => {
  const auth = createAuth(context.cloudflare.env);
  return auth.handler(request);
};
