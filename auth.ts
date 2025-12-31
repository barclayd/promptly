import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { organization } from 'better-auth/plugins';
import { drizzle } from 'drizzle-orm/better-sqlite3';

const db = drizzle({ connection: { source: './migrations/local.db' } });

export const auth = betterAuth({
  emailAndPassword: {
    enabled: true,
  },
  database: drizzleAdapter(db, {
    provider: 'sqlite',
  }),
  plugins: [organization()],
});
