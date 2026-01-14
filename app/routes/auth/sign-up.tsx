import { nanoid } from 'nanoid';
import { data, redirect, useFetcher } from 'react-router';
import { z } from 'zod';
import { SignUpForm } from '~/components/sign-up-form';
import { getAuth } from '~/lib/auth.server';
import { signUpSchema } from '~/lib/validations/auth';
import type { Route } from './+types/sign-up';

// biome-ignore lint/correctness/noEmptyPattern: react router default
export const meta = ({}: Route.MetaArgs) => [
  { title: 'Promptly' },
  {
    name: 'description',
    content: 'Signup | The CMS for building AI at scale',
  },
];

export const action = async ({ request, context }: Route.ActionArgs) => {
  const formData = await request.formData();
  const rawData = {
    name: formData.get('name'),
    email: formData.get('email'),
    password: formData.get('password'),
    confirmPassword: formData.get('confirmPassword'),
  };

  const result = signUpSchema.safeParse(rawData);

  if (!result.success) {
    return data(
      { errors: z.flattenError(result.error).fieldErrors },
      { status: 400 },
    );
  }

  const auth = getAuth(context);

  try {
    const response = await auth.api.signUpEmail({
      body: {
        name: result.data.name,
        email: result.data.email,
        password: result.data.password,
      },
      asResponse: true,
    });

    const setCookie = response.headers.get('set-cookie');

    // Create a default organization for the new user
    if (setCookie) {
      await auth.api.createOrganization({
        body: {
          name: `${result.data.name}'s Workspace`,
          slug: nanoid(10),
        },
        headers: { Cookie: setCookie },
      });
    }

    return redirect('/', {
      headers: setCookie ? { 'Set-Cookie': setCookie } : {},
    });
  } catch (error) {
    console.error('Sign up error:', error);

    const message =
      error instanceof Error ? error.message : 'Registration failed';
    return data({ errors: { email: [message] } }, { status: 400 });
  }
};

export default function SignUp() {
  const fetcher = useFetcher();

  return (
    <div className="bg-muted flex min-h-svh flex-col items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm md:max-w-4xl">
        <SignUpForm fetcher={fetcher} />
      </div>
    </div>
  );
}
