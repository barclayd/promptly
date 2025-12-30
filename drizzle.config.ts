import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'sqlite',
  schema: './migrations/auth-schema.ts',
  out: './migrations/drizzle',
});
