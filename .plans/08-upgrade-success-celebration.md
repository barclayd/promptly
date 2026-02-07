# 08: Upgrade Success Celebration

## Summary
When a user successfully upgrades to Pro (returning from Stripe Checkout), celebrate the moment with a brief, delightful animation and clear guidance on what to do next. This anchors positive emotion to the purchase and drives immediate engagement with Pro features.

## Priority: P1

## Dependencies: #01 (Subscription Root Loader)

## Trigger
User returns from Stripe Checkout with `?upgraded=true` in the URL query string. The upgrade endpoint already specifies `successUrl: window.location.origin + '/dashboard?upgraded=true'`.

## Component: `UpgradeSuccessModal`

### Content
- **Confetti animation**: 1.5-second burst (reuse the existing `ConfettiBurst` component from `app/components/landing/hero-demo/animations/confetti-burst.tsx`)
- **Title**: "Welcome to Pro"
- **Subtitle**: "You now have access to all Pro features."
- **Feature checklist** (with checkmark icons):
  - Unlimited prompts
  - Up to 5 team members
  - 50,000 API calls/month
- **Primary CTA**: "Start building" (navigates to prompt creation or dashboard)
- **Secondary CTA**: "Invite your team" (navigates to team page)

### Timing
1. Modal appears immediately on page load when `?upgraded=true` is detected
2. Confetti fires after a 300ms delay
3. Modal stays until user clicks a CTA or closes it
4. Clean the `?upgraded=true` param from URL after showing (use `history.replaceState`)

## CTA Copy Rationale
- **"Start building"** -- Action-oriented, developer-focused. Research from Pencil & Paper shows success pages with clear next actions have 3x better engagement than dead-end celebrations.
- **"Invite your team"** -- Secondary path for users who need collaboration. This also drives adoption (invited users are more likely to retain).
- Avoid **"You're all set"** -- Dead end with no direction.

## Post-Celebration Actions
After the modal is dismissed:
1. Remove the trial banner from the UI
2. Update the sidebar badge to show `PRO` (purple/brand color)
3. Revalidate subscription data (call `refetch()` from `useSubscription()`)

## Design Details
- Use the existing `Dialog` component for the modal
- Confetti: Reuse or adapt the `ConfettiBurst` component from the landing page
- Checkmark icons: Use `@tabler/icons-react` `IconCheck` in green circles
- Feature list should be compact -- not a detailed comparison, just a quick "here's what you got"
- Celebration should feel brief and premium -- not over the top
- Dark mode: Confetti should work against dark backgrounds

## Edge Cases
- **User navigates directly to `?upgraded=true`**: Show the modal anyway -- if they're not actually upgraded, the subscription data won't match but the modal is harmless
- **User refreshes with `?upgraded=true`**: Only show once per session (check sessionStorage)
- **Webhook hasn't processed yet**: The subscription status might still show `trialing` for a few seconds after checkout. Show the celebration optimistically based on the URL param, then revalidate subscription data in the background.

## Key Implementation Notes
- Check for `upgraded=true` URL param in the dashboard page or app layout
- Clean the URL param after displaying: `window.history.replaceState({}, '', window.location.pathname)`
- Track shown state in `sessionStorage` to prevent re-showing on refresh
- Call `useSubscription().refetch()` after celebration to update all subscription-dependent UI

## Files to Create
- `app/components/upgrade-success-modal.tsx`

## Files to Modify
- `app/routes/dashboard.tsx` or `app/routes/layouts/app.tsx` -- Detect `?upgraded=true` and show modal

## Conversion Psychology
- **Peak-end rule**: The emotional peak of the upgrade experience (celebration) becomes the lasting memory, creating positive brand association
- **Dopamine anchoring**: Confetti and celebration triggers dopamine release, which the brain associates with the upgrade decision -- reducing buyer's remorse
- **Guided next step**: Users who take an action immediately after upgrading (creating a prompt, inviting team) are 3x more likely to remain paying subscribers
- **Social driver**: "Invite your team" as a secondary CTA drives organic growth -- each invited user is a potential future subscriber
