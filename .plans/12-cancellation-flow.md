# 12: Cancellation Flow

## Summary
A multi-step cancellation flow that collects feedback, offers targeted retention saves, and handles the actual cancellation. The goal is to retain users when possible while respecting their decision. Research shows targeted save offers improve retention by 63%.

## Priority: P1

## Dependencies: #09 (Billing Page)

## Entry Point
"Cancel plan" link/button on the billing page (Feature #09). Should be visible but not prominent (text link, not primary button).

## Flow: 3-Step Modal Sequence

### Step 1: Feedback Collection

**Title**: "Before you go"
**Subtitle**: "Mind sharing why you're cancelling? This helps us improve Promptly."

**Options** (radio buttons):
1. "Too expensive for my needs"
2. "Missing a feature I need"
3. "Not using it enough"
4. "Switching to another tool"
5. "Other" (shows text input)

**CTA**: "Continue" (proceeds to Step 2)
**Secondary**: "Never mind, keep Pro" (closes modal)

### Step 2: Targeted Retention Offer

Based on the reason selected in Step 1, show a different offer:

#### "Too expensive"
- **Title**: "What if we could make it work?"
- **Body**: "We'd hate to see you go. How about 30% off Pro for the next 3 months?"
- **Value shown**: "$29/mo -> $20/mo for 3 months"
- **Primary CTA**: "Keep Pro at $20/mo"
- **Secondary**: "Cancel anyway"
- **Implementation**: Apply a Stripe coupon to the subscription

#### "Not using it enough"
- **Title**: "Take a break instead?"
- **Body**: "You can pause your subscription for up to 3 months. Your data stays safe, and you can pick back up anytime."
- **Primary CTA**: "Pause for 3 months"
- **Secondary**: "Cancel anyway"
- **Implementation**: Use Stripe's pause collection feature or set a future resume date

#### "Missing a feature"
- **Title**: "We're building fast"
- **Body**: "What feature would keep you here? We ship weekly and your feedback directly shapes our roadmap."
- **Text input**: "Tell us what you need..."
- **Primary CTA**: "Submit & keep Pro for 1 more month free"
- **Secondary**: "Cancel anyway"
- **Implementation**: Store feedback, extend trial/add free month via Stripe

#### "Switching to another tool"
- **Title**: "Before you switch"
- **Body**: "Your [X] prompts, [Y] published versions, and team setup are all here. If you need something specific that Promptly doesn't offer, we'd love to know."
- **Text input**: "What tool are you switching to?"
- **Primary CTA**: "Submit feedback"
- **Secondary**: "Cancel anyway"
- **Implementation**: Store feedback, proceed to cancellation

#### "Other"
- **Title**: "How can we help?"
- **Body**: "We'd love to understand what's not working. Your feedback helps us build a better product."
- **Text input**: Pre-filled with their "Other" text
- **Primary CTA**: "Submit feedback"
- **Secondary**: "Cancel anyway"

### Step 3: Confirmation

**Title**: "We're sorry to see you go"
**Body**:
```
Your Pro features will remain active until [period end date].
After that, your workspace will move to the Free plan:
- 3 prompts (you currently have [X])
- 1 team member
- 5,000 API calls/month

Your existing data will be preserved.
You can reactivate Pro anytime from Settings.
```
**Primary CTA**: "Keep Pro" (one last chance)
**Secondary CTA**: "Cancel subscription" (destructive style button)

After cancellation:
- Show brief toast: "Your subscription has been cancelled. Pro features are active until [date]."
- Revalidate subscription data
- Redirect to billing page showing cancelled state (Feature #11)

## What NOT to Do (Anti-Patterns)
- **Don't make cancellation hard to find** -- the "Cancel" option should be accessible on the billing page. Hiding it erodes trust.
- **Don't require phone calls or chat** -- self-serve cancellation is expected in B2B SaaS.
- **Don't add more than 3 steps** -- users will feel trapped and leave angry.
- **Don't use guilt-trip language** -- "Your team will be disappointed" is manipulative.
- **Don't force them through all steps** -- every step should have a direct "Cancel anyway" option.

## Discount Implementation
For the "Too expensive" save offer, use Stripe Coupons:
1. Pre-create a coupon in Stripe: 30% off for 3 months
2. When user accepts, apply the coupon to their subscription via `stripe.subscriptions.update(subId, { coupon: 'RETENTION_30_3MO' })`
3. Need a new endpoint: `POST /subscription/apply-retention-offer`

## Pause Implementation
For the "Not using enough" save offer:
1. Use Stripe's `pause_collection` feature: `stripe.subscriptions.update(subId, { pause_collection: { behavior: 'void' } })`
2. Set a resume date 3 months out
3. Need a new endpoint: `POST /subscription/pause`
4. This is a **future enhancement** -- initially, just offer the feedback option

## Data Collection
Store all cancellation feedback for product insights:
- Create a simple `cancellation_feedback` table or log to D1
- Fields: `user_id`, `reason`, `feedback_text`, `offer_accepted`, `timestamp`
- Or simpler: Post to a webhook endpoint (Slack, email) for real-time team visibility

## CTA Copy Summary

| Step | Primary CTA | Secondary CTA |
|------|------------|---------------|
| Step 1 (Feedback) | "Continue" | "Never mind, keep Pro" |
| Step 2 (Offer) | Varies by reason | "Cancel anyway" |
| Step 3 (Confirm) | "Keep Pro" | "Cancel subscription" |

## Key Implementation Notes
- Use `authClient.subscription.cancel()` for the actual cancellation (existing endpoint)
- The existing cancel endpoint sets `cancel_at_period_end: true` -- user keeps access until period end
- Discount offers need new Stripe integration (coupon application)
- Pause requires Stripe's pause_collection feature
- All feedback should be stored/logged regardless of whether the user actually cancels
- Use the existing `Dialog` component with state management for the multi-step flow

## Files to Create
- `app/components/cancellation-flow.tsx` (multi-step modal)

## Files to Modify
- `app/routes/settings.tsx` -- Add cancel trigger in billing section
- `app/plugins/trial-stripe/routes/` -- Potentially add new endpoints for offers

## Phased Implementation
1. **Phase 1 (MVP)**: Feedback collection + direct cancellation (Steps 1 & 3, skip retention offers)
2. **Phase 2**: Add targeted retention offers (Step 2) -- requires Stripe coupon setup
3. **Phase 3**: Add pause functionality

## Conversion Psychology
- **Feedback as friction**: Asking "why" before cancelling creates a moment of reflection. Some users realize their reason is solvable.
- **Matched offers**: Powtoon improved retention by 63% by matching the offer to the cancellation reason. Generic "please stay" is far less effective.
- **"Keep Pro" as final CTA**: Placing the keep option as the primary (visually prominent) CTA on the confirmation step gives one last conversion opportunity.
- **Period-end access**: Knowing they keep access until the period end reduces the pressure of the decision and increases the chance of reactivation later.
