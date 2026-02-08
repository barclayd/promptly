# 04: Plan Limit Enforcement & Upgrade Gate

## Summary
Enforce plan limits (prompts, team members, API calls) in the app and show contextual upgrade modals at the exact moment a user tries to exceed their plan. This is the **highest-converting** upgrade mechanism -- behavioral triggers at the point of friction convert 5-10x better than generic banners.

## Priority: P0

## Dependencies: #01 (Subscription Root Loader)

## Core Principle
**Let users click, then gate.** Don't grey out or hide the "Create" button when at the limit. Let them click it and show the upgrade modal. Research (Appcues, Slack, Spotify) consistently shows that encountering the limit at the moment of intent converts far better than pre-emptively hiding functionality.

## Limits to Enforce

| Resource | Free Limit | Pro Limit | Where Enforced |
|----------|-----------|-----------|----------------|
| Prompts | 3 | Unlimited (-1) | Create Prompt action |
| Team Members | 1 | 5 | Invite Member action |
| API Calls | 5,000/month | 50,000/month | API route (already exists) |

## Component: `UpgradeGateModal`

### Reusable Modal Pattern
A single modal component that accepts context about what limit was hit:

```tsx
<UpgradeGateModal
  resource="prompts"
  current={3}
  limit={3}
  planName="Free"
  onUpgrade={() => /* navigate to Stripe Checkout */}
  onDismiss={() => /* close modal */}
/>
```

### Modal Content (by resource)

#### Prompts Limit
- **Title**: "You've reached your prompt limit"
- **Body**: "Free plans include 3 prompts. Upgrade to Pro for unlimited prompts, 5 team members, and 50,000 API calls."
- **Usage indicator**: Progress bar showing "3 of 3 prompts used" (full, red)
- **Primary CTA**: "Upgrade to Pro -- $29/mo"
- **Secondary**: "Maybe later" (closes modal)
- **Tertiary**: "View all plans" (links to billing page)

#### Team Members Limit
- **Title**: "Invite your team with Pro"
- **Body**: "Free plans include 1 team member. Upgrade to Pro to invite up to 5 team members."
- **Usage indicator**: "1 of 1 team seats used"
- **Primary CTA**: "Upgrade to Pro -- $29/mo"
- **Secondary**: "Maybe later"

#### API Calls Limit
- **Title**: "You've used your monthly API calls"
- **Body**: "Free plans include 5,000 API calls/month. Pro includes 50,000. Your current integrations will resume next month or you can upgrade now."
- **Usage indicator**: "5,000 of 5,000 API calls used"
- **Primary CTA**: "Upgrade to Pro -- $29/mo"
- **Secondary**: "Maybe later"

### Copy Rationale
- **Specific numbers** ("3 of 3 prompts") rather than vague ("you've reached your limit") -- research shows specific copy converts 23% better
- **Opportunity framing**: "Upgrade for unlimited" rather than "You can't do this" -- adapted from Spotify's "you discovered a Premium feature" pattern
- **Include the price**: "$29/mo" in the CTA reduces friction -- users don't have to wonder what it costs
- **Always show what Pro includes**: Mention all 3 key features, not just the one they hit

## Server-Side Enforcement

