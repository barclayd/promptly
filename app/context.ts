import type { User } from 'better-auth';
import { createContext } from 'react-router';

export const userContext = createContext<User>();

export type OrgContext = {
  organizationId: string;
  organizationName: string;
  organizationSlug: string;
};

export const orgContext = createContext<OrgContext>();
