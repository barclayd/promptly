import { createContext } from 'react-router';
import type { User } from 'better-auth';

export const userContext = createContext<User>();
