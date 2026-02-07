# 03: Trial Countdown Banner

## Summary
A persistent top-of-content banner that escalates in urgency as the trial expiry approaches. This is the primary in-app mechanism for driving trial-to-paid conversion.

## Priority: P0

## Dependencies: #01 (Subscription Root Loader)

## Placement
At the top of the main content area, inside `SidebarInset` in the app layout (`app/routes/layouts/app.tsx`), above the `SiteHeader`. Full-width, slim height.

### Why Above SiteHeader
- Consistent with HubSpot, Jobber, Notion patterns
- Doesn't push sidebar content, only main content
- Visible on every page without modifying individual routes

## Component: `TrialBanner`

### 3-Phase Escalation Model

Research shows a 3-phase approach maximizes conversion while maintaining trust:

#### Phase 1: Calm (Days 14-8)
- **Shown**: Only during the first week of trial
- **Style**: Subtle blue/neutral background, thin (36px height)
- **Copy**: `You have X days left on your Pro trial.`
- **CTA**: `Learn more` (links to billing page)
- **Dismissible**: Yes (dismiss for session, reappears next visit)
- **Rationale**: Awareness only -- users are still exploring the product. Don't push.

#### Phase 2: Warning (Days 7-3)
- **Shown**: Second week of trial
- **Style**: Amber/yellow background, slightly taller (44px)
- **Copy**: `Your Pro trial ends in X days. Upgrade to keep unlimited prompts.`
- **CTA**: `Upgrade to Pro` (primary button style)
- **Dismissible**: Yes (reappears next session)
- **Rationale**: User has had time to experience value. Start making the loss tangible.

#### Phase 3: Urgent (Days 2-0)
- **Shown**: Final 48 hours
- **Style**: Red/destructive background (44px)
- **Copy variants**:
  - 2 days: `Your trial ends in 2 days. You'll move to the Free plan with 3 prompts and 1 team member.`
  - 1 day: `Your trial ends tomorrow. Your team will move to the Free plan.`
  - Last day: `Your Pro trial ends today.`
- **CTA**: `Upgrade to Pro`
- **Dismissible**: No
- **Rationale**: Maximum urgency. Loss framing with specific consequences.

### When NOT to Show
- User has `status: 'active'` (already paid)
- User has `status: 'expired'` (show Feature #07 banner instead)
- User has `status: 'canceled'` with `cancelAtPeriodEnd: true` (show Feature #11 banner instead)
- User has no subscription (invited user on someone else's plan)

## CTA Copy Rationale
- **"Upgrade to Pro"** is the clearest, most tested CTA across developer tools (Vercel, Linear, Supabase all use it)
- Avoid "Upgrade now" -- the "now" adds unnecessary pressure and tests show no conversion improvement
- Avoid "Don't lose access" -- too negative/threatening for developer audiences
- Use specific consequences ("3 prompts and 1 team member") rather than vague ("limited features")

## Design Details
- Use existing Tailwind colors: `bg-blue-50/dark:bg-blue-950` (calm), `bg-amber-50/dark:bg-amber-950` (warning), `bg-destructive/10` (urgent)
- Text centered, CTA button right-aligned
- Close/dismiss button (X) on right side (phases 1 & 2 only)
- Banner should animate in with a subtle slide-down on first appearance
- Store dismissal state in `sessionStorage` (phase 1 & 2) so it reappears on new sessions

## Dismiss Logic
```
Phase 1 (calm): Dismiss persists for current session (sessionStorage)
Phase 2 (warning): Dismiss persists for current session, reappears next session
Phase 3 (urgent): Not dismissible
```

## Key Implementation Notes
- Use `useSubscription()` hook
- Calculate phase from `daysLeft` value
- Banner should work in both light and dark modes -- test both
- On mobile, stack copy and CTA vertically to avoid overflow
- Use `@tabler/icons-react` for any icons (close button, etc.)

## Files to Create
- `app/components/trial-banner.tsx`

## Files to Modify
- `app/routes/layouts/app.tsx` -- Add `<TrialBanner />` above `<SiteHeader />`

## Conversion Research
- Countdown banners with specific dates/days convert 9% better than vague "ending soon" messaging
- Loss-framed copy ("You'll move to Free") converts 21% better than gain-framed ("Upgrade for more features")
- 3-phase escalation prevents banner fatigue while maintaining urgency when it matters
- Non-dismissible banners in the final 48 hours increase conversion by ~15% vs always-dismissible
