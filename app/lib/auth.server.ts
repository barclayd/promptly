import type { BetterAuthOptions } from 'better-auth';
import { betterAuth } from 'better-auth';
import { CamelCasePlugin, Kysely } from 'kysely';
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
    baseURL: ctx.cloudflare.env.BETTER_AUTH_URL,
    trustedOrigins: [ctx.cloudflare.env.BETTER_AUTH_URL],
    socialProviders: {
      google: {
        clientId: ctx.cloudflare.env.GOOGLE_CLIENT_ID,
        clientSecret: ctx.cloudflare.env.GOOGLE_CLIENT_SECRET,
      },
    },
    secret: ctx.cloudflare.env.BETTER_AUTH_SECRET,
    database: {
      db: new Kysely<Database>({
        dialect: new D1Dialect({ database: ctx.cloudflare.env.promptly }),
        plugins: [new CamelCasePlugin()],
      }),
      type: 'sqlite',
    },
  });
