import type { BetterAuthClientPlugin } from 'better-auth/client';
import type { trialStripe } from './index';
import type { Plan } from './types';

export const trialStripeClient = () => {
  return {
    id: 'trial-stripe',
    $InferServerPlugin: {} as ReturnType<typeof trialStripe>,
    pathMethods: {
      '/subscription/upgrade': 'POST',
      '/subscription/cancel': 'POST',
      '/subscription/reactivate': 'POST',
      '/subscription/portal': 'POST',
    },
    getActions: ($fetch) => ({
      subscription: {
        status: () =>
          $fetch('/subscription/status', {
            method: 'GET',
          }),
        upgrade: (body: {
          plan: Plan;
          billingPeriod?: 'monthly' | 'yearly';
          successUrl: string;
          cancelUrl: string;
        }) =>
          $fetch('/subscription/upgrade', {
            method: 'POST',
            body,
          }),
        cancel: () =>
          $fetch('/subscription/cancel', {
            method: 'POST',
          }),
        reactivate: () =>
          $fetch('/subscription/reactivate', {
            method: 'POST',
          }),
        portal: (body: { returnUrl: string }) =>
          $fetch('/subscription/portal', {
            method: 'POST',
            body,
          }),
      },
    }),
  } satisfies BetterAuthClientPlugin;
};
