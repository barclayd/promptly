# 07: Trial Ended / Expired State

## Summary
When a user's trial expires without upgrading, they should see a clear but non-hostile state that explains what changed, preserves access to their existing work, and makes upgrading easy. This is one of the most critical moments for conversion -- **40-60% of users who eventually convert do so within 7 days of trial expiry**.

## Priority: P0

## Dependencies: #01 (Subscription Root Loader), #03 (Trial Banner), #04 (Limit Enforcement)

## Core Principle: Graceful Degradation, Never Lockout
- Users MUST always be able to log in, view, and edit their existing prompts
- Users CAN'T create new prompts beyond the Free limit (3)
- Users CAN'T invite team members beyond the Free limit (1)
- The experience should feel like a gentle downgrade, not a punishment

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

  - Prompts: Limited to 3 (you created [X] during your trial)
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

**For users who created prompts:**
```
"During your trial, you created [X] prompts and published [Y] versions.
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
- Also check for `subscription === null` (no subscription record = Free plan user)
- Track first-visit modal shown state in `localStorage`: `promptly:trial-expired-modal-shown`
- The expired banner and limit enforcement (Feature #04) work together
- Need to pass current prompt count to personalize the modal

## Files to Create
- `app/components/trial-expired-banner.tsx` (or extend `trial-banner.tsx` to handle expired state)
- `app/components/trial-expired-modal.tsx`

## Files to Modify
- `app/routes/layouts/app.tsx` -- Switch between trial banner and expired banner based on status

## Conversion Psychology
- **Data safety reassurance**: The #1 concern for technical users post-trial is "what happens to my data?" Addressing this upfront removes the biggest emotional blocker.
- **Personalized value recap**: "You created X prompts" reminds them of the investment they've made, leveraging the sunk cost bias.
- **Low-pressure framing**: "Upgrade anytime" signals patience and confidence in the product. Aggressive post-trial messaging actually decreases conversion.
- **Explicit choice**: "Continue with Free" respects their agency. Users who choose Free deliberately are better candidates for later win-back than those who feel forced.
- **7-day window**: Research shows 40-60% of post-trial conversions happen within 7 days. The expired banner reappearing every 3 days covers this window without being constant.
