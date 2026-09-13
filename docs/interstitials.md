# Interstitial Modal System

The app uses a priority-based interstitial system for modals, banners, and drawers that communicate subscription state to users. All interstitials are wired in `app/routes/layouts/app.tsx`.

## Priority Order

Interstitials are mutually exclusive (only one modal/drawer shows at a time). Banners can stack. Priority from highest to lowest:

| Priority | Component | Trigger | Type |
|----------|-----------|---------|------|
| 1 | `FailedPaymentBanner` | `subscription.status === 'past_due'` | Banner |
| 2 | `TrialBanner` | Active trial | Banner |
| 3 | `TrialExpiredBanner` | Expired trial (after initial modal) | Banner |
| 4 | `CancelledBanner` | Active + `cancelAtPeriodEnd` | Banner |
| 5 | `MidTrialNudgeDrawer` | Trialing, mid-trial milestone | Drawer |
| 6 | `TrialExpiryModal` | Trialing, approaching expiry (5d/2d/lastday) | Modal |
| 7 | `TrialExpiredModal` | Expired trial, first visit | Modal |
| 8 | `WinbackModal` | Expired trial, return visit (frequency-capped) | Modal |
| 9 | `UsageThresholdDrawer` | Approaching resource limit | Drawer |

The `UsageThresholdDrawer` is suppressed when any other interstitial modal/drawer is active via `otherInterstitialVisible`.

## Adding a New Interstitial

Follow this pattern (hook + component + wiring):

### 1. Create the hook (`app/hooks/use-{name}.ts`)

```typescript
// Return NOT_VISIBLE constant when conditions aren't met
const NOT_VISIBLE = { visible: false, /* other fields with defaults */ };

export const useMyModal = () => {
  const { subscription } = useSubscription();
  const organizationId = useOrganizationId();
  // Check conditions, return NOT_VISIBLE or { visible: true, ...data }
};
```

### 2. Create the component (`app/components/{name}.tsx`)

Follow the `VARIANT_CONFIG` + `stagger()` pattern:
- Define a `VARIANT_CONFIG` object with theme variants (icon, colors, gradients, copy)
- Use the `stagger(baseMs, index, step)` helper for orchestrated animation delays
- Use `Dialog` / `DialogContent` from `~/components/ui/dialog`
- Use `useCanManageBilling()` for role-aware CTAs

### 3. Wire into `app/routes/layouts/app.tsx`

```typescript
// 1. Import hook and component
// 2. Call hook, destructure with aliased names (e.g., `visible: myVisible`)
// 3. Add useState for open state
// 4. Add useEffect with 2s delay to show
// 5. Update otherInterstitialVisible if needed
// 6. Add JSX with guard: {myVisible && <MyModal open={...} />}
```

## Frequency-Capped Modal Pattern

Used by `WinbackModal` for return-visit modals that shouldn't overwhelm users:

**localStorage keys per org:**
- `promptly:{feature}-show-count:{orgId}` — Number of times shown (cap at N)
- `promptly:{feature}-last-shown:{orgId}` — Timestamp of last show (cooldown period)
- `promptly:{feature}-dismissed:{orgId}` — `"1"` for permanent dismiss

**Visibility check order:**
1. Subscription state matches (e.g., expired + hadTrial)
2. Prerequisite met (e.g., initial expired modal already shown)
3. Not permanently dismissed
4. Show count < max
5. Last shown > cooldown period ago

**Component responsibilities:**
- `markShown(orgId)` — Called on any close (increment count + set timestamp)
- `dismiss(orgId)` — Called on "Don't show this again" (set permanent flag)

## Winback Modal Files

| File | Purpose |
|------|---------|
| `app/hooks/use-winback-modal.ts` | Visibility logic, frequency cap (3 shows, 7-day cooldown), engagement segmentation |
| `app/components/winback-modal.tsx` | Three-segment win-back dialog (power/partial/ghost) |

**Segments** (based on `promptCount` from `useResourceLimits()`):
- `power` (3+ prompts) — Indigo theme, shows "current → free limit" comparison rows with amber warnings
- `partial` (1-2 prompts) — Purple theme, shows "Pro includes" feature bullets
- `ghost` (0 prompts) — Teal theme, shows numbered getting-started steps, CTA navigates to `/prompts` instead of upgrade

## Test Data for Interstitial Testing

When visually testing interstitials via Chrome DevTools MCP:

```sql
-- Set subscription to expired for winback/expired modal testing
UPDATE subscription SET status = 'expired' WHERE user_id = (SELECT id FROM user WHERE email = 'test@promptlycms.com');

-- Restore to active after testing
UPDATE subscription SET status = 'active' WHERE user_id = (SELECT id FROM user WHERE email = 'test@promptlycms.com');
```

**localStorage prerequisites for winback modal:**
- Set `promptly:trial-expired-modal-shown:{orgId}` to `"1"` (simulates initial modal already seen)
- Clear `promptly:winback-*:{orgId}` keys to reset frequency cap

**Theme testing note:** See the "Testing UI in both modes" section under Theme System above for how to toggle dark mode in Chrome DevTools.
