# Additional Features Identified During Research

These are features that weren't in the original list but came up as high-impact during research. They're worth considering as future additions.

## A. Onboarding Checklist / Progress Bar
**Impact**: High (3x more likely to convert)
**Effort**: High

A sidebar widget shown during the first 7 days of trial with 4-5 steps:
1. Create your first prompt
2. Add variables to a prompt
3. Run a test
4. Generate an SDK snippet
5. Invite a team member

Research shows starting the progress bar at 20% (1 step already done -- "Account created") leverages the Zeigarnik effect. Users who complete onboarding checklists are 3x more likely to convert.

**Why it matters**: Time-to-value is the #1 predictor of trial conversion. If users hit the "aha moment" within 5 minutes, conversion rates roughly double.

## B. Approaching-Limit Warning Toast
**Impact**: Medium
**Effort**: Low

A one-time toast notification when usage hits 80% of a limit:
- "You've used 2 of 3 prompts. You have 1 remaining on the Free plan."
- Non-blocking, auto-dismissing after 8 seconds
- Triggers once per billing period per resource

Prevents the jarring experience of hitting a hard wall with no warning.

## C. Annual Billing Toggle
**Impact**: High (increases LTV significantly)
**Effort**: Medium

Add a monthly/annual toggle to the plan comparison (Feature #09):
- Show annual savings: "Save 20%" or "$58/year"
- Default to annual (higher LTV, lower displayed monthly price)
- Requires creating an annual price in Stripe

Standard practice: 77% of high-growth SaaS companies offer annual billing.

## D. Pre-Populated Example Prompt (Onboarding)
**Impact**: Very High (reduces time-to-value)
**Effort**: Medium

When a new user first logs in, pre-populate their workspace with an example prompt that demonstrates variables, testing, and SDK integration. This lets users experience the full value proposition in under 2 minutes without creating anything from scratch.

Notion, Canva, and Figma all do this -- new users see a pre-populated workspace, not an empty dashboard.

## E. Upgrade Prompt After Successful Action
**Impact**: High (2.3x better than time-based)
**Effort**: Low

After a user successfully runs a prompt test or publishes a version, show a brief, non-blocking toast:
- "Nice work! With Pro, you can run unlimited tests and publish unlimited versions."
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

## G. Personalized Trial Summary Email (Day 7)
**Impact**: High
**Effort**: Medium (requires email service)

A mid-trial email showing what the user has accomplished:
- "You've created [X] prompts and run [Y] tests this week"
- Comparison to average usage (social proof)
- Highlight features they haven't tried yet
- No hard sell -- just value reinforcement

Grammarly's weekly "Writing Update" emails use this pattern to great effect.

## H. "Compare Plans" Inline Component
**Impact**: Medium
**Effort**: Low

A small, embeddable "Compare Free vs Pro" component that can be shown in various contexts:
- At the bottom of the trial expiry modal
- On the billing page
- In the upgrade gate modal as a "See full comparison" expandable

Avoids duplicating plan comparison logic and keeps messaging consistent.
