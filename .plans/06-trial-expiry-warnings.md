# 06: Trial Expiry Warning Sequence (Final 5/2/1 Days)

## Summary
Escalating in-app warnings as the trial deadline approaches. These work in concert with the trial banner (Feature #03) but are more interruptive -- modal-based rather than banner-based -- to ensure users don't miss the deadline.

## Priority: P1

## Dependencies: #01 (Subscription Root Loader), #03 (Trial Banner)

## How This Differs from the Trial Banner
- **Banner** (Feature #03): Persistent, top-of-page, always visible, informational
- **Warning modals** (this feature): One-time per trigger, modal/dialog, action-oriented, shown at key moments

The banner provides constant awareness; the warnings provide decision prompts.

## Warning Triggers

### 5 Days Left
- **Trigger**: First page load after daysLeft transitions to <= 5
- **Type**: Soft modal (can be dismissed)
- **Title**: "Your trial ends in 5 days"
- **Body**: "You've been using Pro features like unlimited prompts and team collaboration. After your trial, you'll move to the Free plan.\n\n**Free plan includes:**\n- 3 prompts\n- 1 team member\n- 5,000 API calls/month"
- **Primary CTA**: "Upgrade to Pro -- $29/mo"
- **Secondary CTA**: "Remind me later" (shows again in 2 days)
- **Tertiary**: "View plan comparison" (links to billing page)

### 2 Days Left
- **Trigger**: First page load after daysLeft transitions to <= 2
- **Type**: Prominent modal (dismissible but reappears next session)
- **Title**: "Your Pro trial ends in 2 days"
- **Body**: "Here's what changes on [specific date]:\n\n- Prompts limited to 3 (you have [X] currently)\n- Team access limited to 1 member\n- API calls limited to 5,000/month\n\nYour existing prompts will remain accessible."
- **Primary CTA**: "Upgrade to Pro"
- **Secondary**: "I'll decide later"

### Last Day
- **Trigger**: First page load on the final day (daysLeft === 1 or 0)
- **Type**: Prominent modal (dismissible but reappears each session)
- **Title**: "Your trial ends today"
- **Body**: "After today, your workspace moves to the Free plan. Your [X] prompts will still be accessible, but you won't be able to create new ones beyond the Free limit.\n\nUpgrade now to keep everything."
- **Primary CTA**: "Upgrade to Pro"
- **Secondary**: "Continue to Free plan" (explicitly acknowledges their choice)

## Copy Strategy: Progressive Loss Framing

| Days | Framing | Tone |
|------|---------|------|
| 5 days | Informational | "Here's what your plan includes after trial" |
| 2 days | Specific consequences | "Here's what changes on [date]" with their actual data |
| Last day | Personal loss | "Your [X] prompts... you won't be able to create new ones" |

Research shows loss-framed messaging increases conversion by up to 32%. The key is to make the loss **personal and specific** -- reference their actual prompt count, team size, etc.

## Dismiss Tracking
Use `localStorage` with expiry:
```
promptly:trial-warning-5d-dismissed: timestamp
promptly:trial-warning-2d-dismissed: timestamp
promptly:trial-warning-1d-dismissed: timestamp (per session only)
```

- 5-day warning: Once dismissed, don't show until 2-day trigger
- 2-day warning: Dismissed per session (reappears next login)
- Last-day warning: Dismissed per session (reappears each login)

## Design Details
- Use the existing `Dialog` component
- Modals should have a clear visual hierarchy: title, consequence list, CTAs
- Use bullet points for the "what changes" list -- scannable
- Show the user's actual data where possible (prompt count, team member count)
- Both light and dark mode support
- On mobile, use bottom sheet pattern

## Key Implementation Notes
- Use `useSubscription()` for `daysLeft` and `limits`
- Fetch current prompt count to personalize the message
- Track shown/dismissed state in localStorage
- Only show one warning modal per page load (don't stack)
- Don't show if user is already on the billing/upgrade page (they're already considering it)
- Don't show if `status !== 'trialing'` (expired/active users see different UI)

## Files to Create
- `app/components/trial-expiry-modal.tsx`

## Files to Modify
- `app/routes/layouts/app.tsx` -- Add modal trigger logic

## Conversion Psychology
- **Zeigarnik effect**: The countdown creates an "open loop" that users feel compelled to close (either by upgrading or explicitly choosing not to)
- **Specificity**: "You have 7 prompts currently" is far more effective than "your prompts will be limited"
- **Reassurance**: "Your existing prompts will remain accessible" reduces the fear of data loss, which is a major blocker for technical users
- **Explicit choice**: Offering "Continue to Free plan" as the secondary CTA on the last day makes the decision feel deliberate, not accidental. Users who actively choose Free are less resentful than those who feel they "forgot to upgrade."
