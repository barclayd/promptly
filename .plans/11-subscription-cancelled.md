# 11: Subscription Cancelled State

## Summary
When a user cancels their Pro subscription, they retain access until the end of their billing period. This feature handles the UI for that interim state -- showing when access ends, offering to reactivate, and transitioning gracefully to the free tier.

## Priority: P1

## Dependencies: #01 (Subscription Root Loader), #09 (Billing Page)

## Detection
`subscription.status === 'active' && subscription.cancelAtPeriodEnd === true`

This means Stripe will not renew the subscription, but the user still has Pro access until the current period ends.

## UI Components

### 1. Cancelled Banner
Replaces the trial banner position (top of content area):

- **Style**: Neutral/grey background (not alarming -- they still have access)
- **Copy**: "Your Pro plan is set to cancel on [date]. You'll retain Pro features until then."
- **Primary CTA**: "Reactivate Pro"
- **Secondary**: "Learn more" (links to billing page)
- **Dismissible**: Yes (reappears every 3 days)

### 2. Billing Page State
On the settings billing section:

**Current Plan Card:**
```
+--------------------------------------------------+
| Current Plan                                      |
|                                                   |
| [PRO badge]  Cancels on March 1, 2026             |
|                                                   |
| You'll move to the Free plan after this date.     |
| Your existing prompts and data will be preserved.  |
|                                                   |
| [Reactivate Pro]  [Manage billing]                |
+--------------------------------------------------+
```

### 3. Sidebar Badge
Update the badge (Feature #02) to show:
- `PRO` badge in grey (instead of brand color)
- Subtle "Cancels [date]" subtext or tooltip

## Reactivation Flow
When user clicks "Reactivate Pro":
1. Call the Stripe API to remove `cancel_at_period_end` flag
2. This requires a new endpoint or using the Stripe billing portal
3. **Simplest approach**: Redirect to Stripe Billing Portal where users can reactivate
4. **Better UX**: Add a `POST /subscription/reactivate` endpoint that calls `stripe.subscriptions.update(subId, { cancel_at_period_end: false })`

### New Endpoint Needed
```
POST /api/auth/subscription/reactivate
- Requires session
- Calls stripe.subscriptions.update(subId, { cancel_at_period_end: false })
- Updates local subscription record: cancelAtPeriodEnd = 0
- Returns success
```

## CTA Copy
- **"Reactivate Pro"** -- Clear, specific, action-oriented
- Avoid "Undo cancellation" -- sounds bureaucratic
- Avoid "Don't cancel" -- negative framing

## Copy Strategy
The tone should be **understanding but gently persuasive**:
- Acknowledge their decision respectfully
- Remind them of what they'll lose (specific features)
- Reassure data safety
- Make reactivation effortless (one click)

## Transition to Free Plan
When the billing period ends, Stripe fires `customer.subscription.deleted`. The existing webhook handler:
1. Sets `status` to `'canceled'`
2. Reverts `plan` to `'free'`
3. Next page load, `useSubscription()` reflects the free plan
4. UI switches to the trial-ended/free state (Feature #07)

## Key Implementation Notes
- Check both `cancelAtPeriodEnd` AND `status === 'active'` to identify this state
- The cancelled banner should coexist with the sidebar badge update
- Need to know the `periodEnd` date to show "Cancels on [date]" -- this may need to be added to the SubscriptionStatus type
- After successful reactivation, revalidate subscription data and remove the cancelled banner

## Files to Create
- `app/components/cancelled-banner.tsx` (or extend trial-banner.tsx to handle this state)

## Files to Modify
- `app/routes/layouts/app.tsx` -- Show cancelled banner when appropriate
- `app/routes/settings.tsx` -- Update billing section for cancelled state
- `app/plugins/trial-stripe/routes/` -- Add reactivate endpoint (if not using portal)
- `app/plugins/trial-stripe/types.ts` -- May need to add `periodEnd` to SubscriptionStatus

## Conversion Psychology
- **Cooling-off period**: The interim period between cancellation and actual loss is a powerful conversion window. Users who cancelled impulsively often reactivate during this time.
- **Ease of return**: Making reactivation one click (instead of re-subscribing from scratch) dramatically increases reactivation rates.
- **Data safety messaging**: "Your existing prompts and data will be preserved" removes the biggest fear -- losing work.
- **Date specificity**: "Cancels on March 1" is more impactful than "cancels at end of period" because it creates a concrete deadline.
