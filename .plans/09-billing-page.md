# 09: Billing & Plan Management Page

## Summary
A dedicated billing section within the settings page where users can view their current plan, manage their subscription, see usage, and access Stripe's billing portal. This is the "home base" for all subscription management.

## Priority: P0

## Dependencies: #01 (Subscription Root Loader)

## Page Structure

### Approach: Tab within Settings
Add a "Billing" tab to the existing settings page rather than a separate route. This keeps navigation simple and follows the Notion/Linear pattern of settings subsections.

Settings page tabs:
1. **General** (future -- account settings)
2. **API Keys** (existing content)
3. **Billing** (new)

Alternatively, since the page currently only has API Keys, implement as a sectioned page with "API Keys" and "Billing" as distinct card sections.

## Billing Section Layout

### Section 1: Current Plan Card

```
+--------------------------------------------------+
| Current Plan                                      |
|                                                   |
| [PRO TRIAL badge]  or  [PRO badge]  or  [FREE]   |
|                                                   |
| Pro Plan -- $29/month                             |
| Trial ends February 14, 2026 (7 days left)        |
|                                                   |
| [Upgrade to Pro]  [Manage billing]                |
+--------------------------------------------------+
```

#### States

| Status | What to Show |
|--------|-------------|
| `trialing` | Plan name, trial end date, days remaining, "Upgrade to Pro" CTA |
| `active` | Plan name, next billing date, amount, "Manage billing" (Stripe portal) |
| `canceled` (period remaining) | Plan name, "Active until [date]", "Reactivate" CTA |
| `expired` | "Free Plan", upgrade CTA |
| `past_due` | Plan name, "Payment failed", "Update payment method" CTA (red warning) |

### Section 2: Plan Comparison

A horizontal card layout showing Free vs Pro (and eventually Enterprise):

```
+-----------------------+  +-----------------------+  +-----------------------+
| Free                  |  | Pro (RECOMMENDED)     |  | Enterprise            |
| $0/month              |  | $29/month             |  | Custom                |
|                       |  |                       |  |                       |
| 3 prompts             |  | Unlimited prompts     |  | Everything in Pro     |
| 1 team member         |  | 5 team members        |  | Unlimited members     |
| 5,000 API calls       |  | 50,000 API calls      |  | Unlimited API calls   |
|                       |  |                       |  | SSO & SAML            |
|                       |  |                       |  | Priority support      |
|                       |  |                       |  |                       |
| [Current Plan]        |  | [Upgrade to Pro]      |  | [Talk to us]          |
+-----------------------+  +-----------------------+  +-----------------------+
```

#### Design Notes
- Highlight the recommended plan (Pro) with a distinct border color or "Recommended" badge
- Enterprise card is a future placeholder -- shows "Coming soon" or "Talk to us" with email link
- On the current plan card, show "Current Plan" as a disabled/muted button
- Monthly/annual toggle can be added later when annual pricing is available
- Use checkmark icons for features, not text bullets

### Section 3: Payment Method (for paid/trialing users)

```
+--------------------------------------------------+
| Payment Method                                    |
|                                                   |
| No payment method on file.                        |
| [Add payment method]                              |
|                                                   |
| -- or, if card on file --                         |
|                                                   |
| Visa ending in 4242 -- Expires 12/2028            |
| [Update payment method]                           |
+--------------------------------------------------+
```

- "Add/Update payment method" opens Stripe Billing Portal via `authClient.subscription.portal()`
- Show card brand icon (Visa, Mastercard, etc.) if available from subscription data

### Section 4: Billing History (for paid users)

```
+--------------------------------------------------+
| Billing History                                   |
|                                                   |
| Feb 1, 2026  -- Pro Plan    -- $29.00  -- Paid    |
| Jan 1, 2026  -- Pro Plan    -- $29.00  -- Paid    |
|                                                   |
| [View all invoices]  (opens Stripe Portal)        |
+--------------------------------------------------+
```

- Show last 3-5 invoices inline
- "View all invoices" opens Stripe Billing Portal
- If no invoices yet (trialing without payment), show "No invoices yet"

## CTA Copy

| Context | Primary CTA | Secondary |
|---------|------------|-----------|
| Trialing | "Upgrade to Pro" | "Add payment method" |
| Free/Expired | "Upgrade to Pro" | "Compare plans" |
| Active | "Manage billing" | "Cancel plan" |
| Canceled | "Reactivate plan" | "Manage billing" |
| Past due | "Update payment method" | "Contact support" |

## Stripe Portal Integration
Several actions redirect to Stripe's hosted billing portal:
- Update payment method
- View all invoices
- Download invoice PDFs
- Manage tax information

Use `authClient.subscription.portal({ returnUrl: window.location.href })` to create a portal session and redirect.

## Key Implementation Notes

### Data Needed
- Subscription status from `useSubscription()`: plan, status, isTrial, daysLeft, limits, cancelAtPeriodEnd
- Current usage counts: prompt count, team member count, API call count (need to add to loader or fetch separately)
- Payment method info: Currently not exposed by the subscription status endpoint. Options:
  1. Add to status endpoint (preferred)
  2. Redirect to Stripe Portal for all payment info (simpler, less custom)

### Upgrade Flow
1. User clicks "Upgrade to Pro"
2. Call `authClient.subscription.upgrade({ plan: 'pro', successUrl, cancelUrl })`
3. Redirect to Stripe Checkout URL
4. On success, redirect back with `?upgraded=true` (handled by Feature #08)

### Cancel Flow
- "Cancel plan" triggers the cancellation flow (Feature #12)
- If simplified, directly calls `authClient.subscription.cancel()` and shows confirmation

### Navigation
- The sidebar "Billing" link in NavUser dropdown should navigate to `/settings` with the billing tab active
- Or use a URL hash/search param: `/settings?tab=billing`

## Files to Create
- `app/components/billing-section.tsx` (main billing layout)
- `app/components/plan-card.tsx` (reusable plan comparison card)
- `app/components/current-plan-card.tsx` (current plan status card)

## Files to Modify
- `app/routes/settings.tsx` -- Add billing section, restructure with tabs or sections
- `app/components/nav-user.tsx` -- Wire up "Billing" dropdown item to navigate to settings billing

## Design Reference
- Follow the existing settings page styling (card-based layout, consistent spacing)
- Use `Card` component from `app/components/ui/card.tsx`
- Plan comparison cards should be responsive: 3 columns on desktop, stacked on mobile
- The recommended plan (Pro) should stand out visually (border highlight, subtle background tint, badge)

## Conversion Psychology
- **Anchoring**: Showing Enterprise (even as "Coming soon") anchors a higher price point, making $29/mo feel very reasonable
- **Current plan visibility**: Always showing what plan they're on creates constant awareness without being pushy
- **"Recommended" badge**: Research shows a "Recommended for teams" badge increases middle-tier selection by 44%
- **Stripe Portal trust**: Using Stripe's hosted portal for payment details leverages Stripe's brand trust for payment security
- **Invoice access**: Showing invoices builds trust and professionalism, especially for business buyers who need receipts
