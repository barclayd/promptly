# 10: Usage Dashboard

## Summary
Visual display of current resource usage against plan limits. Shows progress bars for prompts, team members, and API calls. Color-coded to indicate when approaching limits. Includes inline upgrade CTAs when usage is high.

## Priority: P1

## Dependencies: #01 (Subscription Root Loader), #09 (Billing Page)

## Placement
Embedded within the billing section of the settings page (Feature #09), between the current plan card and the plan comparison section. Could also be displayed as a lightweight summary in the dashboard page.

## Component: `UsageOverview`

### Layout
Three usage meters in a responsive grid (3 columns desktop, stacked mobile):

```
+---------------------+  +---------------------+  +---------------------+
| Prompts             |  | Team Members        |  | API Calls           |
|                     |  |                     |  | (this month)        |
| [==========---] 2/3 |  | [=====---------] 1/5 |  | [===-----------]    |
| 67% used            |  | 20% used            |  | 1,250 / 5,000       |
|                     |  |                     |  | 25% used            |
+---------------------+  +---------------------+  +---------------------+
```

### Progress Bar Color Coding

| Usage % | Color | Meaning |
|---------|-------|---------|
| 0-59% | Green (`bg-emerald-500`) | Healthy |
| 60-79% | Amber (`bg-amber-500`) | Approaching limit |
| 80-99% | Red (`bg-red-500`) | Near limit |
| 100% | Red with pulse | At limit |

### Unlimited Display
For Pro users with unlimited prompts (`limits.prompts === -1`):
- Show "Unlimited" instead of a progress bar
- Small infinity icon or checkmark
- No percentage

### At-Limit State
When usage hits 100%:
- Progress bar is full and red
- Small inline text: "Upgrade for more" with a link
- For prompts: "3 of 3 used -- [Upgrade for unlimited]"

## Data Requirements
Current usage counts need to be fetched. Options:

### Option A: Add to billing page loader
Fetch counts in the settings page loader:
```sql
-- Prompt count
SELECT COUNT(*) FROM prompt WHERE organization_id = ? AND deleted_at IS NULL

-- Team member count
SELECT COUNT(*) FROM member WHERE organization_id = ?

-- API calls: May need a separate tracking mechanism or Stripe metered billing
```

### Option B: Add to subscription status endpoint
Extend the `GET /subscription/status` response to include current usage. This makes the data available everywhere via `useSubscription()`.

### Recommended: Option A for now
Keep usage fetching in the settings loader to avoid slowing down every page load. The usage data is primarily needed on the billing page.

### API Call Tracking
API call counts are the trickiest because they happen in a separate worker. Options:
1. Track in D1 (simple counter table per org per month)
2. Use Cloudflare Analytics Engine
3. Show "Coming soon" for API usage initially and implement tracking later

**Recommendation**: Start with prompts and team members only. Add API call tracking later.

## Design Details
- Use a `Card` component wrapper for the entire usage section
- Each meter is a horizontal flex: label, progress bar, count
- Progress bars use Tailwind's `bg-*` classes with `rounded-full`
- Bar height: 8px (thin and elegant)
- Bar background: `bg-muted` (grey track)
- Transitions: Smooth color transitions when usage changes
- Responsive: Stack vertically on mobile (single column)

## Key Implementation Notes
- Usage data is specific to the current organization (use `orgContext`)
- For prompts: only count non-deleted prompts (`deleted_at IS NULL`)
- For team members: count active members (not pending invitations)
- Update usage display when returning from prompt creation (revalidation handles this)
- Handle the unlimited case (`-1`) gracefully -- no progress bar, just "Unlimited"

## Files to Create
- `app/components/usage-overview.tsx`
- `app/components/usage-meter.tsx` (reusable progress bar with label)

## Files to Modify
- `app/routes/settings.tsx` -- Add usage data to loader, render UsageOverview in billing section

## Conversion Psychology
- **Visual salience**: A half-full progress bar is a constant reminder that limits exist, without any text needed
- **Color escalation**: Green->amber->red creates subconscious urgency as usage increases
- **Inline upgrade CTA**: Showing "Upgrade for unlimited" right next to the full bar is a contextual trigger at the moment of awareness
- **Transparency**: Showing exact numbers (2 of 3) builds trust. Users prefer honesty about limits over discovering them later.