### Prompts
In `app/routes/api/prompts.create.ts`, before creating the prompt:
1. Get subscription status (from the active organization's subscription via `orgContext`)
2. Count existing non-deleted prompts for the organization
3. If `limits.prompts !== -1 && count >= limits.prompts`, return an error response
4. The client-side `CreatePromptDialog` catches the error and shows `UpgradeGateModal`

### Team Members
In `app/routes/api/team.invite.ts`, before creating the invitation:
1. Count current active members in the organization
2. If `limits.teamMembers !== -1 && count >= limits.teamMembers`, return an error

### API Calls
Already handled at the API worker level. In-app enforcement shows usage on the settings/billing page.

### Role-Based CTA Handling
- **Owners/Admins**: Show "Upgrade to Pro -- $29/mo" button that calls `authClient.subscription.upgrade()`
- **Regular Members**: Show "Contact your workspace admin to upgrade" (no upgrade button)
- Add `canUpgrade: boolean` or `userRole` prop to `UpgradeGateModal`
- The user's org role should be available from the root loader (see Plan 01 follow-ups)

> **Prerequisite**: The root loader must expose the user's org role (e.g., `owner`, `admin`, `member`) so that the `UpgradeGateModal` can conditionally render the correct CTA. This is a dependency on Plan 01 follow-ups.

## Client-Side Integration

### Create Prompt Flow
```
User clicks "Create" in sidebar
  -> CreatePromptDialog opens
  -> User fills form, submits
  -> Server checks limit
  -> If at limit: returns { error: 'LIMIT_EXCEEDED', resource: 'prompts', current: 3, limit: 3 }
  -> Client shows UpgradeGateModal instead of error toast
```

### Alternative: Pre-check on Client
For a snappier UX, optionally pre-check on the client side using subscription data from `useSubscription()`:
```
User clicks "Create" in sidebar
  -> Check useSubscription().limits.prompts vs current prompt count
  -> If at limit: show UpgradeGateModal immediately (skip the dialog)
  -> If under limit: open CreatePromptDialog normally
```
The server-side check remains as a safety net regardless.

## Upgrade Action
When user clicks "Upgrade to Pro":
1. Call `authClient.subscription.upgrade({ plan: 'pro', successUrl: window.location.href + '?upgraded=true', cancelUrl: window.location.href })`
2. Redirect to the Stripe Checkout URL returned
3. On success, Stripe redirects back to the app with `?upgraded=true` (handled by Feature #08)

## Design Details
- Use the existing `Dialog` component from `app/components/ui/dialog.tsx`
- Progress bar for usage: existing Tailwind styles, color-coded (green->amber->red)
- Primary CTA should be prominent (default button, not outline)
- Secondary CTA should be text/ghost style
- Dark mode compatible
- Mobile: dialog becomes a bottom sheet on small screens

## Files to Create
- `app/components/upgrade-gate-modal.tsx`

## Files to Modify
- `app/routes/api/prompts.create.ts` -- Add limit check before creation
- `app/routes/api/team.invite.ts` -- Add limit check before invitation
- `app/components/create-prompt-dialog.tsx` -- Handle LIMIT_EXCEEDED response
- Invite member component -- Handle LIMIT_EXCEEDED response

## B2B Best Practices

### Progressive Limit Warnings
Don't wait until the user hits the wall. Show a usage chip near the "Create" button as they approach the limit:
- At 2/3 prompts: Show a subtle "2/3 prompts used" chip/badge near the Create button
- At 3/3 prompts: Chip turns red/amber before they even click
- This reduces surprise and primes the user for the upgrade conversation

### Social Proof in Upgrade Modal
Add a social proof line in the `UpgradeGateModal` body:
- "Join 500+ teams managing AI prompts with Pro"
- Social proof converts 15-20% better than feature-only copy in B2B SaaS

### Annual Pricing Option
Present both options in the upgrade gate:
- "$29/mo" | "Save 20% with annual -- $23/mo"
- Annual pricing reduces churn and increases LTV; offering it at the gate captures intent at peak motivation

### "Request Upgrade from Admin" Flow for Members
When a regular member hits a limit:
- Show a "Request upgrade from admin" button instead of the upgrade CTA
- Clicking sends an in-app notification (and optionally email) to org admins
- Admin receives: "[Member name] tried to create a new prompt but your workspace is on the Free plan. Upgrade to Pro to unlock unlimited prompts."
- This turns every limit-hit into an admin-facing upgrade prompt, multiplying conversion touchpoints

### Contextual Value Framing
Lead with the specific feature the user just tried to use, then add secondary benefits:
- Hit prompt limit? Lead with "Unlimited prompts" then mention team members and API calls
- Hit team limit? Lead with "Up to 5 team members" then mention prompts and API calls
- Don't use a generic one-size-fits-all modal body

### Endowment Effect for Expired Trial Users
For users whose trial has expired (not just at-limit Free users), use "what you'll lose" framing:
- "You created 7 prompts during your trial. On the Free plan, you can only create 3. Upgrade to keep all your prompts active."
- Endowment/loss framing converts up to 32% better than gain framing for users who have already experienced the product

## Conversion Psychology
- **Moment of friction** (Appcues/Slack pattern): Showing the gate at the exact moment of intent (clicking "Create") generates 5-10x higher conversion than random upgrade banners
- **Endowment effect**: Users who have been using Pro features during trial feel the limit more acutely
- **Specificity**: "3 of 3 prompts" is concrete and honest; "limit reached" feels bureaucratic
- **Price transparency**: Showing $29/mo in the CTA removes the fear of "how much will this cost?" which is a major conversion blocker
