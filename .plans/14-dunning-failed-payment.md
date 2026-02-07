# 14: Dunning / Failed Payment State

## Summary
When a user's payment fails (card expired, insufficient funds, etc.), show clear in-app messaging and make it easy to resolve. The goal is to recover revenue without causing unnecessary alarm. Stripe handles retry logic automatically -- we just need to surface the issue in the UI.

## Priority: P1

## Dependencies: #01 (Subscription Root Loader), #03 (Trial Banner infrastructure)

## Detection
`subscription.status === 'past_due'`

This status is set by the Stripe webhook when a payment fails and enters the dunning period.

## UI Components

### 1. Failed Payment Banner
Persistent, non-dismissible banner at top of content area (same position as trial banner):

- **Style**: Red/destructive background, high contrast
- **Copy**: "Your last payment didn't go through. Update your payment method to keep Pro features."
- **CTA**: "Update payment method" (opens Stripe Portal)
- **Icon**: Warning/alert triangle icon
- **Dismissible**: No (this needs to be resolved)

### 2. Billing Page Warning
On the settings billing section, the current plan card shows a warning state:

```
+--------------------------------------------------+
| Current Plan                    [! Payment Issue] |
|                                                   |
| Pro Plan -- $29/month                             |
| Last payment failed on [date]                     |
|                                                   |
| Please update your payment method to avoid        |
| losing Pro features.                              |
|                                                   |
| [Update payment method]  [Contact support]        |
+--------------------------------------------------+
```

### 3. Sidebar Badge
Update the badge (Feature #02):
- `PRO` badge with red warning indicator (small dot or exclamation)
- Tooltip: "Payment issue -- click to resolve"

## CTA Copy
- **"Update payment method"** -- Clear, specific, tells them exactly what action to take
- Avoid "Pay now" -- sounds like a demand
- Avoid "Resolve payment" -- vague
- Include **"Contact support"** as secondary -- some payment failures are on Stripe's side

## Copy Tone
- **Helpful, not threatening**: "Your last payment didn't go through" rather than "Your account is at risk"
- **Action-oriented**: Tell them exactly what to do (update payment method)
- **Reassuring**: They still have access (during grace period)

## Grace Period
Stripe's default behavior:
1. Payment fails -> status becomes `past_due`
2. Stripe automatically retries (Smart Retries) over the next 1-4 weeks
3. If all retries fail -> `customer.subscription.deleted` event -> status becomes `canceled`

During the grace period, users keep Pro access. The in-app UI should:
- Show the warning banner but NOT restrict features
- Give users time to fix the issue
- Not create panic

## Stripe Portal Integration
"Update payment method" should use `authClient.subscription.portal()` to redirect to Stripe's billing portal, where users can:
- Add a new card
- Update existing card details
- Pay outstanding invoices

## Auto-Resolution
When Stripe successfully retries the payment:
1. Webhook receives `customer.subscription.updated` with `status: 'active'`
2. Local subscription record updates
3. On next page load, `useSubscription()` shows `status: 'active'`
4. Failed payment banner disappears automatically
5. No explicit user action needed (Stripe Smart Retries handle it)

## Stripe Dunning Emails
Configure Stripe's built-in failed payment emails in the Stripe Dashboard:
1. Go to Settings > Billing > Customer emails
2. Enable "Failed payment" notifications
3. Customize the email template with Promptly branding

These emails complement the in-app messaging -- emails reach users who haven't logged in.

## Key Implementation Notes
- Check `subscription.status === 'past_due'` to trigger this state
- The failed payment banner takes priority over other banners (trial, cancelled)
- Banner should render above everything else -- payment issues need immediate attention
- Stripe Portal is the simplest way to handle payment updates (no custom payment form needed)
- Consider adding a retry trigger button ("Retry payment") that re-attempts the charge -- though Stripe Smart Retries usually handle this

## Files to Create
- `app/components/failed-payment-banner.tsx` (or extend existing banner component)

## Files to Modify
- `app/routes/layouts/app.tsx` -- Show failed payment banner when `status === 'past_due'`
- `app/routes/settings.tsx` -- Show warning state in billing section

## Banner Priority Order
When multiple states could show a banner, use this priority (highest first):
1. Failed payment (`past_due`) -- RED, non-dismissible
2. Trial expired (`expired`) -- GREY, dismissible
3. Trial ending (`trialing`, <= 7 days) -- AMBER/RED, escalating
4. Subscription cancelled (`cancelAtPeriodEnd`) -- GREY, dismissible
5. Trial active (`trialing`, > 7 days) -- BLUE, dismissible

## Conversion Psychology
- **Urgency without alarm**: Red banner creates visual urgency but the copy stays calm and helpful. Panicking users makes them more likely to cancel entirely.
- **One-click resolution**: Stripe Portal handles all the complexity. Users click one button and fix the issue.
- **Auto-resolution**: Smart Retries mean many failed payments resolve themselves. The UI should reflect resolution automatically, giving users confidence that the system works.
- **Grace period transparency**: Not restricting features during grace period builds trust. Users appreciate being treated fairly during payment hiccups.
