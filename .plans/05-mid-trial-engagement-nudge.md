# 05: Mid-Trial Engagement Nudge

## Summary
A contextual, one-time nudge shown when a user demonstrates engagement during their trial (e.g., after creating their 2nd prompt or running their 2nd test). Frames the upgrade as "make this permanent" rather than "pay before you lose it."

## Priority: P1

## Dependencies: #01 (Subscription Root Loader), #02 (Trial Badge)

## When to Show

### Behavioral Trigger (preferred over calendar-based)
Show the nudge when ALL conditions are met:
1. Organization is on `status: 'trialing'`
2. Organization has been on trial for at least 5 days (not in the first few days -- let them explore)
3. Organization has 2+ prompts OR has published 1+ prompt version
4. The nudge has NOT been shown before (track in `localStorage`)

### Why This Trigger
- Research shows behavioral triggers convert 67% better than calendar-based ones
- An organization that has created 2 prompts has experienced the core value proposition
- Showing the nudge after value realization (not before) feels helpful rather than pushy
- The "5 days minimum" prevents showing it too early when users are still forming opinions

## Component: `EngagementNudgeToast` or Inline Card

### Option A: Toast Notification (recommended)
A non-blocking toast that slides in from the bottom-right:

**Copy**: "Your workspace has [X] prompts so far. Enjoying Pro? Upgrade to keep building without limits."
**CTA**: "Upgrade to Pro" (small button in the toast)
**Dismiss**: Auto-dismisses after 10 seconds, or user clicks X

### Option B: Inline Card in Sidebar
A small card shown in the sidebar below the navigation (above the subscription badge):

**Copy**: "Enjoying your Pro trial?"
**Subtext**: "Your workspace has [X] prompts. Make it permanent."
**CTA**: "Upgrade" (small link)
**Dismiss**: X button, stores dismissal in localStorage

### Recommended: Option A (Toast)
- Less visual clutter in the sidebar
- Feels more like a timely, contextual message than a permanent fixture
- Easier to implement without modifying sidebar layout

## CTA Copy
- **"Upgrade to Pro"** -- Consistent with the language used everywhere else
- **"Make it permanent"** -- Subtly implies they already *have* Pro (endowment effect)
- Avoid "Don't lose your progress" -- too early for loss framing, user still has days left

## Design Details
- Use or extend the existing toast/notification pattern in the app
- Brief, compact -- max 2 lines of text + 1 CTA button
- Warm/positive tone, not urgent
- Show once, track in `localStorage` with key like `promptly:engagement-nudge-shown:${orgId}`
- If user dismisses, never show again for this trial period

## Key Implementation Notes
- Need to know the organization's prompt count -- fetch from the existing prompts loader or add to subscription status
- Check `localStorage` before rendering (key must be scoped to `${orgId}`)
- The toast should not stack with other notifications
- Works in both light and dark modes

## Files to Create
- `app/components/engagement-nudge.tsx`

## Files to Modify
- `app/routes/layouts/app.tsx` or `app/routes/dashboard.tsx` -- Trigger the nudge check

## Role-Based Nudge Targeting

Not all users within an organization should see the same nudge:

- **Owners/Admins**: Full nudge with "Upgrade to Pro" CTA (they have billing authority)
- **Regular Members**: Either show an informational version without the upgrade CTA ("Your workspace is on a Pro trial -- [X] prompts and counting!"), or don't show the nudge at all
- Rationale: Showing a regular member an "Upgrade" button they can't act on creates frustration. Either make it actionable ("Ask your admin to upgrade") or skip it.
- The user's org role should be available from the root loader (prerequisite from Plan 01 follow-ups)

## B2B Best Practices

### Multi-Channel Nudge
Don't rely solely on in-app nudges. Complement with email to org admins:
- In-app toast for the active user (if owner/admin)
- Email to org admins with usage stats and upgrade CTA
- Multi-channel nudges convert 2-3x better than single-channel

### Segment by Activation Depth
Instead of a simple "2+ prompts" check, consider a weighted activation score:
- Prompts created (weight: 1)
- Prompt versions published (weight: 2)
- Team members invited (weight: 3)
- API keys created / API calls made (weight: 2)
- A composite score captures deeper engagement and targets nudges more precisely

### Personalize Copy Based on Specific Achievement
Instead of generic "Your workspace has [X] prompts", personalize to their latest milestone:
- "Your team published their first prompt version -- nice!"
- "You just invited a second team member. Your workspace is growing."
- Milestone-specific copy feels like a celebration, not a sales pitch

### Lower Minimum Trigger Threshold
Consider lowering from 5 days to 3 days, or switch to a pure behavioral trigger:
- If the org has created 2+ prompts and published 1+ version, they've demonstrated activation regardless of calendar time
- Calendar-based minimums can miss power users who activate quickly

### "What Happens Next" Element
Add a brief, factual loss-framing line:
- "Your trial ends in [X] days. After that, your workspace moves to the Free plan (3 prompts, 1 member)."
- Keep it informational at this stage -- save the heavy loss framing for Plan 06

### Soft Dismiss vs Permanent Dismiss
Instead of permanently dismissing after one showing:
- "Remind me later" dismisses for 3 days, then retries once
- Hard dismiss (X button) permanently hides for this trial period
- This gives a second chance to convert without being annoying

### Consider A/B Testing Toast vs Inline Sidebar Card
Both approaches have merit:
- Toast: Higher visibility, more interruptive, better for one-time messages
- Inline sidebar card: Persistent visibility, less interruptive, better for ongoing awareness
- If possible, A/B test both and measure click-through rate on the upgrade CTA

## Conversion Psychology
- **Peak-end rule**: Showing the nudge after a positive experience (successful prompt creation) associates the upgrade with positive emotions
- **Endowment effect**: "Make it permanent" implies they already own it and just need to keep it
- **Reciprocity**: The product has given them value; the nudge is a gentle reminder that the value exchange should continue
- **Low pressure**: One-time, auto-dismissing, non-blocking -- respects the user's attention
