import type { BetterAuthPluginDBSchema } from '@better-auth/core/db';

export const subscriptionSchema = {
  subscription: {
    disableMigration: true,
    fields: {
      userId: {
        type: 'string',
        required: true,
        references: {
          model: 'user',
          field: 'id',
          onDelete: 'cascade',
        },
      },
      organizationId: {
        type: 'string',
        required: false,
        references: {
          model: 'organization',
          field: 'id',
        },
      },
      plan: {
        type: 'string',
        required: true,
      },
      status: {
        type: 'string',
        required: true,
        defaultValue: 'trialing',
      },
      trialStart: {
        type: 'number',
        required: false,
      },
      trialEnd: {
        type: 'number',
        required: false,
      },
      stripeCustomerId: {
        type: 'string',
        required: false,
      },
      stripeSubscriptionId: {
        type: 'string',
        required: false,
      },
      stripePriceId: {
        type: 'string',
        required: false,
      },
      periodStart: {
        type: 'number',
        required: false,
      },
      periodEnd: {
        type: 'number',
        required: false,
      },
      cancelAtPeriodEnd: {
        type: 'number',
        required: false,
        defaultValue: 0,
      },
      createdAt: {
        type: 'number',
        required: true,
      },
      updatedAt: {
        type: 'number',
        required: true,
      },
    },
  },
} satisfies BetterAuthPluginDBSchema;
