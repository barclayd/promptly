# Promptly Trial & Subscription UI -- Implementation Overview

## Feature Index

Each feature below has its own detailed plan file. Implement in the listed priority order -- earlier features provide infrastructure that later ones depend on.

| # | Feature | File | Priority | Effort | Dependencies |
|---|---------|------|----------|--------|-------------|
| 01 | Subscription Data in Root Loader | `01-subscription-root-loader.md` | P0 | Low | None (foundation for everything else) |
| 02 | Trial Mode Badge (Sidebar) | `02-trial-mode-badge.md` | P0 | Low | #01 |
| 03 | Trial Countdown Banner | `03-trial-countdown-banner.md` | P0 | Medium | #01 |
| 04 | Plan Limit Enforcement & Upgrade Gate | `04-plan-limit-enforcement.md` | P0 | Medium | #01 |
| 05 | Mid-Trial Engagement Nudge | `05-mid-trial-engagement-nudge.md` | P1 | Low | #01, #02 |
| 06 | Trial Expiry Warning Sequence | `06-trial-expiry-warnings.md` | P1 | Medium | #01, #03 |
| 07 | Trial Ended / Expired State | `07-trial-ended-state.md` | P0 | Medium | #01, #03, #04 |
| 08 | Upgrade Success Celebration | `08-upgrade-success-celebration.md` | P1 | Low | #01 |
| 09 | Billing & Plan Management Page | `09-billing-page.md` | P0 | High | #01 |
| 10 | Usage Dashboard | `10-usage-dashboard.md` | P1 | Medium | #01, #09 |
| 11 | Subscription Cancelled State | `11-subscription-cancelled.md` | P1 | Low | #01, #09 |
| 12 | Cancellation Flow | `12-cancellation-flow.md` | P1 | Medium | #09 |
| 13 | Enterprise Upgrade Path | `13-enterprise-upgrade.md` | P2 | Low | #09 |
| 14 | Dunning / Failed Payment | `14-dunning-failed-payment.md` | P1 | Low | #01, #03 |
| 15 | Post-Trial Win-Back | `15-post-trial-winback.md` | P2 | Medium | #07 |

## Architecture Notes

### Existing Backend (Already Done)
The `trial-stripe` plugin provides all API endpoints:
- `GET /api/auth/subscription/status` -- plan, status, isTrial, daysLeft, limits, cancelAtPeriodEnd
- `POST /api/auth/subscription/upgrade` -- creates Stripe Checkout session
- `POST /api/auth/subscription/cancel` -- sets cancel_at_period_end
- `POST /api/auth/subscription/portal` -- creates Stripe billing portal session
- `POST /api/auth/subscription/webhook` -- handles Stripe events

### Data Types Available
```typescript
interface SubscriptionStatus {
  plan: string;                    // 'free', 'pro'
  status: SubscriptionStatusValue; // 'trialing', 'active', 'canceled', 'expired', 'past_due'
  isTrial: boolean;
  daysLeft: number | null;
  limits: PlanLimits;              // { prompts: number, teamMembers: number, apiCalls: number }
  cancelAtPeriodEnd: boolean;
}
```

### Plan Limits (Per-Organization)

> **Note:** All plan limits are enforced **per-organization**, not per-user. Free plan limits (3 prompts, 1 team member, 5,000 API calls) apply to the workspace as a whole. Individual members share the org's quota.

```
Free:  3 prompts, 1 team member, 5,000 API calls
Pro:   Unlimited prompts (-1), 5 team members, 50,000 API calls
```

### Key Conversion Principles (from research)
1. **Behavioral triggers > calendar triggers** -- show upgrade prompts at the moment of friction, not on a schedule
2. **Loss framing in final days** -- shift from "look what you can do" to "here's what you'll lose"
3. **Be specific, not generic** -- "3 of 3 prompts used" beats "you've reached your limit"
4. **Developer audiences value transparency** -- factual consequences, not emotional pressure
5. **Always provide a next step** -- every modal/banner should have a clear CTA
6. **Never lock existing content** -- users must always be able to view/edit prompts they've already created. **Never lock existing organization content** -- all org members must retain access to prompts created while on a higher plan, even after downgrade.
7. **Role-aware CTAs** -- show upgrade CTAs to admins/owners with actionable buttons ("Upgrade to Pro"); show non-admin members informational messages with a "Request upgrade from admin" nudge instead of a direct upgrade button.

### Role-Based Billing Access
- **Status (read-only)**: All org members can view subscription status via `useSubscription()`
- **Upgrade/Cancel/Portal (mutations)**: Restricted to org owners and admins via `requireOrgAdmin()` in all billing-mutating endpoints
- **UI must adapt CTAs**: Admins see actionable buttons ("Upgrade to Pro"); regular members see informational messages ("Contact your workspace admin") or a "Request upgrade" flow that notifies the admin
- **`useCanManageBilling()` hook**: Shared hook for all billing UI components to determine CTA variant

### B2B Best Practices
- **Time to First Value (P0)**: Prioritize onboarding features that reduce time-to-first-value (e.g., guided prompt creation, template gallery). Users who hit an "aha moment" within the first 3 days convert at 3x the rate.
- **Behavioral triggers over calendar-based ones**: Trigger upgrade prompts when users hit limits, invite teammates, or create their Nth prompt -- not just when days tick down.
- **Social proof near upgrade prompts**: Include proof points near upgrade CTAs (e.g., "Trusted by X teams", "Y prompts managed on Pro this month") to reduce friction at the decision point.
