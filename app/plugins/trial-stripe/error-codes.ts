import { defineErrorCodes } from '@better-auth/core/utils';

export const ERROR_CODES = defineErrorCodes({
  SUBSCRIPTION_NOT_FOUND: 'Subscription not found',
  TRIAL_ALREADY_USED: 'Trial has already been used',
  PLAN_NOT_FOUND: 'Plan not found',
  STRIPE_CHECKOUT_FAILED: 'Failed to create Stripe checkout session',
  STRIPE_WEBHOOK_VERIFICATION_FAILED:
    'Failed to verify Stripe webhook signature',
  ALREADY_SUBSCRIBED: 'User already has an active subscription',
  CANNOT_CANCEL: 'Cannot cancel subscription',
  CANNOT_REACTIVATE: 'Cannot reactivate subscription',
  NO_STRIPE_CUSTOMER: 'No Stripe customer found',
  UNAUTHORIZED: 'Unauthorized',
  FORBIDDEN: 'Only org owners or admins can manage billing',
});
