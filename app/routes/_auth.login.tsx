import { data, redirect, useFetcher } from 'react-router';
import { z } from 'zod';
import { LoginForm } from '~/components/login-form';
import { getAuth } from '~/lib/auth.server';
import { loginSchema } from '~/lib/validations/auth';
import type { Route } from './+types/_auth.login';

// biome-ignore lint/correctness/noEmptyPattern: react router default
export const meta = ({}: Route.MetaArgs) => [
  { title: 'Promptly' },
  {
    name: 'description',
    content: 'Login | The CMS for building AI at scale',
  },
];

export const action = async ({ request, context }: Route.ActionArgs) => {
  const formData = await request.formData();
  const rawData = {
    email: formData.get('email'),
    password: formData.get('password'),
  };

  const result = loginSchema.safeParse(rawData);

  if (!result.success) {
    return data(
      { errors: z.flattenError(result.error).fieldErrors },
      { status: 400 },
    );
  }

  const auth = getAuth(context);

  try {
    const response = await auth.api.signInEmail({
      body: {
        email: result.data.email,
        password: result.data.password,
      },
      asResponse: true,
    });

    const setCookie = response.headers.get('set-cookie');

    return redirect('/', {
      headers: setCookie ? { 'Set-Cookie': setCookie } : {},
    });
  } catch (error) {
    console.error('Login error:', error);

    const message =
      error instanceof Error ? error.message : 'Invalid email or password';
    return data({ errors: { email: [message] } }, { status: 400 });
  }
};

export default function Login() {
  const fetcher = useFetcher();

  return (
    <div className="bg-muted flex min-h-svh flex-col items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm md:max-w-4xl">
        <LoginForm fetcher={fetcher} />
      </div>
    </div>
  );
}
