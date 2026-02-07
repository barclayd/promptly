# Additional Features Identified During Research

These are features that weren't in the original list but came up as high-impact during research. They're worth considering as future additions.

## A. Onboarding Checklist / Progress Bar
**Impact**: High (3x more likely to convert)
**Effort**: High

A sidebar widget shown during the first 7 days of trial with 4-5 steps:
1. ~~Create your first prompt~~ (see Pre-Populated Prompt below)
2. Add variables to a prompt
3. Run a test
4. Invite a team member
5. Generate an SDK snippet

Research shows starting the progress bar at 20% (1 step already done -- "Account created") leverages the Zeigarnik effect. Users who complete onboarding checklists are 3x more likely to convert.

**Why it matters**: Time-to-value is the #1 predictor of trial conversion. If users hit the "aha moment" within 5 minutes, conversion rates roughly double.

> **Org-Level Tracking**: The checklist should be per-organization, visible to admins. Store progress server-side (in a `onboarding_progress` table or as JSON on the org record) so that progress persists across devices and is shared across team members. Starting state should be "Account created + Workspace set up" (2 steps = 40% complete for a 5-step checklist).
>
> **Step Order**: Move "Invite a team member" to step 3 or 4 (not last). Getting a second person into the workspace early creates social commitment and makes the tool stickier.

## B. Approaching-Limit Warning Toast
**Impact**: Medium
**Effort**: Low

A one-time toast notification when usage hits 80% of a limit:
- "You've used 2 of 3 prompts. You have 1 remaining on the Free plan."
- Non-blocking, auto-dismissing after 8 seconds
- Triggers once per billing period per resource

Prevents the jarring experience of hitting a hard wall with no warning.

> **Role-Aware CTA**: The upgrade CTA in the toast should only appear for owners/admins. Regular members should see: "Your workspace is approaching its prompt limit. Contact your workspace admin."
>
> **Server-Side Tracking**: Track limit warnings per-org server-side (not per-user localStorage). This prevents the same org from missing warnings because different members trigger different thresholds, and ensures the warning state is consistent across the team.
>
> **Progressive Disclosure**: Consider a 3-tier warning system instead of a single toast:
> 1. **60%**: Subtle sidebar counter (e.g., "2/3 prompts used")
> 2. **80%**: Toast notification (current design)
> 3. **100%**: Gate modal preventing the action with upgrade CTA

## C. Annual Billing Toggle
**Impact**: High (increases LTV significantly)
**Effort**: Medium

