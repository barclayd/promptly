const INVALID_REDIRECT_CHARACTERS = /[\s\\\p{Cc}]/u;

export const isValidRedirectPath = (path: string): boolean => {
  if (
    !path.startsWith('/') ||
    path.startsWith('//') ||
    INVALID_REDIRECT_CHARACTERS.test(path)
  ) {
    return false;
  }

  try {
    const origin = 'https://promptly.invalid';
    const url = new URL(path, origin);
    const pathname = decodeURIComponent(url.pathname);
    return (
      url.origin === origin &&
      !pathname.startsWith('//') &&
      !INVALID_REDIRECT_CHARACTERS.test(pathname)
    );
  } catch {
    return false;
  }
};

export const getRedirectTarget = (redirectTo: unknown): string =>
  typeof redirectTo === 'string' && isValidRedirectPath(redirectTo)
    ? redirectTo
    : '/dashboard';
