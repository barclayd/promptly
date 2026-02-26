import type { ActionFunctionArgs, LoaderFunctionArgs } from 'react-router';
import { authContext } from '~/context';

export const loader = async ({ request, context }: LoaderFunctionArgs) => {
  const auth = context.get(authContext);
  return auth.handler(request.clone() as unknown as Request);
};

export const action = async ({ request, context }: ActionFunctionArgs) => {
  const auth = context.get(authContext);
  return auth.handler(request.clone() as unknown as Request);
};
