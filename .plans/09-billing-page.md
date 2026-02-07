# 09: Billing & Plan Management Page

## Summary
A dedicated billing section within the settings page where all org members can view their current plan and usage, and where admins/owners can manage the subscription, payment methods, and access Stripe's billing portal. This is the "home base" for all subscription management. Viewing is available to all members; managing (upgrade, cancel, payment, portal access) is restricted to admin/owner roles.

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

## Role-Based Page Layout

This is a critical design consideration. The billing page must render differently based on the viewing member's role in the organization.

### Admin/Owner View
Full billing management capabilities:
- Upgrade, cancel, reactivate subscription
- Add/update payment methods
- Access Stripe billing portal
- View and download invoices
- All CTAs are active and functional

### Member View
Read-only plan overview:
- Can see the current plan, status, usage, and billing history
- All action CTAs (Upgrade, Cancel, Manage billing, Reactivate, Update payment method) are replaced with informational text: "Contact your workspace admin to make changes"
- Show the admin's name and email so the member knows who to contact: "Managed by [Admin Name] ([admin@email.com])"
- Plan comparison cards show "Current Plan" badge on the active plan, but upgrade buttons are either hidden or disabled with a tooltip: "Only workspace admins can change the plan"

### Role Detection
Add `memberRole` to the billing page data requirements (see Data Needed section). This can be derived from the Better Auth `member` table where `organizationId` matches the current org and `userId` matches the current user. Roles: `owner`, `admin`, `member`.

---

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
- **Role gating**: Upgrade buttons on plan cards should be role-gated. For non-admin members, disable the button with a tooltip: "Only workspace admins can upgrade"

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
- **Role gating**: For non-admin members, either hide this section entirely or show read-only card info (e.g., "Visa ending in 4242") without any action buttons

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
- **Role gating**: Invoice list is read-only and visible to all members. "View all invoices" link (which opens the Stripe Portal) should be restricted to admins/owners only.

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
- **`memberRole`**: The current user's role in the active organization (`owner`, `admin`, or `member`). This is a prerequisite for all role gating on the billing page. Fetch from the Better Auth `member` table.
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

### Multi-Org Switching
- The billing page must reactively update when the active organization changes (e.g., via org switcher in the sidebar)
- All data (subscription status, usage counts, member role, invoices) is org-scoped and must refresh when `orgContext` changes

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

## B2B Best Practices

### Usage Dashboard on Billing Page
Show a lightweight usage summary directly on the billing page (integrated with Feature #10):
- Prompts: 2/3 with progress bar
- Team members: 1/1 with progress bar
- API calls: 1,247/5,000 with progress bar
- This gives billing-focused context: "Here's what you're using, here's why upgrading matters"

### Per-Member Cost Breakdown
For Pro plan display, show per-member cost: "$29/month ($5.80/member with 5 seats)"
- This is a common B2B SaaS pattern that makes the price feel more reasonable for team buyers
- Dynamically calculate based on current member count: "$29 / [current members] = $X.XX per member"

### Annual Pricing Toggle
Architect the plan comparison section to support an annual pricing toggle now, even if only monthly is available at launch:
- Add a "Monthly / Annual" toggle at the top of the plan comparison section
- Annual pricing slot shows "Coming soon" or "Save 20% with annual billing" placeholder
- This primes users for annual plans and makes the feature launch trivial

### Trial-Specific Billing Experience
When status is `trialing`:
- Show a prominent trial countdown: "7 days left in your Pro trial"
- Clearly explain what happens at expiry: "You'll move to the Free plan with 3 prompts, 1 member, 5,000 API calls"
- CTA: "Add payment method to keep Pro" (not just "Upgrade" which implies they don't already have Pro features)

### Cancellation Save Flow
When "Cancel plan" is clicked:
1. Exit survey: "What's your main reason for cancelling?" (too expensive, not using enough, switching tools, other)
2. Contextual save offer based on reason (e.g., "too expensive" -> show annual pricing discount; "not using enough" -> show usage tips)
3. Show specific loss data: "You'll lose access to [X] prompts above the free limit and [Y] team members will lose access"
4. Final confirmation with clear date: "Your Pro features will end on [date]"

### Invoice & Finance Department Support
- Allow setting a "billing contact" email separate from the org owner (for finance departments)
- Invoice email preferences: option to CC finance team on invoice emails
- These are table-stakes for B2B sales where the buyer and the payer are different people

### Billing Cycle Visibility
- Show billing cycle and next charge date prominently on the current plan card: "Next charge: $29 on March 1, 2026"
- For trialing: "Trial ends February 14, 2026. First charge: $29 on February 14, 2026 (if payment method added)"

### Billing Contact Concept
- Separate from org owner: a "billing contact" is the person who receives invoices and payment failure notifications
- Default to org owner, but allow admins to set a different billing email
- This is especially important for organizations where engineering leads manage the tool but finance handles payment

## Conversion Psychology
- **Anchoring**: Showing Enterprise (even as "Coming soon") anchors a higher price point, making $29/mo feel very reasonable
- **Current plan visibility**: Always showing what plan they're on creates constant awareness without being pushy
- **"Recommended" badge**: Research shows a "Recommended for teams" badge increases middle-tier selection by 44%
- **Stripe Portal trust**: Using Stripe's hosted portal for payment details leverages Stripe's brand trust for payment security
- **Invoice access**: Showing invoices builds trust and professionalism, especially for business buyers who need receipts
