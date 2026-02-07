# 15: Post-Trial Win-Back

## Summary
A sequence of in-app and email touchpoints to re-engage users whose trial expired without converting. Research shows 40-60% of eventual converters do so within 7 days of trial expiry, so this window is critical.

## Priority: P2

## Dependencies: #07 (Trial Ended State)

## Strategy: Segment by Engagement Level

Not all expired trial users are the same. Segment and tailor messaging:

| Segment | Definition | Strategy |
|---------|-----------|----------|
| **Power users** | Created 3+ prompts, used regularly | Emphasize continuity: "Your prompts are still here" |
| **Partial users** | Created 1-2 prompts, low activity | Trial extension offer |
| **Ghost users** | Signed up, barely used | Fresh start: highlight new features |

## In-App Win-Back (for returning users)

### Return Visit Modal
When a user with an expired trial logs back in (beyond the first-visit modal from Feature #07):

**For power users (2+ visits after expiry):**
- **Title**: "Welcome back"
- **Body**: "Your [X] prompts are right where you left them. Upgrade to Pro to keep creating."
- **CTA**: "Upgrade to Pro"
- **Secondary**: "Continue with Free"
- **Show frequency**: Once per week (max 3 times total), tracked in localStorage

**For partial users (1-2 prompts, returning):**
- **Title**: "Pick up where you left off"
- **Body**: "You started building something great. Upgrade to Pro and we'll extend your trial by 7 days."
- **CTA**: "Reactivate with 7-day extension"
- **Secondary**: "Continue with Free"
- **Implementation**: Requires new endpoint to create a new trial subscription

**For ghost users (no prompts, returning):**
- **Title**: "Ready to try Promptly?"
- **Body**: "Create your first prompt and see how easy prompt management can be."
- **CTA**: "Create a prompt"
- **Secondary**: "Learn more" (links to docs or tour)
- **Note**: Don't push upgrade on users who haven't experienced value yet

### "What's New" Indicator
If new features have been released since the user's trial ended:
- Small badge on the sidebar: "New features"
- Links to a changelog or feature highlight
- Re-sparks interest without being pushy

## Email Win-Back Sequence

### Timing

| Day (post-expiry) | Email | Segment |
|-------------------|-------|---------|
| Day 0 | "Your trial has ended" | All |
| Day 3 | "Your prompts are waiting" | Power users only |
| Day 5 | "7-day trial extension" | Partial users only |
| Day 7 | "What's new in Promptly" | All who haven't converted |
| Day 14 | "Come back for 20% off" | All who haven't converted |

### Email Content

#### Day 0: Trial Ended
- **Subject**: "Your Promptly Pro trial has ended"
- **Body**: Summary of what they used during trial (prompts created, versions published, team members invited). Reassurance that data is safe. Upgrade CTA.
- **CTA**: "Upgrade to Pro"

#### Day 3: Continuity (Power Users)
- **Subject**: "Your [X] prompts are still here"
- **Body**: Brief, personal. "Your prompts and configurations are safe. Upgrade anytime to continue building."
- **CTA**: "Continue with Pro"

#### Day 5: Trial Extension (Partial Users)
- **Subject**: "Need more time? Here's 7 more days"
- **Body**: "It looks like you were just getting started. We've extended your trial by 7 days so you can fully explore Promptly Pro."
- **CTA**: "Reactivate my trial"
- **Note**: Only offer to users who showed engagement but may not have had enough time

#### Day 7: What's New (All)
- **Subject**: "New in Promptly: [feature name]"
- **Body**: Highlight 1-2 new features or improvements since their trial. Keep it focused on value, not on the subscription.
- **CTA**: "See what's new"

#### Day 14: Discount (Final)
- **Subject**: "20% off Promptly Pro -- this week only"
- **Body**: Time-limited discount offer (7-day expiry on the offer). Create urgency through the offer deadline, not through product restrictions.
- **CTA**: "Get 20% off Pro"
- **Implementation**: Requires Stripe coupon

## Trial Extension Implementation
For the "7-day extension" offer:
1. Create a new endpoint: `POST /subscription/extend-trial`
2. If user has an expired subscription, create a new Stripe subscription with a 7-day trial
3. Update local subscription record
4. Only available once per user (track in DB)

## Discount Implementation
For the "20% off" offer:
1. Pre-create a Stripe coupon: 20% off for 3 months
2. Include the coupon ID in the Stripe Checkout session when user upgrades via the offer link
3. Offer link includes a token/code that's validated server-side

## Email Service Requirements
This feature requires an email sending service. Options:
1. **Cloudflare Email Workers** -- Native to the platform, but limited
2. **Resend** -- Developer-friendly API, React Email templates, good free tier
3. **Postmark** -- Excellent deliverability, SaaS-focused
4. **SendGrid** -- Enterprise-grade, more complex

**Recommendation**: Resend, for its developer-friendly React Email templates and good integration with Cloudflare Workers.

## Key Implementation Notes
- Email win-back is a **separate effort** from the in-app components -- can be phased
- In-app modals need to track show count (max 3 times) in localStorage
- Segment users based on prompt count at time of trial expiry (store in subscription record)
- Discount offers need Stripe coupon infrastructure
- Trial extensions need careful handling to prevent abuse (one extension per user ever)

## Phased Implementation
1. **Phase 1**: Return visit modal only (in-app, no email)
2. **Phase 2**: Trial ended email (Day 0 only, requires email service setup)
3. **Phase 3**: Full email sequence + trial extensions + discounts

## Files to Create
- `app/components/winback-modal.tsx`
- Email templates (when email service is set up)

## Files to Modify
- `app/routes/layouts/app.tsx` -- Show winback modal for returning expired-trial users
- `app/plugins/trial-stripe/routes/` -- Add extend-trial endpoint (Phase 2+)

## Conversion Psychology
- **Mere-exposure effect**: Each touchpoint (email, in-app) increases familiarity and likelihood of conversion
- **Personalized value**: "Your [X] prompts are waiting" leverages sunk cost and endowment effect
- **Trial extension**: Removes the "not enough time" objection -- one of the top reasons for non-conversion
- **Discount laddering**: Starting with full price and adding discounts over time captures users at different price sensitivities
- **Scarcity on the offer**: "This week only" on the discount creates genuine urgency (unlike fake product scarcity)
- **Ghost user re-engagement**: Don't push payment on users who never experienced value -- guide them to the aha moment instead
