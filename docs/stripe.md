# Stripe Integration

## Overview

Stripe handles subscription billing via a custom Better Auth plugin (`trial-stripe`). Every new user who creates their own org gets a 14-day Pro trial with a real Stripe subscription - no payment method required upfront. Invited users (who join an existing org) are excluded from trial creation.

## Environment Variables

| Variable | Description |
|----------|-------------|
| `STRIPE_SECRET_KEY` | Stripe API secret key (test: `sk_test_...`, live: `sk_live_...`) |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret (`whsec_...`) |

Both are set in `.env` for local dev and in Cloudflare dashboard for production.

## Stripe Test Account

| Resource | ID |
|----------|----|
| **Product** (Promptly Pro) | `prod_TvT5WGDqvZ9udw` |
| **Price** ($29/mo) | `price_1Sxc9ULw9ky8dfhCmQI8Od59` |

## Plugin Architecture

The `trial-stripe` plugin is a custom Better Auth plugin at `app/plugins/trial-stripe/`.

```
app/plugins/trial-stripe/
├── index.ts          # Server plugin: databaseHooks + endpoint registration
├── client.ts         # Client plugin: typed authClient.subscription.* actions
├── schema.ts         # subscription table schema (disableMigration: true)
├── error-codes.ts    # Typed error codes via defineErrorCodes
├── types.ts          # TypeScript interfaces
└── routes/
    ├── status.ts     # GET  /subscription/status
    ├── upgrade.ts    # POST /subscription/upgrade
    ├── cancel.ts     # POST /subscription/cancel
    ├── portal.ts     # POST /subscription/portal
    └── webhook.ts    # POST /subscription/webhook
```

**Registration:**
- Server: `app/lib/auth.server.ts` — `trialStripe()` in the plugins array
- Client: `app/lib/auth.client.ts` — `trialStripeClient()` in the plugins array

All endpoints are served automatically via the existing `/api/auth/*` catch-all route (`app/routes/api/auth.ts`).

## Plugin Configuration

```typescript
trialStripe({
  stripeSecretKey: ctx.cloudflare.env.STRIPE_SECRET_KEY,
  stripeWebhookSecret: ctx.cloudflare.env.STRIPE_WEBHOOK_SECRET,
  trial: { days: 14, plan: 'pro' },
  freePlan: {
    name: 'free',
    limits: { prompts: 3, teamMembers: 1, apiCalls: 5000 },
  },
  plans: [
    {
      name: 'pro',
      priceId: 'price_1Sxc9ULw9ky8dfhCmQI8Od59',
      limits: { prompts: -1, teamMembers: 5, apiCalls: 50000 },
    },
  ],
})
```

`-1` means unlimited for that limit.

## API Endpoints

All endpoints are under `/api/auth/subscription/`:

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/subscription/status` | Session | Returns plan, status, trial days left, limits |
| POST | `/subscription/upgrade` | Session | Creates Stripe Checkout session, returns `{ url }` |
| POST | `/subscription/cancel` | Session | Sets `cancel_at_period_end: true` on Stripe sub |
| POST | `/subscription/portal` | Session | Creates Stripe billing portal session, returns `{ url }` |
| POST | `/subscription/webhook` | None | Handles Stripe webhook events |

## Client Usage

```typescript
import { authClient } from '~/lib/auth.client';

// Get subscription status
const { data } = await authClient.subscription.status();
// → { plan, status, isTrial, daysLeft, limits, cancelAtPeriodEnd }

// Upgrade (redirects to Stripe Checkout)
const { data } = await authClient.subscription.upgrade({
  plan: 'pro',
  successUrl: window.location.origin + '/dashboard?upgraded=true',
  cancelUrl: window.location.origin + '/settings',
});
window.location.href = data.url;

// Cancel subscription
await authClient.subscription.cancel();

// Open Stripe billing portal
const { data } = await authClient.subscription.portal({
  returnUrl: window.location.origin + '/settings',
});
window.location.href = data.url;
```

## Database Table

**Table:** `subscription` (migration: `0011_add_subscription_table.sql`)

| Column | Type | Description |
|--------|------|-------------|
| `id` | TEXT PK | nanoid |
| `user_id` | TEXT FK→user | One subscription per user |
| `plan` | TEXT | `'free'`, `'pro'`, etc. |
| `status` | TEXT | `'trialing'`, `'active'`, `'canceled'`, `'expired'`, `'past_due'` |
| `trial_start` | INTEGER | Trial start timestamp (ms) |
| `trial_end` | INTEGER | Trial end timestamp (ms) |
| `stripe_customer_id` | TEXT | Stripe customer ID (`cus_...`) |
| `stripe_subscription_id` | TEXT | Stripe subscription ID (`sub_...`) |
| `stripe_price_id` | TEXT | Stripe price ID (`price_...`) |
| `period_start` | INTEGER | Current billing period start (ms) |
| `period_end` | INTEGER | Current billing period end (ms) |
| `cancel_at_period_end` | INTEGER | 0 or 1 |
| `created_at` | INTEGER | Record creation timestamp (ms) |
| `updated_at` | INTEGER | Last update timestamp (ms) |

## Webhook Events Handled

| Stripe Event | Action |
|-------------|--------|
| `checkout.session.completed` | Set status to `active`, store Stripe IDs, map priceId to plan |
| `customer.subscription.updated` | Sync status, period, plan, cancelAtPeriodEnd |
| `customer.subscription.deleted` | Set status to `canceled`, revert to free plan |

## Key Design Decisions

- **Stripe customer + trial created on signup (org creators only)** — Users who sign up directly get a real Stripe subscription in `trialing` status. Invited users are detected via a pending `invitation` record matching their email and skip trial creation entirely. If no payment method is added, Stripe auto-cancels after the trial.
- **Lazy trial expiration** — No cron job. The `/subscription/status` endpoint checks if `trialEnd < now` and updates to `expired` on read.
- **Workers compatibility** — Stripe SDK uses `Stripe.createFetchHttpClient()` for HTTP and `Stripe.createSubtleCryptoProvider()` for webhook signature verification (async `crypto.subtle`).
- **Stripe v20** — Subscription period dates are on `items.data[0].current_period_start/end` (not on the subscription object directly).

## Local Development with Stripe CLI

Forward Stripe webhooks to local dev server:

```bash
stripe listen --forward-to localhost:5173/api/auth/subscription/webhook
```

The CLI outputs a webhook signing secret (`whsec_...`) — put this in `STRIPE_WEBHOOK_SECRET` in `.env`.

## Adding a New Plan

1. Create product + price in Stripe Dashboard (or via API)
2. Add to the `plans` array in `app/lib/auth.server.ts`:
   ```typescript
   { name: 'team', priceId: 'price_xxx', limits: { prompts: -1, teamMembers: -1, apiCalls: -1 } }
   ```
3. Optionally add `yearlyPriceId` for annual billing

