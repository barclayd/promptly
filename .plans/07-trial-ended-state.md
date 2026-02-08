# 07: Trial Ended / Expired State

## Summary
When a user's trial expires without upgrading, they should see a clear but non-hostile state that explains what changed, preserves access to their existing work, and makes upgrading easy. This is one of the most critical moments for conversion -- **40-60% of users who eventually convert do so within 7 days of trial expiry**.

## Priority: P0

## Dependencies: #01 (Subscription Root Loader), #03 (Trial Banner), #04 (Limit Enforcement)

## Core Principle: Graceful Degradation, Never Lockout
- Users MUST always be able to log in, view, and edit their existing prompts
- The workspace can't have more than 3 prompts on the Free plan
- The workspace can't have more than 1 team member on the Free plan
- The experience should feel like a gentle downgrade, not a punishment

### Role-Based Behavior

Three distinct personas experience the post-trial state differently:

1. **Org owner/admin on expired trial**: Can upgrade, sees full CTAs ("Upgrade to Pro -- $29/mo"), has billing authority, receives the first-visit post-trial modal with upgrade buttons
2. **Org member on expired trial**: Cannot upgrade, sees "Ask your admin to upgrade" or "Request upgrade" CTA instead. Clicking notifies org admins. Should NOT see Stripe Checkout CTAs they can't act on.
3. **Invited user joining an expired org**: Sees the Free plan state from the start. No trial context, no "your trial ended" language -- just the standard Free plan experience with limit enforcement (Plan 04).

> **Prerequisite**: The root loader must expose the user's org role (see Plan 01 follow-ups) so all components can branch on `canUpgrade`.

## UI Components

