import { createAuthEndpoint } from '@better-auth/core/api';
import { sessionMiddleware } from 'better-auth/api';
import { APIError } from 'better-call';
import Stripe from 'stripe';
import { z } from 'zod';
import { ERROR_CODES } from '../error-codes';
import type { TrialStripePluginOptions } from '../types';
import { findSubscription, requireOrgAdmin } from '../utils';

export const upgradeEndpoint = (options: TrialStripePluginOptions) =>
  createAuthEndpoint(
    '/subscription/upgrade',
    {
      method: 'POST',
      use: [sessionMiddleware],
      body: z.object({
        plan: z.string(),
        billingPeriod: z.enum(['monthly', 'yearly']).optional(),
        successUrl: z.string(),
        cancelUrl: z.string(),
      }),
      metadata: {
        openapi: {
          summary: 'Create Stripe checkout session for upgrade',
          responses: {
            200: { description: 'Checkout session URL' },
          },
        },
      },
    },
    async (ctx) => {
      const { plan, billingPeriod, successUrl, cancelUrl } = ctx.body;
      const userId = ctx.context.session.user.id;
      const userEmail = ctx.context.session.user.email;
      const activeOrgId =
        ctx.context.session.session.activeOrganizationId ?? null;

      await requireOrgAdmin(ctx.context.adapter, {
        userId,
        organizationId: activeOrgId,
      });

      const planConfig = options.plans.find((p) => p.name === plan);
      if (!planConfig) {
        throw new APIError('BAD_REQUEST', {
          message: ERROR_CODES.PLAN_NOT_FOUND,
        });
      }

      const subscription = await findSubscription(ctx.context.adapter, {
        organizationId: activeOrgId,
      });

      if (
        subscription?.status === 'active' &&
        subscription.stripeSubscriptionId
      ) {
        throw new APIError('BAD_REQUEST', {
          message: ERROR_CODES.ALREADY_SUBSCRIBED,
        });
      }

      const stripe = new Stripe(options.stripeSecretKey, {
        httpClient: Stripe.createFetchHttpClient(),
      });

      // Create or retrieve Stripe customer
      let customerId = subscription?.stripeCustomerId;
      if (!customerId) {
        const customer = await stripe.customers.create({
          email: userEmail,
          metadata: { userId },
        });
        customerId = customer.id;

        // Store the customer ID
        if (subscription) {
          await ctx.context.adapter.update({
            model: 'subscription',
            where: [{ field: 'id', value: subscription.id }],
            update: {
              stripeCustomerId: customerId,
              updatedAt: Date.now(),
            },
          });
        }
      }

      const priceId =
        billingPeriod === 'yearly' && planConfig.yearlyPriceId
          ? planConfig.yearlyPriceId
          : planConfig.priceId;

      try {
        const session = await stripe.checkout.sessions.create({
          customer: customerId,
          mode: 'subscription',
          line_items: [{ price: priceId, quantity: 1 }],
          success_url: successUrl,
          cancel_url: cancelUrl,
          metadata: {
            userId,
            plan,
            ...(activeOrgId ? { organizationId: activeOrgId } : {}),
          },
        });

        return ctx.json({ url: session.url });
      } catch {
        throw new APIError('INTERNAL_SERVER_ERROR', {
          message: ERROR_CODES.STRIPE_CHECKOUT_FAILED,
        });
      }
    },
  );
