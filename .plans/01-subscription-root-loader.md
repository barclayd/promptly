# 01: Subscription Data in Root Loader

## Summary
Wire up subscription status data into the root loader so that `useSubscription()` works everywhere in the app. This is the **foundation** for every other subscription UI feature.

## Priority: P0 (implement first)

## Current State
- `useSubscription()` hook exists at `app/hooks/use-subscription.ts`
- It reads `rootData?.subscription` from the root loader
- The root loader in `app/root.tsx` does NOT currently fetch subscription data
- The `trial-stripe` plugin exposes `GET /api/auth/subscription/status`

## Implementation

### What to Do
1. In `app/root.tsx` loader, after fetching the session/user, call the subscription status endpoint
2. Return the subscription data alongside existing root loader data
3. Handle the case where there's no session (return `null` for subscription)

### Approach
Since the subscription status endpoint requires an authenticated session, only fetch it when a session exists. Use the Better Auth internal API to call the status endpoint server-side (avoiding an extra HTTP round-trip).

### Key Considerations
- The status endpoint performs **lazy trial expiration** (updates DB if trial has expired), so it's fine to call on every page load
- Cache the subscription data in the loader response -- React Router will handle revalidation
- If the subscription fetch fails, fail gracefully (return `null`) rather than blocking the page

### Files to Modify
- `app/root.tsx` -- Add subscription fetch to loader

### Files to Reference
- `app/hooks/use-subscription.ts` -- Already expects `subscription` in root data
- `app/plugins/trial-stripe/routes/status.ts` -- Status endpoint logic
- `app/plugins/trial-stripe/types.ts` -- `SubscriptionStatus` type

### Testing
- Verify `useSubscription()` returns data on any authenticated page
- Verify it returns `null` on unauthenticated pages (landing, login, signup)
- Verify trial expiration is lazily updated on page load
