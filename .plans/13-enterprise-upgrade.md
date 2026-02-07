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
When a Pro user hits Pro limits (5 team members, 50,000 API calls), the upgrade gate modal (Feature #04) should include an enterprise mention:

```
"Need more than 5 team members?"
[Talk to us about Enterprise]
```

This is a subtle addition to the existing upgrade gate -- just an extra line of text and a link at the bottom of the modal.

## Key Implementation Notes
- Enterprise card is purely informational -- no Stripe integration needed
- Feature list should include items that differentiate from Pro (SSO, SAML, etc.) even if they don't exist yet -- this is aspirational
- "Coming soon" badges on unbuilt features are fine and signal an active roadmap

## Files to Modify
- `app/routes/settings.tsx` -- Add enterprise card to plan comparison in billing section
- `app/components/upgrade-gate-modal.tsx` -- Add enterprise mention for Pro-limit users

## Conversion Psychology
- **Anchoring**: Research shows that adding a high-priced enterprise tier increases selection of the middle (Pro) tier by 28% (Slack case study). Users perceive $29/mo as much more reasonable when "Custom pricing" exists above it.
- **Aspirational signaling**: Listing SSO, SAML, and SLA signals that Promptly is a serious, enterprise-ready product -- even to users who don't need enterprise features.
- **Lead generation**: Every enterprise inquiry is a high-value sales lead. Even a mailto link captures intent.
- **Decoy effect**: Enterprise as the "aspirational but out of reach" option makes Pro feel like the smart, practical choice.
