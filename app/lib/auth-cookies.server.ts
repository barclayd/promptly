/**
 * Forward all Set-Cookie headers from a Better Auth response.
 * Uses getSetCookie() to preserve individual cookies instead of
 * comma-joining them (which corrupts cookie parsing in the browser).
 */
export const forwardAuthCookies = (response: Response): Headers => {
  const headers = new Headers();
  for (const cookie of response.headers.getSetCookie()) {
    headers.append('Set-Cookie', cookie);
  }
  return headers;
};

/**
 * Build a Cookie request header from Set-Cookie response headers,
 * for passing to subsequent Better Auth API calls within the same action.
 */
export const toRequestCookieHeader = (response: Response): string =>
  response.headers
    .getSetCookie()
    .map((c) => c.split(';')[0])
    .join('; ');
