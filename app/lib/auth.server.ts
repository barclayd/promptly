import { env } from 'cloudflare:workers';
import { betterAuth } from 'better-auth';
import { Kysely } from 'kysely';
import { D1Dialect } from 'kysely-d1';

type Database = Record<string, string>;

export const auth = betterAuth({
  database: new Kysely<Database>({
    dialect: new D1Dialect({ database: env.pr }),
  }),
});