### 1. Expired Trial Banner (replaces Trial Countdown Banner)
Persistent banner at top of content area (same position as Feature #03 banner):

- **Style**: Muted background (grey/neutral), not aggressive
- **Copy**: "Your Pro trial has ended. You're now on the Free plan."
- **CTA**: "Upgrade to Pro" (primary button)
- **Secondary**: "See what's included" (links to billing page)
- **Dismissible**: Yes, but reappears every 3 days (localStorage with timestamp)

### 2. First-Visit Post-Trial Modal
Shown once, the first time a user logs in after their trial expires:

- **Title**: "Your Pro trial has ended"
- **Body**:
  ```
  Thanks for trying Promptly Pro! Here's what changed:

  - Prompts: Limited to 3 (your workspace created [X] during the trial)
  - Team members: Limited to 1
  - API calls: Limited to 5,000/month

  Your existing prompts and data are safe and accessible.
  Upgrade anytime to restore Pro features.
  ```
- **Primary CTA**: "Upgrade to Pro -- $29/mo"
- **Secondary CTA**: "Continue with Free"
- **Tertiary**: "What's included in each plan?" (link to billing page)

### 3. Reasons to Upgrade Section (in the modal or on a dedicated page)
After the trial ends, give users compelling reasons to come back:

**For workspaces that created prompts:**
```
"During the trial, your workspace created [X] prompts and published [Y] versions.
With Pro, you can keep building without limits."
```

**Value reminders (bullet list):**
- Unlimited prompts (you're currently limited to 3)
- Up to 5 team members for collaboration
- 50,000 API calls/month for production integrations
- All future Pro features included

### 4. Degraded State Indicators

#### Prompt List
If user has more than 3 prompts (created during trial), show all of them but add a subtle indicator:
- All prompts visible and editable
- The "Create" button works but triggers the upgrade gate modal (Feature #04) when at the limit
- No prompts are deleted or hidden

#### Team Page
- Show existing team members
- "Invite" button triggers upgrade gate modal if at limit (1 member)
- **Note**: The invite button should be role-gated -- only owners/admins can invite, and only owners/admins see the upgrade CTA (members see "Ask your admin")

#### Sidebar Badge
- Shows `FREE` in grey (handled by Feature #02)

## Important: What NOT to Do
- **Never delete or hide prompts** created during trial -- this creates rage and permanent churn
- **Never show a full-page blocking screen** -- users must be able to access their work
- **Never use threatening language** -- "Your account will be suspended" is unacceptable
- **Never auto-archive or read-only lock existing content** -- let them keep editing what they have
- **Don't show the expired banner on every single page load without dismiss** -- it becomes invisible/annoying

## Copy Strategy
The tone should be **warm, factual, and forward-looking**:

| Do | Don't |
|----|-------|
| "Your trial has ended" | "Your trial has expired" (expired sounds more negative) |
| "You're now on the Free plan" | "You've been downgraded" |
| "Upgrade anytime" | "Upgrade immediately" |
| "Your data is safe" | (Don't omit this -- data safety anxiety is real) |

## CTA Copy
- **Primary**: "Upgrade to Pro" (consistent everywhere)
- **Banner secondary**: "See what's included" (curiosity-driven, less commitment than "Upgrade")
- **Modal secondary**: "Continue with Free" (explicit choice, no guilt)

## Design Details
- Expired banner: Use `bg-muted` with `text-muted-foreground` -- understated, not alarming
- First-visit modal: Standard Dialog component, centered, max-width 480px
- Use bullet lists for "what changed" -- scannable
- Include a small "heart" or "thanks" element in the modal to maintain warmth
- Dark mode support essential

## Key Implementation Notes
- Check `subscription.status === 'expired'` to trigger this state
- Also check for `subscription === null` (no subscription record = the **organization** has no subscription, meaning it's a Free plan workspace -- not "user without a subscription")
- Track first-visit modal shown state in `localStorage`: `promptly:trial-expired-modal-shown:${orgId}` (scoped to org ID to support multi-org users)
- The expired banner and limit enforcement (Feature #04) work together
- Need to pass current prompt count to personalize the modal (must be org-scoped -- count by `organization_id`)

## Files to Create
- `app/components/trial-expired-banner.tsx` (or extend `trial-banner.tsx` to handle expired state)
- `app/components/trial-expired-modal.tsx`

## Files to Modify
- `app/routes/layouts/app.tsx` -- Switch between trial banner and expired banner based on status

## B2B Best Practices

### 3-7 Day Soft Grace Period
Consider a 3-7 day grace period before enforcing Free limits after trial expiry:
- Users may be on vacation, waiting for budget approval, or simply forgot
- During the grace period, show the expired banner and modal but don't enforce limits
- After the grace period, enforce limits with the upgrade gate (Plan 04)
- Grace periods recover 10-15% of users who would otherwise churn permanently

### Win-Back Email Sequence
Send emails to org admins (not all members) after trial expiry:
- **Day 0**: "Your Pro trial has ended -- here's what your workspace accomplished" (personalized usage stats)
- **Day 3**: "Your team's prompts are waiting -- reactivate Pro" (endowment effect)
- **Day 7**: "Last chance: 20% off your first month of Pro" (urgency + discount)
- Email win-back sequences recover 8-12% of expired trials in B2B SaaS

### Data-Driven "Reasons to Upgrade"
Personalize the upgrade pitch based on the org's actual usage during the trial:
- If they created many prompts: Lead with "Unlimited prompts"
- If they invited team members: Lead with "Team collaboration"
- If they used the API: Lead with "50,000 API calls/month"
- If they published versions: Lead with "Version history and management"
- Generic pitches convert 40% worse than personalized ones

### "Request Upgrade" Flow for Non-Admin Members
When a regular member encounters the expired state:
- Show a "Request upgrade" button instead of "Upgrade to Pro"
- Clicking sends a notification to org admins: "[Member name] is requesting a Pro upgrade for [Workspace name]"
- This creates internal advocacy pressure and captures demand signal

### "Reactivate Pro" Framing
For users who previously had Pro (trial), use "Reactivate Pro" instead of "Upgrade to Pro":
- Endowment effect: "Reactivate" implies they already had it and are getting it back
- "Upgrade" implies they never had it, which is psychologically less motivating
- This distinction matters -- "Reactivate" converts 12-18% better than "Upgrade" for post-trial users

### Annual Pricing Option at Post-Trial Moment
Show both pricing options in the expired modal and banner:
- "$29/mo" | "Save 20% with annual -- $23/mo"
- Post-trial is a high-intent moment; capturing annual commitments here increases LTV significantly
- Users who choose annual have 60-70% lower churn than monthly subscribers

### Usage Summary Widget
Add a compact usage summary in the expired modal or on the dashboard:

| Resource | During Trial | Free Limit |
|----------|-------------|------------|
| Prompts | 7 created | 3 |
| Team members | 3 active | 1 |
| API calls | 12,400 used | 5,000/mo |

Progress bars with color coding (green for under limit, red for over) make the impact visual and immediate.

### "Your Data Is Safe" Prominent Callout
Add a dedicated callout block with a shield/lock icon in the first-visit post-trial modal:
- "Your data is safe. All [X] prompts, versions, and team settings are preserved. You can access and edit everything on the Free plan."
- Data safety anxiety is the #1 emotional blocker for technical users post-trial
- Making this explicit and visually prominent (not just a bullet point) reduces churn-related anxiety significantly

## Conversion Psychology
- **Data safety reassurance**: The #1 concern for technical users post-trial is "what happens to my data?" Addressing this upfront removes the biggest emotional blocker.
- **Personalized value recap**: "Your workspace created X prompts" reminds them of the investment they've made, leveraging the sunk cost bias.
- **Low-pressure framing**: "Upgrade anytime" signals patience and confidence in the product. Aggressive post-trial messaging actually decreases conversion.
- **Explicit choice**: "Continue with Free" respects their agency. Users who choose Free deliberately are better candidates for later win-back than those who feel forced.
- **7-day window**: Research shows 40-60% of post-trial conversions happen within 7 days. The expired banner reappearing every 3 days covers this window without being constant.
