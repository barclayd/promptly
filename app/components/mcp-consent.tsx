import { IconPlugConnected, IconShieldCheck } from '@tabler/icons-react';
import { useState } from 'react';
import { Form, useNavigation } from 'react-router';
import { Button } from '~/components/ui/button';
import { cn } from '~/lib/utils';
import type { McpPermission } from '~/lib/validations/mcp';

export type McpConsentProps = {
  requestId: string;
  clientName: string;
  clientId: string;
  redirectOrigin: string;
  workspaceName: string;
  email: string;
  allowedPermissions: McpPermission[];
  testingRequested: boolean;
  defaultPermission: McpPermission;
  error?: string;
};

const permissions: {
  value: McpPermission;
  label: string;
  description: string;
}[] = [
  {
    value: 'read',
    label: 'Read only',
    description:
      'Read drafts and published content, including settings and saved sample data.',
  },
  {
    value: 'edit',
    label: 'Create and edit drafts',
    description:
      'Read content, create prompts and composers, and edit their shared drafts.',
  },
  {
    value: 'publish',
    label: 'Create, edit, and publish',
    description:
      'Create and edit drafts, and publish new versions of prompts and composers.',
  },
];

export const McpConsent = ({
  requestId,
  clientName,
  clientId,
  redirectOrigin,
  workspaceName,
  email,
  allowedPermissions,
  testingRequested,
  defaultPermission,
  error,
}: McpConsentProps) => {
  const navigation = useNavigation();
  const [permission, setPermission] = useState<McpPermission | ''>(() => {
    if (
      defaultPermission !== 'publish' &&
      allowedPermissions.includes(defaultPermission)
    ) {
      return defaultPermission;
    }
    if (allowedPermissions.includes('edit')) return 'edit';
    if (allowedPermissions.includes('read')) return 'read';
    return '';
  });
  const isSubmitting = navigation.state !== 'idle';

  return (
    <main className="min-h-svh bg-muted/40 px-4 py-8 text-foreground sm:py-12 dark:bg-background">
      <div className="mx-auto w-full max-w-lg">
        <div className="mb-6 flex items-center gap-2 text-lg font-semibold tracking-tight">
          <IconPlugConnected className="size-5" aria-hidden="true" />
          Promptly
        </div>
        <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
          <div className="p-5 sm:p-7">
            <h1 className="break-words text-2xl font-semibold tracking-tight">
              Connect {clientName}
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Choose what this client can do in your Promptly workspace.
            </p>

            <dl className="my-6 space-y-3 rounded-lg bg-muted/50 p-4 text-sm">
              <div className="grid gap-1 sm:grid-cols-[6rem_1fr] sm:gap-3">
                <dt className="text-muted-foreground">Workspace</dt>
                <dd className="min-w-0 break-words font-medium">
                  {workspaceName}
                </dd>
              </div>
              <div className="grid gap-1 sm:grid-cols-[6rem_1fr] sm:gap-3">
                <dt className="text-muted-foreground">Signed in as</dt>
                <dd className="min-w-0 break-all">{email}</dd>
              </div>
              <div className="grid gap-1 sm:grid-cols-[6rem_1fr] sm:gap-3">
                <dt className="text-muted-foreground">Returns to</dt>
                <dd className="min-w-0 break-all">{redirectOrigin}</dd>
              </div>
            </dl>

            <Form method="post" className="space-y-5">
              <input type="hidden" name="requestId" value={requestId} />
              <fieldset disabled={isSubmitting}>
                <legend className="mb-3 text-sm font-medium">
                  Allow this client to
                </legend>
                <div className="overflow-hidden rounded-lg border divide-y">
                  {permissions.map((option) => {
                    const isAllowed = allowedPermissions.includes(option.value);
                    return (
                      <label
                        key={option.value}
                        className={cn(
                          'flex items-start gap-3 p-4 transition-colors focus-within:ring-2 focus-within:ring-inset focus-within:ring-ring',
                          isAllowed
                            ? 'cursor-pointer hover:bg-muted/50'
                            : 'cursor-not-allowed opacity-50',
                          permission === option.value && 'bg-primary/5',
                        )}
                      >
                        <input
                          type="radio"
                          name="permission"
                          value={option.value}
                          checked={permission === option.value}
                          onChange={() => setPermission(option.value)}
                          disabled={!isAllowed}
                          required
                          className="mt-0.5 size-4 shrink-0 accent-primary"
                        />
                        <span className="min-w-0">
                          <span className="block text-sm font-medium">
                            {option.label}
                          </span>
                          <span className="mt-1 block text-sm leading-relaxed text-muted-foreground">
                            {option.description}
                          </span>
                          {!isAllowed && (
                            <span className="mt-1 block text-xs text-muted-foreground">
                              Not requested by this client
                            </span>
                          )}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </fieldset>

              <label
                className={cn(
                  'flex items-start gap-3 rounded-lg border p-4 focus-within:ring-2 focus-within:ring-ring',
                  testingRequested
                    ? 'cursor-pointer hover:bg-muted/50'
                    : 'cursor-not-allowed opacity-50',
                )}
              >
                <input
                  type="checkbox"
                  name="allowTesting"
                  value="true"
                  disabled={!testingRequested || isSubmitting}
                  className="mt-0.5 size-4 shrink-0 accent-primary"
                />
                <span className="min-w-0">
                  <span className="block text-sm font-medium">Run tests</span>
                  <span className="mt-1 block text-sm leading-relaxed text-muted-foreground">
                    Test snippets, prompts, and composers and compare versions
                    using your workspace’s LLM API keys. Tests send content and
                    input data to your model provider and incur API costs. Saved
                    content and settings stay unchanged.
                  </span>
                  {!testingRequested && (
                    <span className="mt-1 block text-xs text-muted-foreground">
                      Not requested by this client
                    </span>
                  )}
                </span>
              </label>

              {permission === 'publish' && (
                <p className="break-words rounded-lg border border-border bg-muted/50 p-3 text-sm leading-relaxed">
                  Publishing makes a version available immediately. Any approval
                  before publishing is handled by {clientName}.
                </p>
              )}

              {error && (
                <p role="alert" className="text-sm text-destructive">
                  {error}
                </p>
              )}

              <div className="flex items-start gap-2 text-sm leading-relaxed text-muted-foreground">
                <IconShieldCheck
                  className="mt-0.5 size-4 shrink-0"
                  aria-hidden="true"
                />
                <p>You can revoke this connection in Promptly Settings.</p>
              </div>

              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button
                  type="submit"
                  name="decision"
                  value="deny"
                  variant="outline"
                  formNoValidate
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  name="decision"
                  value="allow"
                  disabled={isSubmitting || !permission}
                >
                  {isSubmitting &&
                  navigation.formData?.get('decision') === 'allow'
                    ? 'Connecting…'
                    : 'Connect'}
                </Button>
              </div>
            </Form>
          </div>
          <details className="border-t px-5 py-4 text-xs sm:px-7">
            <summary className="w-fit cursor-pointer text-muted-foreground focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring">
              Client details
            </summary>
            <p className="mt-3 break-all leading-relaxed text-muted-foreground">
              Client ID: {clientId}
            </p>
          </details>
        </div>
      </div>
    </main>
  );
};
