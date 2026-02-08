# 13: Enterprise Upgrade Path

## Summary
A lightweight "Enterprise" tier presence on the billing/pricing page that anchors the Pro plan's value and captures enterprise interest. This is primarily a pricing psychology tool (anchoring) and a lead generation mechanism.

## Priority: P2

## Dependencies: #09 (Billing Page)

## What This Is NOT (Yet)
- Not a self-serve enterprise tier with its own billing
- Not a separate enterprise onboarding flow
- Not SSO/SAML implementation

## What This IS
- A third column on the plan comparison (Feature #09)
- A "Contact us" flow that captures enterprise interest
- A pricing anchor that makes Pro ($29/mo) feel like a bargain

## Plan Comparison Card

```
+-----------------------+
| Enterprise            |
| Custom pricing        |
|                       |
| Everything in Pro,    |
| plus:                 |
|                       |
| - Unlimited members   |
| - Unlimited API calls |
| - SSO & SAML          |
| - Priority support    |
| - Custom contracts    |
| - SLA guarantee       |
| - Audit logs          |
|                       |
| [Talk to us]          |
+-----------------------+
```

## CTA: "Talk to us"
- Developer tools (Vercel, Linear, Notion, Postman, Supabase) almost universally use **"Contact Sales"** or **"Talk to us"**
- "Talk to us" is the most casual, developer-friendly variant
- Avoid "Get a quote" or "Request pricing" -- too formal/salesy

## Contact Flow

### Option A: Simple mailto (MVP)
"Talk to us" opens a pre-filled email:
```
mailto:enterprise@promptlycms.com?subject=Enterprise%20inquiry&body=Hi,%20I'm%20interested%20in%20Promptly%20Enterprise%20for%20my%20team.
```

### Option B: Contact Form Modal (Better)
"Talk to us" opens a modal with:
- Company name
- Team size (dropdown: 5-10, 10-50, 50-100, 100+)
- Email (pre-filled from account)
- Message (optional textarea)
- Submit button: "Send inquiry"

Form data sent via email or stored in D1 for follow-up.

### Recommended: Start with Option A, upgrade to B later
Option A is zero-effort and captures the same intent. Upgrade to a form when enterprise inquiries are frequent enough to warrant it.

## In-App Upsell Trigger
When a Pro workspace hits Pro limits (5 team members, 50,000 API calls), the upgrade gate modal (Feature #04) should include an enterprise mention:

```
"Need more than 5 team members?"
[Talk to us about Enterprise]
```

This is a subtle addition to the existing upgrade gate -- just an extra line of text and a link at the bottom of the modal.

## Enterprise Card Visibility
The Enterprise card on the billing page should be visible to all org members (it serves as pricing anchoring for everyone). However, CTA behavior varies by role:
- **Owners/Admins**: "Talk to us" opens the contact form/mailto directly
- **Regular members**: "Talk to us" could still be available (members may champion enterprise internally), but consider adding "or ask your workspace admin" subtext

## Contact Form Pre-Fill
The contact form (Option B) should pre-fill from the active org context:
- **Company name**: Pre-fill with current organization name
- **Email**: Pre-fill with current user's email
- **Organization usage stats**: Show current usage next to enterprise features for urgency (e.g., "Your workspace: 5/5 members, 42,000/50,000 API calls")

## Key Implementation Notes
- Enterprise card is purely informational -- no Stripe integration needed
- Feature list should include items that differentiate from Pro (SSO, SAML, etc.) even if they don't exist yet -- this is aspirational
- Use "Coming soon" badges **only for features genuinely on the roadmap**. Do not badge features with no intent to build -- this erodes trust if users follow up

## Files to Modify
- `app/routes/settings.tsx` -- Add enterprise card to plan comparison in billing section
- `app/components/upgrade-gate-modal.tsx` -- Add enterprise mention for Pro-limit users

## Conversion Psychology
- **Anchoring**: Research shows that adding a high-priced enterprise tier increases selection of the middle (Pro) tier by 28% (Slack case study). Users perceive $29/mo as much more reasonable when "Custom pricing" exists above it.
- **Aspirational signaling**: Listing SSO, SAML, and SLA signals that Promptly is a serious, enterprise-ready product -- even to users who don't need enterprise features.
- **Lead generation**: Every enterprise inquiry is a high-value sales lead. Even a mailto link captures intent.
- **Decoy effect**: Enterprise as the "aspirational but out of reach" option makes Pro feel like the smart, practical choice.

## B2B Best Practices

### Interactive Pricing Instead of Blank "Custom Pricing"
"Custom pricing" with no context is a conversion friction point. Consider one of these alternatives:
- **"Starting at $X/seat/month"** range to set expectations
- **Interactive pricing calculator** where users input team size and see an estimate
- **"From $199/month for teams of 10+"** -- a concrete anchor is better than no anchor

### Social Proof on Enterprise Tier
Add social proof elements to the enterprise card:
- Company logos (even 2-3) or "Trusted by X teams"
- "Join teams from [industry] using Promptly Enterprise"
- Testimonial snippet if available

### Feature Comparison Table Format
Instead of a bullet list per plan, use a full comparison table with Free | Pro | Enterprise columns. This format:
- Makes feature differences instantly scannable
- Highlights the value gap between tiers
- Is the industry standard (Notion, Linear, Vercel all use this format)
- Can include checkmarks, limits, and "Unlimited" badges

### Additional Contact Form Fields
When upgrading to Option B (form modal), include:
- **Primary use case** (dropdown: Prompt management, Multi-team collaboration, API distribution, Compliance/audit)
- **Current tooling** (text input: "What are you using today?")
- **Timeline** (dropdown: Evaluating now, Next quarter, Next 6 months)

These fields qualify leads and help prioritize follow-up.

### In-App Triggers Beyond Limit-Hitting
Don't wait for users to hit hard limits. Proactively surface enterprise messaging on these signals:
- **Team growth**: When the 4th or 5th member is added (approaching the 5-member Pro limit)
- **API usage spike**: When API usage crosses 80% of the Pro limit
- **Repeated billing page visits**: 3+ visits to billing in a month suggests evaluation activity
- **10+ published versions**: High publishing velocity suggests a mature, serious use case

### Dedicated `/enterprise` Landing Page (Future Enhancement)
As a future addition, create a dedicated `/enterprise` page that the "Talk to us" CTA can link to. This page would include:
- Full feature breakdown
- Security/compliance details
- Case studies
- Contact form with richer qualification fields
- FAQ specific to enterprise buyers

### Consider a "Team" Tier
For teams of 5-20 members, there's a gap between Pro ($29/mo, 5 members) and Enterprise (custom). A "Team" tier at ~$99-149/mo with 20 members, higher API limits, and priority support could capture this segment without requiring a sales conversation. This is the fastest-growing segment in B2B SaaS.
