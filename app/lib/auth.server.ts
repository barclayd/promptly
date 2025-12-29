import type { BetterAuthOptions } from 'better-auth';
import { betterAuth } from 'better-auth';
import { Kysely } from 'kysely';
import { D1Dialect } from 'kysely-d1';
import type { AppLoadContext } from 'react-router';

type Database = Record<string, string>;

const authOptions: Omit<BetterAuthOptions, 'database'> = {
  emailAndPassword: {
    enabled: true,
  },
};

export const createBetterAuth = (database: BetterAuthOptions['database']) =>
  betterAuth({
    ...authOptions,
    database,
  });

export const getAuth = (ctx: AppLoadContext) =>
  betterAuth({
    ...authOptions,
    database: new Kysely<Database>({
      dialect: new D1Dialect({ database: ctx.cloudflare.env.promptly }),
    }),
  });
