# 02: Trial Mode Badge (Sidebar)

## Summary
A persistent, always-visible badge in the sidebar showing the **organization's/workspace's** current plan status. This is the lowest-friction awareness mechanism -- users always know where their workspace stands without being interrupted.

## Priority: P0

## Dependencies: #01 (Subscription Root Loader)

## Placement
In the sidebar (`app/components/sidebar-left.tsx`), near the bottom -- between the NavSecondary links and the NavUser section. Clicking the badge navigates to the billing page.

### Why Sidebar Bottom
- Notion, Linear, and Slack all show plan badges near the workspace/org selector at the bottom of the sidebar
- It's always visible without taking valuable header real estate
- Doesn't interrupt workflow

## Component: `SubscriptionBadge`

### Visual States

| Status | Badge Text | Color | Icon |
|--------|-----------|-------|------|
| `trialing` (>7 days left) | `PRO TRIAL` | Amber/yellow pill | Sparkles icon |
| `trialing` (<=7 days left) | `TRIAL -- X days` | Amber pill | Clock icon |
| `trialing` (last day) | `TRIAL -- ends today` | Red pill | AlertTriangle icon |
| `active` | `PRO` | Brand indigo/purple pill | Check icon |
| `expired` / no subscription | `FREE` | Grey/neutral pill | None |
| `canceled` (until period end) | `PRO` (with "Cancels on [date]" subtext) | Grey pill | None |
| `past_due` | `PRO` (with "Payment issue" subtext) | Red pill | AlertTriangle icon |

### Interaction
- Clicking the badge navigates to `/settings` (billing tab)
- On hover: show a **role-aware tooltip**:
  - **Admins/owners**: "Pro Trial -- 7 days remaining. Click to manage plan."
  - **Regular members**: "Pro Trial -- 7 days remaining. Click to view plan details."
- Consider showing workspace name in tooltip for multi-org context (e.g., "Acme's Workspace -- Pro Trial")

### Design Details
- Use the existing `Badge` component from `app/components/ui/badge.tsx`
- Pill shape, small text (text-xs), compact padding
- Should look similar to Linear's plan badge -- subtle but readable
- In collapsed sidebar mode, show a small badge with icon that expands on hover (like Linear's collapsed sidebar plan indicator) rather than hiding entirely

## CTA Copy
- No CTA on the badge itself -- keep it informational
- The billing page (Feature #09) handles upgrade CTAs

## Key Implementation Notes
- Use `useSubscription()` hook to get current status
- Handle null subscription gracefully (show FREE badge)
- The badge should not cause layout shifts when status changes
- Animate badge color transitions smoothly (no sudden jumps)

## Files to Create
- `app/components/subscription-badge.tsx`

## Files to Modify
- `app/components/sidebar-left.tsx` -- Add SubscriptionBadge between NavSecondary and NavUser

## Conversion Psychology
- **Endowment effect**: Seeing "PRO TRIAL" reminds users they currently *have* Pro features, making the eventual loss more salient
- **Constant low-key awareness**: Unlike banners that get dismissed, the badge is always there without being annoying
- The amber color creates mild visual tension that resolves when they upgrade (badge turns to calm indigo/purple)

## B2B Best Practices
- **"Request upgrade" affordance for non-admin members**: When a non-admin clicks the badge, the billing page should show a "Request upgrade" button that sends a notification to the workspace admin. This creates bottom-up conversion pressure within teams.
- **Value-realized context in tooltip**: During trial, consider enriching the tooltip with usage data: "Pro Trial -- 7 days remaining. Your team has created 12 prompts this week." This reinforces the value being received and makes the prospect of losing it more concrete.
- **Progress/activation indicator during early trial**: In the first few days, the badge could subtly indicate activation progress (e.g., a small progress ring) to encourage feature exploration before the trial clock becomes the primary concern.
- **Badge animation on phase transition**: When `daysLeft` crosses a threshold (e.g., from >7 to <=7), add a brief attention-drawing animation (subtle pulse or color transition) to signal the change without being disruptive.
