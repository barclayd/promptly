export const parseCookie = (
  cookieHeader: string,
  name: string,
): string | null => {
  const match = cookieHeader.match(new RegExp(`${name}=([^;]+)`));

  return match ? decodeURIComponent(match[1]) : null;
};
