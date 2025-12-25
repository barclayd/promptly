import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { drizzle } from 'drizzle-orm/better-sqlite3';

import { createBetterAuth } from '~/lib/auth.server';

const db = drizzle({ connection: { source: './migrations/local.db' } });
const database = drizzleAdapter(db, {
  provider: 'sqlite',
});

export const auth = createBetterAuth(database);
