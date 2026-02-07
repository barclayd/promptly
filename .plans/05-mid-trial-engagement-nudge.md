# 05: Mid-Trial Engagement Nudge

## Summary
A contextual, one-time nudge shown when a user demonstrates engagement during their trial (e.g., after creating their 2nd prompt or running their 2nd test). Frames the upgrade as "make this permanent" rather than "pay before you lose it."

## Priority: P1

## Dependencies: #01 (Subscription Root Loader), #02 (Trial Badge)

## When to Show

### Behavioral Trigger (preferred over calendar-based)
Show the nudge when ALL conditions are met:
1. User is on `status: 'trialing'`
2. User has been on trial for at least 5 days (not in the first few days -- let them explore)
3. User has created 2+ prompts OR has published 1+ prompt version
4. The nudge has NOT been shown before (track in `localStorage`)

### Why This Trigger
- Research shows behavioral triggers convert 67% better than calendar-based ones
- A user who has created 2 prompts has experienced the core value proposition
- Showing the nudge after value realization (not before) feels helpful rather than pushy
- The "5 days minimum" prevents showing it too early when users are still forming opinions

## Component: `EngagementNudgeToast` or Inline Card

### Option A: Toast Notification (recommended)
A non-blocking toast that slides in from the bottom-right:

**Copy**: "You've created [X] prompts so far. Enjoying Pro? Upgrade to keep building without limits."
**CTA**: "Upgrade to Pro" (small button in the toast)
**Dismiss**: Auto-dismisses after 10 seconds, or user clicks X

### Option B: Inline Card in Sidebar
A small card shown in the sidebar below the navigation (above the subscription badge):

**Copy**: "Enjoying your Pro trial?"
**Subtext**: "You've created [X] prompts. Make it permanent."
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
- Show once, track in `localStorage` with key like `promptly:engagement-nudge-shown`
- If user dismisses, never show again for this trial period

## Key Implementation Notes
- Need to know the user's prompt count -- fetch from the existing prompts loader or add to subscription status
- Check `localStorage` before rendering
- The toast should not stack with other notifications
- Works in both light and dark modes

## Files to Create
- `app/components/engagement-nudge.tsx`

## Files to Modify
- `app/routes/layouts/app.tsx` or `app/routes/dashboard.tsx` -- Trigger the nudge check

## Conversion Psychology
- **Peak-end rule**: Showing the nudge after a positive experience (successful prompt creation) associates the upgrade with positive emotions
- **Endowment effect**: "Make it permanent" implies they already own it and just need to keep it
- **Reciprocity**: The product has given them value; the nudge is a gentle reminder that the value exchange should continue
- **Low pressure**: One-time, auto-dismissing, non-blocking -- respects the user's attention
