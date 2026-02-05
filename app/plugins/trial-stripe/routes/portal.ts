import { createAuthEndpoint } from '@better-auth/core/api';
import { sessionMiddleware } from 'better-auth/api';
import { APIError } from 'better-call';
import Stripe from 'stripe';
import { z } from 'zod';
import { ERROR_CODES } from '../error-codes';
import type { SubscriptionRecord, TrialStripePluginOptions } from '../types';

export const portalEndpoint = (options: TrialStripePluginOptions) =>
  createAuthEndpoint(
    '/subscription/portal',
    {
      method: 'POST',
      use: [sessionMiddleware],
      body: z.object({
        returnUrl: z.string(),
      }),
      metadata: {
        openapi: {
          summary: 'Create Stripe billing portal session',
          responses: {
            200: { description: 'Portal session URL' },
          },
        },
      },
    },
    async (ctx) => {
      const userId = ctx.context.session.user.id;

      const subscription =
        await ctx.context.adapter.findOne<SubscriptionRecord>({
          model: 'subscription',
          where: [{ field: 'userId', value: userId }],
        });

      if (!subscription?.stripeCustomerId) {
        throw new APIError('BAD_REQUEST', {
          message: ERROR_CODES.NO_STRIPE_CUSTOMER,
        });
      }

      const stripe = new Stripe(options.stripeSecretKey, {
        httpClient: Stripe.createFetchHttpClient(),
      });

      const session = await stripe.billingPortal.sessions.create({
        customer: subscription.stripeCustomerId,
        return_url: ctx.body.returnUrl,
      });

      return ctx.json({ url: session.url });
    },
  );
