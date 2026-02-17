import { IconLock } from '@tabler/icons-react';
import { useEffect } from 'react';
import type { FetcherWithComponents } from 'react-router';
import { NavLink } from 'react-router';
import { toast } from 'sonner';
import { Button } from '~/components/ui/button';
import { Card, CardContent } from '~/components/ui/card';
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldSeparator,
} from '~/components/ui/field';
import { Input } from '~/components/ui/input';
import {
  Item,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from '~/components/ui/item';
import { cn } from '~/lib/utils';

type ActionData = {
  errors?: {
    name?: string[];
    email?: string[];
    password?: string[];
    confirmPassword?: string[];
    form?: string[];
  };
};

type InvitationContext = {
  id: string;
  email: string;
  organization: {
    name: string;
    logo?: string | null;
  };
  inviter: {
    name: string;
  };
  role: string;
};

interface SignUpFormProps extends React.ComponentProps<'div'> {
  fetcher: FetcherWithComponents<ActionData>;
  invitation?: InvitationContext;
}

export const SignUpForm = ({
  className,
  fetcher,
  invitation,
  ...props
}: SignUpFormProps) => {
  const errors = fetcher.data?.errors;
  const isSubmitting = fetcher.state === 'submitting';
  const isInvite = !!invitation;

  useEffect(() => {
    if (errors && Object.keys(errors).length > 0) {
      toast.error('Please fix the errors below');
    }
  }, [errors]);

  return (
    <div className={cn('flex flex-col gap-6', className)} {...props}>
      {/* Organization context - shown when signing up via invitation */}
      {invitation && (
        <Item variant="outline" className="bg-card">
          <ItemMedia variant="icon" className="bg-primary/10 border-primary/20">
            {invitation.organization.logo ? (
              <img
                src={invitation.organization.logo}
                alt={invitation.organization.name}
                className="size-full object-cover"
              />
            ) : (
              <span className="text-primary text-lg font-semibold">
                {invitation.organization.name.charAt(0).toUpperCase()}
              </span>
            )}
          </ItemMedia>
          <ItemContent>
            <ItemTitle>Joining {invitation.organization.name}</ItemTitle>
            <ItemDescription>
              {invitation.inviter.name} invited you as {invitation.role}
            </ItemDescription>
          </ItemContent>
        </Item>
      )}

      <Card className="overflow-hidden p-0">
        <CardContent className="grid p-0 md:grid-cols-2">
          <fetcher.Form method="post" className="p-6 md:p-8">
            {isInvite && <input type="hidden" name="intent" value="signup" />}
            <FieldGroup>
              <div className="flex flex-col items-center gap-2 text-center">
                <h1 className="text-2xl font-bold">
                  {isInvite
                    ? `Join ${invitation.organization.name}`
                    : 'Create your Promptly account'}
                </h1>
                <p className="text-muted-foreground text-sm text-balance">
                  {isInvite
                    ? 'Create your account to accept the invitation'
                    : 'Enter your details below to create your account'}
                </p>
              </div>
              <Field>
                <FieldLabel htmlFor="name">Full Name</FieldLabel>
                <Input
                  id="name"
                  name="name"
                  type="text"
                  placeholder="Johnny Appleseed"
                  required
                />
                {errors?.name && (
                  <p className="text-destructive text-sm">{errors.name[0]}</p>
                )}
              </Field>
              <Field>
                <FieldLabel htmlFor="email">Email</FieldLabel>
                {isInvite ? (
                  <div className="relative">
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      value={invitation.email}
                      readOnly
                      className="bg-muted/50 text-muted-foreground pr-10 cursor-not-allowed"
                    />
                    <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                      <IconLock className="size-4 text-muted-foreground" />
                    </div>
                  </div>
                ) : (
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    placeholder="m@example.com"
                    required
                  />
                )}
                {errors?.email ? (
                  <p className="text-destructive text-sm">{errors.email[0]}</p>
                ) : (
                  <FieldDescription>
                    {isInvite
                      ? 'Your account will be created with this email'
                      : "We'll use this to contact you. We will not share your email with anyone else."}
                  </FieldDescription>
                )}
              </Field>
              <Field>
                <Field className="grid grid-cols-2 gap-4">
                  <Field>
                    <FieldLabel htmlFor="password">Password</FieldLabel>
                    <Input
                      id="password"
                      name="password"
                      type="password"
                      required
                    />
                    {errors?.password && (
                      <p className="text-destructive text-sm">
                        {errors.password[0]}
                      </p>
                    )}
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="confirmPassword">
                      Confirm Password
                    </FieldLabel>
                    <Input
                      id="confirmPassword"
                      name="confirmPassword"
                      type="password"
                      required
                    />
                    {errors?.confirmPassword && (
                      <p className="text-destructive text-sm">
                        {errors.confirmPassword[0]}
                      </p>
                    )}
                  </Field>
                </Field>
                <FieldDescription>
                  Must be at least 8 characters long.
                </FieldDescription>
              </Field>
              <Field>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting
                    ? 'Creating Account...'
                    : isInvite
                      ? 'Create Account & Join'
                      : 'Create Account'}
                </Button>
              </Field>
              <FieldSeparator className="*:data-[slot=field-separator-content]:bg-card">
                Or continue with
              </FieldSeparator>
              <Field className="grid grid-cols-3 gap-4">
                {isInvite ? (
                  <Button
                    variant="outline"
                    type="submit"
                    name="intent"
                    value="apple"
                    className="w-full"
                  >
                    <svg
                      aria-hidden="true"
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                    >
                      <path
                        d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701"
                        fill="currentColor"
                      />
                    </svg>
                    <span className="sr-only">Sign up with Apple</span>
                  </Button>
                ) : (
                  <form method="post" action="/auth/social">
                    <input type="hidden" name="provider" value="apple" />
                    <Button variant="outline" type="submit" className="w-full">
                      <svg
                        aria-hidden="true"
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                      >
                        <path
                          d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701"
                          fill="currentColor"
                        />
                      </svg>
                      <span className="sr-only">Sign up with Apple</span>
                    </Button>
                  </form>
                )}
                {isInvite ? (
                  <Button
                    variant="outline"
                    type="submit"
                    name="intent"
                    value="google"
                    className="w-full"
                  >
                    <svg
                      aria-hidden="true"
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                    >
                      <path
                        d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z"
                        fill="currentColor"
                      />
                    </svg>
                    <span className="sr-only">Sign up with Google</span>
                  </Button>
                ) : (
                  <form method="post" action="/auth/social">
                    <input type="hidden" name="provider" value="google" />
                    <Button variant="outline" type="submit" className="w-full">
                      <svg
                        aria-hidden="true"
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                      >
                        <path
                          d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z"
                          fill="currentColor"
                        />
                      </svg>
                      <span className="sr-only">Sign up with Google</span>
                    </Button>
                  </form>
                )}
                {isInvite ? (
                  <Button
                    variant="outline"
                    type="submit"
                    name="intent"
                    value="github"
                    className="w-full"
                  >
                    <svg
                      aria-hidden="true"
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                    >
                      <path
                        d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"
                        fill="currentColor"
                      />
                    </svg>
                    <span className="sr-only">Sign up with GitHub</span>
                  </Button>
                ) : (
                  <form method="post" action="/auth/social">
                    <input type="hidden" name="provider" value="github" />
                    <Button variant="outline" type="submit" className="w-full">
                      <svg
                        aria-hidden="true"
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                      >
                        <path
                          d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"
                          fill="currentColor"
                        />
                      </svg>
                      <span className="sr-only">Sign up with GitHub</span>
                    </Button>
                  </form>
                )}
              </Field>
              <FieldDescription className="text-center">
                Already have an account?{' '}
                <NavLink
                  to={
                    isInvite
                      ? `/login?redirect=/invite/${invitation.id}`
                      : '/login'
                  }
                  className="underline"
                >
                  Sign in
                </NavLink>
              </FieldDescription>
            </FieldGroup>
          </fetcher.Form>
          <div className="bg-muted relative hidden md:block">
            <img
              src="https://images.keepfre.sh/app/images/promo.webp"
              alt="Promo for PromptlyCMS"
              className="absolute inset-0 h-full w-full object-cover dark:brightness-[0.4] dark:grayscale"
            />
          </div>
        </CardContent>
      </Card>
      <FieldDescription className="px-6 text-center">
        By clicking continue, you agree to our{' '}
        <NavLink to="/terms-and-conditions" className="underline">
          Terms of Service
        </NavLink>{' '}
        and{' '}
        <NavLink to="/privacy-policy" className="underline">
          Privacy Policy
        </NavLink>
        .
      </FieldDescription>
    </div>
  );
};
