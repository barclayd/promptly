import { createAuthEndpoint } from '@better-auth/core/api';
import { sessionMiddleware } from 'better-auth/api';
import { APIError } from 'better-call';
import Stripe from 'stripe';
import { ERROR_CODES } from '../error-codes';
import type { TrialStripePluginOptions } from '../types';
import { findSubscription, requireOrgAdmin } from '../utils';

export const reactivateEndpoint = (options: TrialStripePluginOptions) =>
  createAuthEndpoint(
    '/subscription/reactivate',
    {
      method: 'POST',
      use: [sessionMiddleware],
      metadata: {
        openapi: {
          summary: 'Reactivate a subscription pending cancellation',
          responses: {
            200: { description: 'Subscription reactivated' },
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
          message: ERROR_CODES.CANNOT_REACTIVATE,
        });
      }

      if (subscription.status !== 'active' || !subscription.cancelAtPeriodEnd) {
        throw new APIError('BAD_REQUEST', {
          message: ERROR_CODES.CANNOT_REACTIVATE,
        });
      }

      const stripe = new Stripe(options.stripeSecretKey, {
        httpClient: Stripe.createFetchHttpClient(),
      });

      await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
        cancel_at_period_end: false,
      });

      await ctx.context.adapter.update({
        model: 'subscription',
        where: [{ field: 'id', value: subscription.id }],
        update: {
          cancelAtPeriodEnd: 0,
          updatedAt: Date.now(),
        },
      });

      return ctx.json({ success: true });
    },
  );
