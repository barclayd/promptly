import type { Session, User } from 'better-auth';
import { createContext } from 'react-router';
import type { getAuth } from '~/lib/auth.server';

export const userContext = createContext<User>();

export type OrgContext = {
  organizationId: string;
  organizationName: string;
  organizationSlug: string;
};

export const orgContext = createContext<OrgContext>();

// Cached auth instance (created once per request)
export type AuthInstance = ReturnType<typeof getAuth>;
export const authContext = createContext<AuthInstance>();

// Cached session (fetched once per request)
export type CachedSession = { user: User; session: Session } | null;
export const sessionContext = createContext<CachedSession>();
