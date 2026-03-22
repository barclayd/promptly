const VALID_REDIRECT_RE = /^\/[a-zA-Z0-9/_\-.?=&%]+$/;

export const isValidRedirectPath = (path: string): boolean =>
  VALID_REDIRECT_RE.test(path) &&
  !path.startsWith('//') &&
  !path.includes('\\');

export const getRedirectTarget = (redirectTo: unknown): string =>
  typeof redirectTo === 'string' && isValidRedirectPath(redirectTo)
    ? redirectTo
    : '/dashboard';
