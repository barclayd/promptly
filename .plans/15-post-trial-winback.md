# 15: Post-Trial Win-Back

## Summary
A sequence of in-app and email touchpoints to re-engage organizations whose trial expired without converting. Research shows 40-60% of eventual converters do so within 7 days of trial expiry, so this window is critical.

> **Org-Level Framing**: All win-back messaging, segmentation, and tracking should be at the organization level, not the individual user level. The subscription belongs to the workspace, and upgrade decisions are made by org owners/admins.

## Priority: P2

## Dependencies: #07 (Trial Ended State)

## Strategy: Segment by Engagement Level

Not all expired trial organizations are the same. Segment and tailor messaging at the org level:

| Segment | Definition | Strategy |
|---------|-----------|----------|
| **Power orgs** | 3+ prompts created, multiple members | Emphasize continuity: "Your team's prompts are still here" |
| **Partial orgs** | 1-2 prompts, single user | Trial extension offer |
| **Ghost orgs** | Signed up, barely used | Fresh start: highlight new features |

> **Segmentation Data**: Store `trial_prompt_count` and `trial_member_count` in the subscription table at time of trial expiry. This allows org-level segmentation without querying historical data.

## In-App Win-Back (for returning members)

### Return Visit Modal
When a member of an org with an expired trial logs back in (beyond the first-visit modal from Feature #07):

**For power orgs (2+ visits after expiry):**
- **Title**: "Welcome back"
- **Body**: "Your workspace's [X] prompts are right where you left them. Upgrade to Pro to keep creating."
- **CTA (owner/admin)**: "Upgrade to Pro"
- **CTA (regular member)**: "Ask your workspace admin about upgrading"
- **Secondary**: "Continue with Free"
- **Show frequency**: Once per week (max 3 times total), tracked in localStorage

**For partial orgs (1-2 prompts, returning):**
- **Title**: "Pick up where you left off"
- **Body**: "Your team started building something great. Upgrade to Pro and we'll extend your trial by 7 days."
- **CTA (owner/admin)**: "Reactivate with 7-day extension"
- **CTA (regular member)**: "Ask your workspace admin about upgrading"
- **Secondary**: "Continue with Free"
- **Implementation**: Requires new endpoint to create a new trial subscription

**For ghost orgs (no prompts, returning):**
- **Title**: "Ready to try Promptly?"
- **Body**: "Create your first prompt and see how easy prompt management can be."
- **CTA**: "Create a prompt"
- **Secondary**: "Learn more" (links to docs or tour)
- **Note**: Don't push upgrade on users who haven't experienced value yet

> **localStorage Modal Tracking**: The frequency cap (max 3 times, once per week) is tracked per-browser via localStorage, not per-org. This is actually desirable behavior -- it prevents the modal from being shown excessively to the same person across devices while allowing different team members to each see it on their own device.

### "What's New" Indicator
If new features have been released since the user's trial ended:
- Small badge on the sidebar: "New features"
- Links to a changelog or feature highlight
- Re-sparks interest without being pushy

## Email Win-Back Sequence

> **Email Recipients**: All win-back emails should be sent to org owners/admins, not to every member. Owners/admins are the decision-makers for subscription upgrades.

### Timing

| Day (post-expiry) | Email | Segment |
|-------------------|-------|---------|
| Day 0 | "Your trial has ended" | All |
| Day 3 | "Your team's prompts are waiting" | Power orgs only |
| Day 5 | "7-day trial extension" | Partial orgs only |
| Day 7 | "What's new in Promptly" | All who haven't converted |
| Day 14 | "Come back for 20% off" | All who haven't converted |

### Email Content

#### Day 0: Trial Ended
- **Subject**: "Your Promptly Pro trial has ended"
- **Body**: Summary of what they used during trial (prompts created, versions published, team members invited). Reassurance that data is safe. Upgrade CTA.
- **CTA**: "Upgrade to Pro"

#### Day 3: Continuity (Power Orgs)
- **Subject**: "Your team's [X] prompts are still here"
- **Body**: Brief, personal. "Your workspace's prompts and configurations are safe. Upgrade anytime to continue building."
- **CTA**: "Continue with Pro"

#### Day 5: Trial Extension (Partial Orgs)
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
2. Endpoint must use `requireOrgAdmin()` and query by `organizationId`
3. If org has an expired subscription, create a new Stripe subscription with a 7-day trial
4. Update local subscription record
5. Only available **once per organization** (track via a `trial_extended` flag or timestamp in the subscription table), not per user -- prevents multiple admins from extending separately

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
- Segment orgs based on prompt count and member count at time of trial expiry (store `trial_prompt_count` and `trial_member_count` in subscription record)
- Discount offers need Stripe coupon infrastructure
- Trial extensions need careful handling to prevent abuse (one extension per organization ever)
- Emails should be sent to org owners/admins only, not all members

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
- **Personalized value**: "Your team's [X] prompts are waiting" leverages sunk cost and endowment effect
- **Trial extension**: Removes the "not enough time" objection -- one of the top reasons for non-conversion
- **Discount laddering**: Starting with full price and adding discounts over time captures users at different price sensitivities
- **Scarcity on the offer**: "This week only" on the discount creates genuine urgency (unlike fake product scarcity)
- **Ghost org re-engagement**: Don't push payment on orgs that never experienced value -- guide them to the aha moment instead

## B2B Best Practices

### "Team Decision" Dimension
Differentiate messaging based on whether the org is a solo evaluator or a multi-member team:
- **Solo evaluators** (1 member): Standard win-back messaging focused on individual value
- **Multi-member orgs** (2+ members): Emphasize team value, collaboration features, and the impact on other team members. "Your team of [X] relied on [Y] prompts during the trial."

### "Book a Call" for Multi-Member Orgs
Replace the Day 14 discount email with a "Book a call" CTA for multi-member orgs. Teams evaluating tools often have questions that a discount cannot answer (security, compliance, custom integrations). A 15-minute call with the founder has a higher conversion rate for team purchases than a 20% discount.

### "Export Your Data" Nudge
Leverage loss aversion by including an "Export your data" link in win-back emails. The subtle message: "Your data is safe, but if you're not coming back, here's how to export it." Most users who click the export link realize they'd rather keep using the product than go through the effort of migrating.

### Product-Led Reactivation Triggers
Set up automated notifications to org admins when a team member hits a Free plan limit:
- "Sarah tried to create a new prompt but hit the Free plan limit. Upgrade to Pro for unlimited prompts."
- This turns team members into organic upgrade advocates without requiring them to ask.

### Usage-Based Social Proof in Emails
Include anonymized usage benchmarks in win-back emails:
- "Teams like yours create an average of 47 prompts per month"
- "Organizations with [X] members typically publish [Y] versions per week"
- This positions the org's trial usage as below-average and implies untapped potential.

### "Pause" as a Win-Back Option
Offer subscription pausing (up to 3 months) as an alternative to staying on Free:
- Pause has a 60-70% reactivation rate compared to 10-15% for full cancellation/expiry
- "Not ready to upgrade? Pause your workspace for up to 3 months. Your data and settings stay exactly as they are."
- This is especially effective for orgs that say "not right now" rather than "never"
