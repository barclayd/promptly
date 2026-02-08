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
- Small inline text with role-aware CTA:
  - **Admin/Owner**: "Upgrade for more" with a clickable link to the upgrade flow
  - **Member**: "Contact your workspace admin to upgrade" (no link, informational only)
- For prompts (admin): "3 of 3 used -- [Upgrade for unlimited]"
- For prompts (member): "3 of 3 used -- Contact your workspace admin to upgrade"

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
- For team members: count active members (not pending invitations). Note that the member count **includes the owner** -- Better Auth's `member` table includes the org creator with role `owner`.
- Update usage display when returning from prompt creation (revalidation handles this)
- Handle the unlimited case (`-1`) gracefully -- no progress bar, just "Unlimited"
- `periodEnd` needs to be added to the `SubscriptionStatus` type to support "Resets on [date]" display next to API call meters. This is the same `periodEnd` needed by Feature #11.

## Files to Create
- `app/components/usage-overview.tsx`
- `app/components/usage-meter.tsx` (reusable progress bar with label)

## Files to Modify
- `app/routes/settings.tsx` -- Add usage data to loader, render UsageOverview in billing section

## B2B Best Practices

### Role-Aware Usage Display
- **Admin/Owner**: Sees upgrade CTAs at limit ("Upgrade for unlimited"), manage links, and full control messaging
- **Member**: Sees "Managed by [Admin Name]" or "Contact your workspace admin to upgrade" instead of action CTAs
- This prevents confusion where a member clicks "Upgrade" and discovers they lack permission

### Threshold Alerts
- One-time in-app notification (toast) for admins/owners when any usage metric reaches 80%
- Example: "Heads up: Your workspace has used 80% of its API call limit this month"
- Store alert state per metric per period to avoid repeat notifications (e.g., `usageAlert:apiCalls:2026-02` in localStorage or DB)
- Only show to admins/owners -- members don't need to worry about limits they can't change

### Smart Usage Framing
Instead of just showing numbers, add contextual framing:
- "3 of 3 prompts used. Upgrade to create unlimited prompts for your team."
- "1 of 1 team member. Upgrade to invite up to 5 collaborators."
- Contextual framing converts better than raw numbers because it makes the upgrade benefit tangible

### Lightweight Dashboard Widget
Add a compact usage summary widget on the main dashboard page (not just buried in settings):
- Shows mini progress bars for each metric in a small card
- "View details" link to full usage in settings
- This keeps usage awareness high without requiring users to navigate to settings

### Empty State for API Calls
When API calls show 0 usage:
- Display: "0 / 5,000 -- Set up the SDK to start using prompts via API"
- Link to API key setup or documentation
- This turns a zero-state into an activation opportunity

### Period Reset Date
Show when the current billing period resets next to metered resources:
- "1,247 / 5,000 API calls -- Resets Feb 28"
- Requires `periodEnd` from `SubscriptionStatus` (see Key Implementation Notes)
- Helps users understand whether they need to upgrade or can wait for the reset

## Conversion Psychology
- **Visual salience**: A half-full progress bar is a constant reminder that limits exist, without any text needed
- **Color escalation**: Green->amber->red creates subconscious urgency as usage increases
- **Inline upgrade CTA**: Showing "Upgrade for unlimited" right next to the full bar is a contextual trigger at the moment of awareness
- **Transparency**: Showing exact numbers (2 of 3) builds trust. Users prefer honesty about limits over discovering them later.
