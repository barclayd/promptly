import type { BetterAuthPlugin } from 'better-auth';
import { ERROR_CODES } from './error-codes';
import { cancelEndpoint } from './routes/cancel';
import { portalEndpoint } from './routes/portal';
import { statusEndpoint } from './routes/status';
import { upgradeEndpoint } from './routes/upgrade';
import { webhookEndpoint } from './routes/webhook';
import { subscriptionSchema } from './schema';
import type { TrialStripePluginOptions } from './types';

export const trialStripe = (options: TrialStripePluginOptions) => {
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
                  const trialEnd =
                    now + options.trial.days * 24 * 60 * 60 * 1000;

                  // Check for existing subscription (abuse prevention)
                  const existing = await adapter.findOne({
                    model: 'subscription',
                    where: [{ field: 'userId', value: user.id }],
                  });

                  if (existing) return;

                  await adapter.create({
                    model: 'subscription',
                    data: {
                      id: ctx.context.generateId({ model: 'subscription' }),
                      userId: user.id,
                      plan: options.trial.plan,
                      status: 'trialing',
                      trialStart: now,
                      trialEnd,
                      stripeCustomerId: null,
                      stripeSubscriptionId: null,
                      stripePriceId: null,
                      periodStart: null,
                      periodEnd: null,
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
