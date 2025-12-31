import { betterAuth } from 'better-auth';
import { organization } from 'better-auth/plugins';
import { CamelCasePlugin, Kysely } from 'kysely';
import { D1Dialect } from 'kysely-d1';
import type { RouterContextProvider } from 'react-router';

type Database = Record<string, string>;

export const getAuth = (ctx: RouterContextProvider) =>
  betterAuth({
    emailAndPassword: {
      enabled: true,
    },
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
    plugins: [organization()],
  });
