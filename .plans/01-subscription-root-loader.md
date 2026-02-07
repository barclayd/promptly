# 01: Subscription Data in Root Loader

> **STATUS: COMPLETED** -- Implemented in the org-level migration. See `app/root.tsx` and `app/lib/subscription.server.ts`.

## Summary
Wire up subscription status data into the root loader so that `useSubscription()` works everywhere in the app. This is the **foundation** for every other subscription UI feature.

## Priority: P0 (implement first)

## Current State
- `useSubscription()` hook exists at `app/hooks/use-subscription.ts`
- It reads `rootData?.subscription` from the root loader
- The root loader in `app/root.tsx` does NOT currently fetch subscription data
- The `trial-stripe` plugin exposes `GET /api/auth/subscription/status`

## What Was Actually Implemented

- Root loader fetches subscription via **direct D1 query** (not internal HTTP endpoint) using `getSubscriptionStatus(db, org.organizationId)`
- Uses `orgContext` from middleware (not `activeOrganizationId` from session) -- this correctly ties subscription to the current organization
- Wrapped in `try/catch` to handle public routes where org context is not set (returns `null` gracefully)
- Returns `subscription` in loader data alongside `user`, `theme`, `serverLayoutCookie`

## Original Implementation Plan

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

### Follow-Up Items
- Add `memberRole` to root loader return (needed for role-based CTA gating across all billing UI features -- determines whether a user sees "Upgrade to Pro" vs "Request upgrade from admin")
- Add `periodEnd` to `SubscriptionStatus` type (needed by billing page, cancelled state display, and usage dashboard to show current billing period)
- Consider adding `canManageBilling: boolean` derived server-side to keep billing permission logic encapsulated in the loader rather than duplicated across client components
- Consider `shouldRevalidate` optimization to skip subscription revalidation on non-billing routes (e.g., prompt editing) to reduce unnecessary D1 queries on navigation
