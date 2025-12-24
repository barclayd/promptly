import { betterAuth } from 'better-auth';

export const auth = betterAuth({
  url: process.env.DATABASE_URL,
});
