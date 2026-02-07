import { createAuthEndpoint } from '@better-auth/core/api';
import { sessionMiddleware } from 'better-auth/api';
import type { TrialStripePluginOptions } from '../types';
import { findSubscription } from '../utils';

export const statusEndpoint = (options: TrialStripePluginOptions) =>
  createAuthEndpoint(
    '/subscription/status',
    {
      method: 'GET',
      use: [sessionMiddleware],
      metadata: {
        openapi: {
          summary: 'Get subscription status',
          responses: {
            200: {
              description: 'Subscription status',
            },
          },
        },
      },
    },
    async (ctx) => {
      const activeOrgId =
        ctx.context.session.session.activeOrganizationId ?? null;

      const subscription = await findSubscription(ctx.context.adapter, {
        organizationId: activeOrgId,
      });

      if (!subscription) {
        return ctx.json({
          plan: options.freePlan.name,
          status: 'expired' as const,
          isTrial: false,
          daysLeft: null,
          limits: options.freePlan.limits,
          cancelAtPeriodEnd: false,
        });
      }

      const now = Date.now();

      // Lazy trial expiration
      if (
        subscription.status === 'trialing' &&
        subscription.trialEnd &&
        subscription.trialEnd < now
      ) {
        await ctx.context.adapter.update({
          model: 'subscription',
          where: [{ field: 'id', value: subscription.id }],
          update: {
            status: 'expired',
            plan: options.freePlan.name,
            updatedAt: now,
          },
        });

        return ctx.json({
          plan: options.freePlan.name,
          status: 'expired' as const,
          isTrial: false,
          daysLeft: null,
          limits: options.freePlan.limits,
          cancelAtPeriodEnd: false,
        });
      }

      const isTrial = subscription.status === 'trialing';
      const daysLeft =
        isTrial && subscription.trialEnd
          ? Math.max(
              0,
              Math.ceil((subscription.trialEnd - now) / (1000 * 60 * 60 * 24)),
            )
          : null;

      const planConfig = options.plans.find(
        (p) => p.name === subscription.plan,
      );
      const limits = planConfig?.limits ?? options.freePlan.limits;

      return ctx.json({
        plan: subscription.plan,
        status: subscription.status,
        isTrial,
        daysLeft,
        limits,
        cancelAtPeriodEnd: subscription.cancelAtPeriodEnd === 1,
      });
    },
  );
