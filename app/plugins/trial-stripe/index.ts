import type { BetterAuthPlugin } from 'better-auth';
import Stripe from 'stripe';
import { ERROR_CODES } from './error-codes';
import { cancelEndpoint } from './routes/cancel';
import { portalEndpoint } from './routes/portal';
import { statusEndpoint } from './routes/status';
import { upgradeEndpoint } from './routes/upgrade';
import { webhookEndpoint } from './routes/webhook';
import { subscriptionSchema } from './schema';
import type { TrialStripePluginOptions } from './types';

export const trialStripe = (options: TrialStripePluginOptions) => {
  const trialPlan = options.plans.find((p) => p.name === options.trial.plan);

  return {
    id: 'trial-stripe',
    schema: subscriptionSchema,
    $ERROR_CODES: ERROR_CODES,
    init() {
      return {
        options: {
          databaseHooks: {
            user: {
              create: {
                async after(user, ctx) {
                  if (!ctx) return;

                  const adapter = ctx.context.adapter;
                  const now = Date.now();

                  // Check for existing subscription (abuse prevention)
                  const existing = await adapter.findOne({
                    model: 'subscription',
                    where: [{ field: 'userId', value: user.id }],
                  });

                  if (existing) return;

                  const stripe = new Stripe(options.stripeSecretKey, {
                    httpClient: Stripe.createFetchHttpClient(),
                  });

                  // Create Stripe customer
                  const customer = await stripe.customers.create({
                    email: user.email,
                    name: user.name ?? undefined,
                    metadata: { userId: user.id },
                  });

                  // Create Stripe subscription with trial
                  let stripeSubscriptionId: string | null = null;
                  let stripePriceId: string | null = null;
                  let periodStart: number | null = null;
                  let periodEnd: number | null = null;

                  if (trialPlan) {
                    const sub = await stripe.subscriptions.create({
                      customer: customer.id,
                      items: [{ price: trialPlan.priceId }],
                      trial_period_days: options.trial.days,
                      payment_settings: {
                        save_default_payment_method: 'on_subscription',
                      },
                      trial_settings: {
                        end_behavior: { missing_payment_method: 'cancel' },
                      },
                    });

                    stripeSubscriptionId = sub.id;
                    stripePriceId = trialPlan.priceId;
                    const item = sub.items.data[0];
                    if (item) {
                      periodStart = item.current_period_start * 1000;
                      periodEnd = item.current_period_end * 1000;
                    }
                  }

                  const trialEnd =
                    now + options.trial.days * 24 * 60 * 60 * 1000;

                  await adapter.create({
                    model: 'subscription',
                    data: {
                      id: ctx.context.generateId({ model: 'subscription' }),
                      userId: user.id,
                      plan: options.trial.plan,
                      status: 'trialing',
                      trialStart: now,
                      trialEnd,
                      stripeCustomerId: customer.id,
                      stripeSubscriptionId,
                      stripePriceId,
                      periodStart,
                      periodEnd,
                      cancelAtPeriodEnd: 0,
                      createdAt: now,
                      updatedAt: now,
                    },
                  });

                  await options.hooks?.onTrialStart?.(user.id);
                },
              },
            },
          },
        },
      };
    },
    endpoints: {
      getSubscriptionStatus: statusEndpoint(options),
      createCheckoutSession: upgradeEndpoint(options),
      cancelSubscription: cancelEndpoint(options),
      createBillingPortal: portalEndpoint(options),
      handleStripeWebhook: webhookEndpoint(options),
    },
  } satisfies BetterAuthPlugin;
};
