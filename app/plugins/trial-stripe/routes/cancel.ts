import { createAuthEndpoint } from '@better-auth/core/api';
import { sessionMiddleware } from 'better-auth/api';
import { APIError } from 'better-call';
import Stripe from 'stripe';
import { ERROR_CODES } from '../error-codes';
import type { TrialStripePluginOptions } from '../types';
import { findSubscription, requireOrgAdmin } from '../utils';

export const cancelEndpoint = (options: TrialStripePluginOptions) =>
  createAuthEndpoint(
    '/subscription/cancel',
    {
      method: 'POST',
      use: [sessionMiddleware],
      metadata: {
        openapi: {
          summary: 'Cancel subscription at period end',
          responses: {
            200: { description: 'Subscription canceled' },
          },
        },
      },
    },
    async (ctx) => {
      const userId = ctx.context.session.user.id;
      const activeOrgId =
        ctx.context.session.session.activeOrganizationId ?? null;

      await requireOrgAdmin(ctx.context.adapter, {
        userId,
        organizationId: activeOrgId,
      });

      const subscription = await findSubscription(ctx.context.adapter, {
        organizationId: activeOrgId,
      });

      if (!subscription || !subscription.stripeSubscriptionId) {
        throw new APIError('BAD_REQUEST', {
          message: ERROR_CODES.CANNOT_CANCEL,
        });
      }

      if (subscription.status !== 'active') {
        throw new APIError('BAD_REQUEST', {
          message: ERROR_CODES.CANNOT_CANCEL,
        });
      }

      const stripe = new Stripe(options.stripeSecretKey, {
        httpClient: Stripe.createFetchHttpClient(),
      });

      await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
        cancel_at_period_end: true,
      });

      await ctx.context.adapter.update({
        model: 'subscription',
        where: [{ field: 'id', value: subscription.id }],
        update: {
          cancelAtPeriodEnd: 1,
          updatedAt: Date.now(),
        },
      });

      return ctx.json({ success: true });
    },
  );
