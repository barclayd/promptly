import type { BetterAuthOptions } from 'better-auth';
import { betterAuth } from 'better-auth';
import { Kysely } from 'kysely';
import { D1Dialect } from 'kysely-d1';
import type { AppLoadContext } from 'react-router';

type Database = Record<string, string>;

// Factory for CLI - accepts a database adapter directly
export const createBetterAuth = (database: BetterAuthOptions['database']) =>
  betterAuth({
    database,
  });

// Factory for runtime - creates auth with D1 from Cloudflare context
export const getAuth = (ctx: AppLoadContext) =>
  betterAuth({
    database: new Kysely<Database>({
      dialect: new D1Dialect({ database: ctx.cloudflare.env.promptly }),
    }),
  });
