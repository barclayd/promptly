# 11: Subscription Cancelled State

## Summary
When an org admin cancels the organization's Pro subscription, all org members still have Pro access until the end of the billing period. This feature handles the UI for that interim state -- showing when access ends, offering to reactivate (admin/owner only), and transitioning all org members gracefully to the free tier.

## Priority: P1

## Dependencies: #01 (Subscription Root Loader), #09 (Billing Page)

## Detection
`subscription.status === 'active' && subscription.cancelAtPeriodEnd === true`

This means Stripe will not renew the subscription, but all org members still have Pro access until the current period ends.

## UI Components

### 1. Cancelled Banner
Replaces the trial banner position (top of content area):

- **Style**: Neutral/grey background (not alarming -- they still have access)
- **Copy**: "Your Pro plan is set to cancel on [date]. You'll retain Pro features until then."
- **Role-aware CTAs**:
  - **Owner/Admin**: Primary CTA "Reactivate Pro", Secondary "Learn more" (links to billing page)
  - **Member**: No action button. Instead, show informational text: "Contact your workspace admin to reactivate." Consider showing the admin's name.
- **Dismissible**: Yes (reappears every 3 days)

### 2. Billing Page State
On the settings billing section:

**Current Plan Card (Admin/Owner view):**
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

**Current Plan Card (Member view):**
```
+--------------------------------------------------+
| Current Plan                                      |
|                                                   |
| [PRO badge]  Cancels on March 1, 2026             |
|                                                   |
| Your workspace will move to the Free plan after   |
| this date. Contact your admin to reactivate.      |
|                                                   |
| Managed by [Admin Name] ([admin@email.com])       |
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
- Must include requireOrgAdmin() check -- only org owners/admins can reactivate
- Query subscription by organizationId (not userId) to support org-level billing
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
- The cancelled banner should coexist with the sidebar badge update. Note the sidebar badge update is driven by `useSubscription()` which already reflects org-level status for all members.
- Need to know the `periodEnd` date to show "Cancels on [date]" -- `periodEnd` needs to be added to the `SubscriptionStatus` type (shared requirement with Feature #10)
- After successful reactivation, revalidate subscription data and remove the cancelled banner
- **Transition to free affects ALL members simultaneously**: When the billing period ends and `customer.subscription.deleted` fires, the plan reverts to free for the entire org. All members will see free-tier limits on their next page load.

## Files to Create
- `app/components/cancelled-banner.tsx` (or extend trial-banner.tsx to handle this state)

## Files to Modify
- `app/routes/layouts/app.tsx` -- Show cancelled banner when appropriate
- `app/routes/settings.tsx` -- Update billing section for cancelled state
- `app/plugins/trial-stripe/routes/` -- Add reactivate endpoint (if not using portal)
- `app/plugins/trial-stripe/types.ts` -- May need to add `periodEnd` to SubscriptionStatus

## B2B Best Practices

### Multi-Step Cancellation Flow
Follow the Slack pattern for cancellation:
1. **Exit survey**: "What's your main reason for cancelling?" (too expensive, not enough features, switching to another tool, just testing, other)
2. **Contextual save offer**: Based on the reason selected, show a relevant counter-offer (e.g., "too expensive" -> annual pricing discount; "not using enough" -> usage tips and activation help)
3. **Show specific loss data**: Use the org's actual usage to show impact: "You have 15 prompts -- on Free you'll keep 3. You have 4 team members -- on Free you'll keep 1."
4. **Final confirmation**: Clear date and consequences, with one last "Keep Pro" escape hatch

### Specific Loss Data Display
When showing what the org will lose, calculate dynamically:
- "15 prompts -> 3 (12 will become read-only)"
- "4 team members -> 1 (3 members will lose access)"
- "50,000 API calls -> 5,000"
- This makes the loss tangible rather than abstract

### Win-Back Email Sequence
Automated email sequence after cancellation:
- **Day 0**: Cancellation confirmation email with clear end date and one-click reactivation link
- **Day 7**: Reminder email: "Your Pro plan ends in 7 days. Here's what you'll miss."
- **Day 13** (1 day before expiry): Last chance email: "Tomorrow your workspace loses Pro access. Reactivate now to keep everything."

### Smart Banner Re-Surfacing
Escalating banner pattern for dismissed banners:
- First dismissal: reappears after 3 days
- Second dismissal: reappears after 7 days
- Final 3 days before expiry: banner becomes persistent (non-dismissible) for admins
- Members always see a dismissible informational banner

### One-Click Reactivation
Use the dedicated `POST /subscription/reactivate` endpoint (not a Stripe Portal redirect):
- Single click from the banner or billing page
- No Stripe redirect, no extra steps
- Instant confirmation toast: "Welcome back! Your Pro plan has been reactivated."
- This is critical -- every extra step in the reactivation flow loses potential re-subscribers

### Notify Other Org Members
When an admin schedules cancellation:
- Other org members should be notified on their next page load via a toast: "Your workspace Pro plan has been scheduled for cancellation on [date] by [Admin Name]"
- This creates natural social pressure -- team members may ask the admin to reconsider
- Store notification state to show only once per member

### Grace Period for Data
When transitioning from Pro to Free:
- Excess prompts (beyond the free limit of 3) become **read-only**, not deleted
- Excess team members see a "Your access has been reduced" message but can still view (not edit) existing content
- This preserves work and reduces the fear of data loss, making future re-subscription more likely

### Reactivation Celebration
When an admin reactivates the subscription:
- Show a celebratory toast to the admin: "Welcome back! Your Pro plan has been reactivated."
- On next page load, show other org members a toast: "Great news! Your workspace Pro plan has been reactivated."

## Conversion Psychology
- **Cooling-off period**: The interim period between cancellation and actual loss is a powerful conversion window. Users who cancelled impulsively often reactivate during this time.
- **Ease of return**: Making reactivation one click (instead of re-subscribing from scratch) dramatically increases reactivation rates.
- **Data safety messaging**: "Your existing prompts and data will be preserved" removes the biggest fear -- losing work.
- **Date specificity**: "Cancels on March 1" is more impactful than "cancels at end of period" because it creates a concrete deadline.
