import { createAuthEndpoint } from '@better-auth/core/api';
import { APIError } from 'better-call';
import Stripe from 'stripe';
import { ERROR_CODES } from '../error-codes';
import type { SubscriptionRecord, TrialStripePluginOptions } from '../types';

const getItemPeriod = (sub: Stripe.Subscription) => {
  const item = sub.items.data[0];
  return {
    periodStart: item ? item.current_period_start * 1000 : Date.now(),
    periodEnd: item ? item.current_period_end * 1000 : Date.now(),
  };
};

export const webhookEndpoint = (options: TrialStripePluginOptions) =>
  createAuthEndpoint(
    '/subscription/webhook',
    {
      method: 'POST',
      requireHeaders: true,
      metadata: {
        isAction: false,
        openapi: {
          summary: 'Handle Stripe webhook events',
          responses: {
            200: { description: 'Webhook processed' },
          },
        },
      },
    },
    async (ctx) => {
      const stripe = new Stripe(options.stripeSecretKey, {
        httpClient: Stripe.createFetchHttpClient(),
      });

      const request = ctx.request;
      if (!request) {
        throw new APIError('BAD_REQUEST', {
          message: ERROR_CODES.STRIPE_WEBHOOK_VERIFICATION_FAILED,
        });
      }
      const body = await request.text();
      const signature = ctx.headers.get('stripe-signature');

      if (!signature) {
        throw new APIError('BAD_REQUEST', {
          message: ERROR_CODES.STRIPE_WEBHOOK_VERIFICATION_FAILED,
        });
      }

      let event: Stripe.Event;
      try {
        event = await stripe.webhooks.constructEventAsync(
          body,
          signature,
          options.stripeWebhookSecret,
          undefined,
          Stripe.createSubtleCryptoProvider(),
        );
      } catch {
        throw new APIError('BAD_REQUEST', {
          message: ERROR_CODES.STRIPE_WEBHOOK_VERIFICATION_FAILED,
        });
      }

      const now = Date.now();

      if (event.type === 'checkout.session.completed') {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.userId;
        const stripeSubscriptionId = session.subscription as string;

        if (!userId || !stripeSubscriptionId) {
          return ctx.json({ received: true });
        }

        const stripeSub =
          await stripe.subscriptions.retrieve(stripeSubscriptionId);
        const priceId = stripeSub.items.data[0]?.price.id;
        const { periodStart, periodEnd } = getItemPeriod(stripeSub);

        const planConfig = options.plans.find(
          (p) => p.priceId === priceId || p.yearlyPriceId === priceId,
        );
        const planName = planConfig?.name ?? session.metadata?.plan ?? 'pro';

        const subscription =
          await ctx.context.adapter.findOne<SubscriptionRecord>({
            model: 'subscription',
            where: [{ field: 'userId', value: userId }],
          });

        if (subscription) {
          await ctx.context.adapter.update({
            model: 'subscription',
            where: [{ field: 'id', value: subscription.id }],
            update: {
              status: 'active',
              plan: planName,
              stripeCustomerId: session.customer as string,
              stripeSubscriptionId,
              stripePriceId: priceId,
              periodStart,
              periodEnd,
              cancelAtPeriodEnd: 0,
              updatedAt: now,
            },
          });
        } else {
          await ctx.context.adapter.create({
            model: 'subscription',
            data: {
              id: ctx.context.generateId({ model: 'subscription' }),
              userId,
              status: 'active',
              plan: planName,
              stripeCustomerId: session.customer as string,
              stripeSubscriptionId,
              stripePriceId: priceId,
              periodStart,
              periodEnd,
              cancelAtPeriodEnd: 0,
              createdAt: now,
              updatedAt: now,
            },
          });
        }

        await options.hooks?.onSubscriptionChange?.(userId, planName, 'active');
      }

      if (event.type === 'customer.subscription.updated') {
        const stripeSub = event.data.object as Stripe.Subscription;
        const customerId =
          typeof stripeSub.customer === 'string'
            ? stripeSub.customer
            : stripeSub.customer.id;

        const subscription =
          await ctx.context.adapter.findOne<SubscriptionRecord>({
            model: 'subscription',
            where: [{ field: 'stripeCustomerId', value: customerId }],
          });

        if (subscription) {
          const priceId = stripeSub.items.data[0]?.price.id;
          const planConfig = options.plans.find(
            (p) => p.priceId === priceId || p.yearlyPriceId === priceId,
          );
          const { periodStart, periodEnd } = getItemPeriod(stripeSub);

          const status =
            stripeSub.status === 'active'
              ? 'active'
              : stripeSub.status === 'past_due'
                ? 'past_due'
                : stripeSub.status === 'canceled'
                  ? 'canceled'
                  : subscription.status;

          await ctx.context.adapter.update({
            model: 'subscription',
            where: [{ field: 'id', value: subscription.id }],
            update: {
              status,
              plan: planConfig?.name ?? subscription.plan,
              stripePriceId: priceId,
              periodStart,
              periodEnd,
              cancelAtPeriodEnd: stripeSub.cancel_at_period_end ? 1 : 0,
              updatedAt: now,
            },
          });

          await options.hooks?.onSubscriptionChange?.(
            subscription.userId,
            planConfig?.name ?? subscription.plan,
            status,
          );
        }
      }

      if (event.type === 'customer.subscription.deleted') {
        const stripeSub = event.data.object as Stripe.Subscription;
        const customerId =
          typeof stripeSub.customer === 'string'
            ? stripeSub.customer
            : stripeSub.customer.id;

        const subscription =
          await ctx.context.adapter.findOne<SubscriptionRecord>({
            model: 'subscription',
            where: [{ field: 'stripeCustomerId', value: customerId }],
          });

        if (subscription) {
          await ctx.context.adapter.update({
            model: 'subscription',
            where: [{ field: 'id', value: subscription.id }],
            update: {
              status: 'canceled',
              plan: options.freePlan.name,
              cancelAtPeriodEnd: 0,
              updatedAt: now,
            },
          });

          await options.hooks?.onSubscriptionChange?.(
            subscription.userId,
            options.freePlan.name,
            'canceled',
          );
        }
      }

      return ctx.json({ received: true });
    },
  );
