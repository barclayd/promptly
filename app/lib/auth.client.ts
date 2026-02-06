import { createAuthClient } from 'better-auth/react';
import { trialStripeClient } from '~/plugins/trial-stripe/client';

export const authClient = createAuthClient({
  plugins: [trialStripeClient()],
});