Add a monthly/annual toggle to the plan comparison (Feature #09):
- Show annual savings: "Save 20%" or "$58/year"
- Default to annual (higher LTV, lower displayed monthly price)
- Requires creating an annual price in Stripe

Standard practice: 77% of high-growth SaaS companies offer annual billing.

> **Role Gating**: The billing toggle should only be interactive for owners/admins. Regular members can see the pricing comparison but cannot change the billing interval.
>
> **Display Best Practice**: Default the toggle to annual, and show the monthly equivalent with savings highlighted: "$23/mo (billed annually) -- Save $72/year" vs "$29/mo (billed monthly)". The monthly equivalent makes the annual price feel comparable while the savings create urgency.

## D. Pre-Populated Example Prompt (Onboarding)
**Impact**: Very High (reduces time-to-value)
**Effort**: Medium

When a new organization is created, pre-populate the workspace with an example prompt that demonstrates variables, testing, and SDK integration. This lets users experience the full value proposition in under 2 minutes without creating anything from scratch.

Notion, Canva, and Figma all do this -- new users see a pre-populated workspace, not an empty dashboard.

> **Create on Org Creation, Not Login**: The example prompt should be created when the organization is first created (in the signup action or org creation hook), not on first login. This avoids duplication for invited members joining an existing org -- they should see the org's existing prompts, not get a second example prompt.
>
> **Priority**: This feature should be prioritized above the Onboarding Checklist (Feature A). A pre-populated prompt delivers immediate "speed to first value" -- users can explore, edit, and test within seconds. The checklist is a guide; the example prompt is the experience itself.

## E. Upgrade Prompt After Successful Action
**Impact**: High (2.3x better than time-based)
**Effort**: Low

After a user successfully runs a prompt test or publishes a version, show a brief, non-blocking toast:
- **Owners/Admins**: "Nice work! With Pro, you can run unlimited tests and publish unlimited versions." + upgrade CTA
- **Regular members**: "Nice work! Your workspace is on the Free plan." (no upgrade CTA -- they can't make the purchase decision)
- Auto-dismisses after 6 seconds
- Shows once per action type, tracked in localStorage

This is the "peak moment" pattern -- upgrade prompts shown after positive experiences convert 2.3x better than time-based prompts.

## F. Feature-Locked Indicators in Navigation
**Impact**: Medium
**Effort**: Low

Small "Pro" badges next to navigation items or features that require Pro:
- Subtle lock or crown icon next to premium features in menus
- On hover: "Available on Pro plan"
- Click: opens upgrade gate modal

This builds awareness of premium features over time without being intrusive. Users gradually learn what's available if they upgrade.

> **Role-Aware Gate Modal**: The upgrade gate modal CTA should be role-aware:
> - **Owners/Admins**: "Upgrade to Pro" button that initiates the checkout flow
> - **Regular members**: "This feature requires Pro. Ask your workspace admin about upgrading." with no checkout CTA

## G. Personalized Trial Summary Email (Day 7)
**Impact**: High
**Effort**: Medium (requires email service)

A mid-trial email showing what the organization has accomplished (org-level aggregate metrics):
- "Your workspace has created [X] prompts and run [Y] tests this week"
- "[Z] team members are active in your workspace"
- Comparison to average usage (social proof)
- Highlight features they haven't tried yet
- No hard sell -- just value reinforcement

Grammarly's weekly "Writing Update" emails use this pattern to great effect.

> **Recipient**: Send to the org owner, not to every member. The owner is the decision-maker for the subscription.
>
> **Shareable Report Link**: Include a link to a shareable report page (or a static summary URL) that the org owner can forward internally. This helps internal champions build the case for upgrading with stakeholders who aren't using the product directly.

## H. "Compare Plans" Inline Component
**Impact**: Medium
**Effort**: Low

A small, embeddable "Compare Free vs Pro" component that can be shown in various contexts:
- At the bottom of the trial expiry modal
- On the billing page
- In the upgrade gate modal as a "See full comparison" expandable

Avoids duplicating plan comparison logic and keeps messaging consistent.

> **Role-Aware CTA**: The upgrade CTA within the compare plans component should be role-aware (admin sees "Upgrade to Pro," member sees "Ask your workspace admin").

---

## B2B Best Practices (Cross-Cutting)

### Prioritize Pre-Populated Prompt (D) Above Onboarding Checklist (A)
The pre-populated example prompt delivers immediate value -- users can explore, edit, and test within seconds of signing up. The onboarding checklist is a guide to help them build their own content. Implementing D first means users hit the "aha moment" faster, and the checklist (A) can then reference and build on the example prompt ("Edit the example prompt" as step 1 instead of "Create your first prompt").

### Add "Workspace Usage Dashboard" Feature
Consider adding a dedicated usage dashboard visible to admins showing:
- Current usage vs limits (prompts, members, API calls)
- Usage trends over time (daily/weekly charts)
- Per-member activity breakdown
- Cost per prompt/API call (for ROI justification)

This serves dual purposes: it helps admins manage their workspace and provides upgrade motivation when usage trends upward.

### "Seat Utilization" Nudge for Multi-Member Orgs
For orgs with fewer active members than their plan allows, show a subtle nudge: "You have 2 unused seats on your Pro plan. Invite team members to get more value." This increases stickiness (more users = harder to churn) and helps justify the subscription cost internally.

### Progressive Disclosure for Limit Warnings (Feature B)
Instead of a single toast at 80%, implement a graduated warning system:
1. **60%**: Subtle sidebar counter showing usage (e.g., "2/3 prompts")
2. **80%**: Toast notification with context (current design)
3. **100%**: Gate modal preventing the action, with upgrade CTA (role-aware)

This gives users multiple chances to act before hitting the wall, reducing frustration and increasing upgrade conversion.

### Annual Billing Display (Feature C)
Default the billing toggle to annual and show the monthly equivalent with savings:
- "$23/mo billed annually -- Save $72/year" (annual selected)
- "$29/mo billed monthly" (monthly selected)

The monthly equivalent makes annual pricing feel comparable while the savings badge creates urgency. Most B2B buyers prefer annual when the savings are clearly presented.

### Move "Invite Team Member" Earlier in Checklist (Feature A)
Move "Invite a team member" to step 2 or 3 in the onboarding checklist, not step 5. Getting a second person into the workspace early:
- Creates social commitment (harder to abandon a shared tool)
- Increases the chance of the team reaching the "aha moment" together
- Makes the workspace feel active and collaborative from day one

### Trial Summary Email: Shareable Report (Feature G)
Include a shareable report link in the trial summary email that the org owner can forward to decision-makers. This link should show:
- Workspace usage summary (prompts, versions, tests, members)
- Features used vs available
- ROI estimates or time-saved metrics if available
- Clear upgrade CTA

This helps internal champions build the business case for purchasing without needing to screenshot the app or write a custom summary.
