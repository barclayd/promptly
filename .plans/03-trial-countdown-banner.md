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
- **Copy**: `Your workspace has X days left on your Pro trial.`
- **CTA (admins/owners)**: `Learn more` (links to billing page)
- **CTA (regular members)**: `Learn more` (links to billing page, read-only view)
- **Dismissible**: Yes (dismiss for session, reappears next visit)
- **Rationale**: Awareness only -- users are still exploring the product. Don't push.

#### Phase 2: Warning (Days 7-3)
- **Shown**: Second week of trial
- **Style**: Amber/yellow background, slightly taller (44px)
- **Copy**: `Your workspace's Pro trial ends in X days. Upgrade to keep unlimited prompts.`
- **CTA (admins/owners)**: `Upgrade to Pro` (primary button style)
- **CTA (regular members)**: `Request upgrade` (sends notification to org admin)
- **Dismissible**: Yes (reappears next session)
- **Rationale**: User has had time to experience value. Start making the loss tangible.

#### Phase 3: Urgent (Days 2-0)
- **Shown**: Final 48 hours
- **Style**: Red/destructive background (44px)
- **Copy variants**:
  - 2 days: `Your workspace's trial ends in 2 days. Your workspace will move to the Free plan with 3 prompts and 1 team member.`
  - 1 day: `Your workspace's trial ends tomorrow. Your workspace will move to the Free plan.`
  - Last day: `Your workspace's Pro trial ends today.`
- **CTA (admins/owners)**: `Upgrade to Pro`
- **CTA (regular members)**: `Ask your admin to upgrade` (sends notification to org admin)
- **Dismissible**: No
- **Rationale**: Maximum urgency. Loss framing with specific consequences.

### When NOT to Show
- Organization has `status: 'active'` (already paid)
- Organization has `status: 'expired'` (show Feature #07 banner instead)
- Organization has `status: 'canceled'` with `cancelAtPeriodEnd: true` (show Feature #11 banner instead)
- Organization has no subscription record (this can happen if the org was created before Stripe integration or in edge cases -- treat as free plan, do not show trial banner)

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

> **Important -- org-scoped dismiss keys**: All dismiss state keys stored in `sessionStorage` or `localStorage` must include the `${orgId}` as a suffix (e.g., `trial-banner-dismissed-${orgId}`). Users who belong to multiple orgs must see the banner independently per workspace.

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

## CRITICAL: Role-Based CTA Visibility

The banner CTA **must** adapt based on the current user's role within the organization:

| Role | Phase 1 CTA | Phase 2 CTA | Phase 3 CTA |
|------|-------------|-------------|-------------|
| Owner/Admin | `Learn more` | `Upgrade to Pro` | `Upgrade to Pro` |
| Member | `Learn more` | `Request upgrade` | `Ask your admin to upgrade` |

Use the `useCanManageBilling()` hook (shared with all billing UI) to determine which variant to render. The "Request upgrade" flow should send a notification (in-app or email) to the org owner/admin, creating bottom-up conversion pressure within teams.

## Conversion Research
- Countdown banners with specific dates/days convert 9% better than vague "ending soon" messaging
- Loss-framed copy ("You'll move to Free") converts 21% better than gain-framed ("Upgrade for more features")
- 3-phase escalation prevents banner fatigue while maintaining urgency when it matters
- Non-dismissible banners in the final 48 hours increase conversion by ~15% vs always-dismissible

## B2B Best Practices
- **"Request Upgrade" flow for non-admin members**: This is critical for B2B conversion. Team members who hit friction points should be able to signal the need to their admin with a single click. This creates organic bottom-up conversion pressure that is far more effective than top-down marketing.
- **Personalized value metrics in banner copy**: Where possible, enrich banner copy with real usage data: "Your team created 24 prompts this week -- upgrade to keep them all." This reinforces the value already realized and makes the loss more tangible.
- **Discount/incentive in Phase 3**: Consider offering a limited-time discount in the final-day Phase 3 banner for admin users (e.g., "Upgrade today and get 20% off your first month"). This creates a secondary urgency mechanism beyond just the trial ending.
- **Hybrid behavioral + calendar triggers**: The 3-phase model is calendar-based. Layer in behavioral triggers too -- e.g., if the org hits 3/3 prompts used during Phase 1, escalate to Phase 2 copy early. Behavioral friction is a stronger conversion signal than time alone.
- **Expandable "what you'll lose" comparison in Phase 3**: Add an expandable section or tooltip in Phase 3 that shows a brief comparison of what the org currently has on Pro vs. what they'll have on Free. Concrete comparisons outperform vague statements.
- **Email complement**: Reference a companion email plan for org admins (trial mid-point summary, 3-day warning, expiry notification). In-app banners are seen only by active users; admins who haven't logged in recently need email nudges.
