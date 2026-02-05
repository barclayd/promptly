# Tech Stack
- **Framework**: React Router 7 (NOT Next.js) on Cloudflare Workers
- **Database**: Cloudflare D1 (SQLite) with Drizzle ORM
- **Auth**: Better Auth with organization/team support
- **State**: Zustand + Zundo (for undo/redo)
- **Validation**: Zod v4
- **UI**: Radix UI primitives with shadcn/ui patterns
- **Styling**: Tailwind CSS 4
- **Icons**: `@tabler/icons-react` (prefer over lucide-react for new icons)
- **Linting**: Biome (`bun run lint:fix`)

# Code Style
- Always use arrow functions instead of function declarations
- Use `export const` inline rather than separate export statements
- **Always look up documentation** when unsure about APIs - don't guess or assume. Use web search to find official docs.
- **Always research suggestions** before dismissing them - don't rely on potentially outdated training data. When linters, users, or tools suggest alternatives, verify current browser support and best practices via web search before adding ignore comments or workarounds.

# Testing Requirements
- **All tests must pass** before completing any feature: `bun run lint`, `bun run typecheck`, and `bun run test:e2e`
- Fix lint errors as you go - don't accumulate technical debt
- When building new features, consider whether an e2e test would be valuable:
  - **Add e2e tests** for: critical user flows, complex interactions, features prone to regression
  - **Skip e2e tests** for: simple UI changes, internal refactors, features already covered by existing tests
- Run the full test suite before marking work as complete

# React Patterns
- Avoid `useEffect` wherever possible - it causes unintended bugs
- Use ref callbacks for DOM-related side effects (focus, scroll, measurements) instead of `useRef` + `useEffect`
- Prefer event-driven patterns (e.g., `useDebouncedCallback` over debounced values with useEffect)
- Use `useSyncExternalStore` for external state synchronization
- Use Navigation API listeners, event handlers, and other non-effect patterns when possible

# Routing
- Routes are explicitly configured in `app/routes.ts` (not auto-discovered from file names)
- New routes must be added to the `RouteConfig` array in `app/routes.ts`
- App routes (authenticated pages) go inside the `layout('./routes/layouts/app.tsx', [...])` block
- Route types are auto-generated at `./+types/{routeName}` after adding to routes.ts

# File Naming Conventions
- **API routes**: `app/routes/api/[resource].[action].ts` (e.g., `prompts.create.ts`, `team.invite.ts`)
- **Page routes with params**: `[routeName].$paramName.tsx` (e.g., `invite.$id.tsx`)
- **Validation schemas**: `app/lib/validations/[feature].ts`
- **Server-only code**: `*.server.ts` (e.g., `auth.server.ts`)
- **Client-only code**: `*.client.ts` (e.g., `auth.client.ts`)
- **Zustand stores**: `app/stores/[name]-store.ts`
- **Custom hooks**: `app/hooks/use-[name].ts`

# API Routes
API routes export an `action` function for POST requests:
```typescript
import { data, redirect } from 'react-router';
import type { Route } from './+types/[route-name]';

export const action = async ({ request, context }: Route.ActionArgs) => {
  // 1. Parse and validate form data with Zod
  // 2. Get auth session: const auth = getAuth(context); const session = await auth.api.getSession({ headers: request.headers });
  // 3. Access D1 database: const db = context.cloudflare.env.promptly;
  // 4. Return data() for errors or redirect() for success
};
```

# State Management
- Use Zustand for complex client state (see `app/stores/prompt-editor-store.ts`)
- Zustand stores support undo/redo via Zundo temporal middleware
- For inputs that need managed undo, add `data-managed-undo` attribute
- Server context (user, org) uses React Router's `createContext` in `app/context.ts`
- Access org context in loaders/actions: `context.get(orgContext)`

# Form Validation
- Define Zod schemas in `app/lib/validations/[feature].ts`
- Export both schema and inferred type: `export type LoginInput = z.infer<typeof loginSchema>`
- Use `safeParse` in actions and return flattened errors: `z.flattenError(result.error).fieldErrors`

# UI Components
- UI primitives in `app/components/ui/` follow shadcn/ui patterns
- Use `cn()` from `~/lib/utils` for conditional class merging
- Components use `data-slot` attributes for styling hooks
- Prefer existing UI components over creating new ones

# Agent Preferences
- Use typescript-developer agent when writing TypeScript code
- Use frontend-design skill plugin when implementing UI features
- Always test frontend changes using Chrome Dev Tools MCP
- Always test UI changes in both light and dark modes (see Theme System below)

# Theme System
The app supports Light, Dark, and System (follows OS) modes via a theme switcher in the user dropdown menu.

**How it works:**
- Uses `remix-themes` package for server-side theme handling
- Theme preference stored in **cookies** (not localStorage) for SSR compatibility
- Server reads theme from cookie and renders correct `class` on `<html>` element
- `PreventFlashOnWrongTheme` component handles flash prevention
- `useTheme` hook in `app/hooks/use-dark-mode.ts` provides `{ theme, isDark, setTheme }`

**Key files:**
- `app/sessions.server.ts` - Cookie session storage for theme
- `app/routes/api/set-theme.ts` - Theme action endpoint
- `app/root.tsx` - ThemeProvider setup

**Testing UI in both modes:**
When implementing or modifying UI components, test in both light and dark modes:
1. Use Chrome DevTools MCP to emulate color scheme: `emulateMedia({ colorScheme: 'dark' })`
2. Toggle theme via user menu dropdown
3. Reload page and verify theme persists
4. Check contrast, readability, and visual consistency in both modes

# Local Testing
- Test user email: test@promptlycms.com
- Test user password: Testing123
- Local dev server: http://localhost:5173

# Production Testing
- App URL: https://app.promptlycms.com (authenticated app)
- Landing page URL: https://promptlycms.com (marketing site)
- Test user email: test@promptlycms.com
- Test user password: Testing123
- To test prompts: Create a new prompt via the "Create" button in the sidebar or navigate to /prompts

# Database & Migrations
- D1 database migrations are stored in `migrations/drizzle/`
- Apply local migrations with: `bunx wrangler d1 migrations apply promptly --local`
- Apply remote migrations with: `bunx wrangler d1 migrations apply promptly --remote`
- The local D1 database is stored in `.wrangler/state/v3/d1/` (not `migrations/local.db`)
- Better Auth uses Kysely with CamelCasePlugin - table names become lowercase (e.g., `apiKey` → `apikey`)
- Column names use snake_case in the database (e.g., `userId` → `user_id`)

# Common Utilities
- **ID generation**: Use `nanoid()` from `nanoid` package
- **Auth helpers**: `getAuth(context)` from `~/lib/auth.server`
- **Class merging**: `cn()` from `~/lib/utils` (combines clsx + tailwind-merge)

# Common Gotchas
- This is React Router 7, NOT Next.js - don't use Next.js patterns
- D1 database uses prepared statements with `.bind()` - don't interpolate SQL
- Better Auth MCP server is available for auth-related questions
- Always check `session?.user` before accessing user data
- Form actions use `FormData`, not JSON bodies

# Cost Calculator Feature

The cost calculator popover (`app/components/cost-calculator-popover.tsx`) estimates LLM API costs based on model, token counts, and user preferences.

## Files
- `app/lib/model-pricing.ts` - Model pricing data (input/cached/output prices per 1M tokens)
- `app/lib/currency.ts` - Currency conversion using Frankfurter API
- `app/lib/token-counter.ts` - Token counting (tiktoken for OpenAI, estimates for others)
- `app/components/cost-calculator-popover.tsx` - Main popover component

## Updating Model Prices
Edit `app/lib/model-pricing.ts` and update the `MODEL_PRICING` object. Prices are in USD per 1M tokens:

```typescript
'model-id': {
  id: 'model-id',
  displayName: 'Model Name',
  provider: 'openai' | 'anthropic' | 'google',
  inputPrice: 2.50,        // $/1M input tokens
  cachedInputPrice: 1.25,  // $/1M cached input tokens
  outputPrice: 10.00,      // $/1M output tokens
},
```

Price sources: [llm-prices.com](https://www.llm-prices.com/)

## Token Counting
Token counting uses character-based estimation as a fallback before tests are run.
Real accurate values come from the AI SDK response after running a test.

- **OpenAI**: ~4 characters per token (official OpenAI documentation)
- **Anthropic**: ~3.5 characters per token (Anthropic recommendation)
- **Google**: ~4 characters per token (Google AI documentation)

## Currency Conversion
- Uses Frankfurter API (free, no API key): `https://api.frankfurter.dev/v1/latest?base=USD`
- Rates cached in localStorage for 24 hours
- Detects user's locale currency via `Intl.NumberFormat`

## Technical Notes
- Uses `useSyncExternalStore` for localStorage rate subscription (with object caching to prevent re-renders)
- Model selector auto-syncs with sidebar selection from `usePromptEditorStore`
- "Use cached input pricing" checkbox defaults ON for System Prompt, OFF for User Prompt

# E2E Testing

End-to-end tests use Playwright with Chromium only.

## Running Tests
- `bun run test:e2e` - Run all e2e tests (headless)
- `bun run test:e2e:ui` - Open Playwright UI for interactive testing
- `bun run test:e2e:headed` - Run tests with visible browser

**Note**: Dev server must be running (`bun run dev`) before running tests.

## Directory Structure
```
e2e/
├── tests/           # Test files (*.spec.ts)
├── fixtures/
│   └── base.ts      # Auth fixture with login helper
└── helpers/
    └── test-data.ts # Test credentials & constants
```

## Writing Tests
- Import `test` and `expect` from `../fixtures/base`
- Use `authenticatedPage` fixture for tests requiring login
- Test data constants are in `e2e/helpers/test-data.ts`
- **Avoid `describe` blocks** - each test should be self-contained and independent
- **No shared state** - don't rely on `beforeEach` or mutable variables across tests
- See: https://kentcdodds.com/blog/avoid-nesting-when-youre-testing

Example:
```typescript
import { test, expect } from '../fixtures/base';

// Each test is self-contained and independent.
// We avoid describe blocks to reduce cognitive load and nesting.

test('example test', async ({ authenticatedPage }) => {
  // authenticatedPage is already logged in
  await expect(authenticatedPage).toHaveURL(/dashboard/);
});
```

## Waiting for Form Submissions
**DO NOT use `waitForResponse` with URL pattern matching** - it's unreliable because:
- React Router 7 form submissions use `?_data=...` query params, not `.data` suffix
- The `actionTimeout` (15000ms) gets applied instead of default timeout

**Instead, wait for UI state changes:**
```typescript
// Click submit button
await submitButton.click();

// Wait for dialog to close (indicates form submission completed)
await expect(dialog).not.toBeVisible({ timeout: 30000 });

// Wait for navigation to new page
await page.waitForURL(/\/prompts\/[a-zA-Z0-9_-]+$/, { timeout: 30000 });
```

This pattern is more reliable because it tests what the user actually sees rather than implementation details.

# Landing Page

The landing page (`app/routes/landing.tsx`) is a marketing page with complex animations showcasing the product.

## Directory Structure
```
app/components/landing/
├── hero-section.tsx          # Main hero with copy + demo
├── hero-demo/
│   ├── index.ts              # Exports all demo components
│   ├── hero-demo-stack.tsx   # Window carousel orchestrator
│   ├── demo-window-frame.tsx # Reusable window chrome
│   ├── demo-editor-window.tsx
│   ├── demo-testing-window.tsx
│   ├── demo-ide-window.tsx
│   ├── demo-output-window.tsx
│   └── animations/
│       ├── typing-text.tsx   # Character-by-character typing
│       ├── blinking-cursor.tsx
│       ├── code-block.tsx    # Syntax-highlighted typing
│       ├── variable-badge.tsx
│       ├── confetti-burst.tsx
│       └── number-ticker.tsx # Animated counter
├── how-it-works/
│   ├── index.ts              # Exports step components
│   ├── how-it-works-step.tsx # Reusable step card with visual
│   ├── static-editor-window.tsx  # Static prompt editor preview
│   ├── static-ide-window.tsx     # Static code preview
│   └── animated-version-history.tsx # Version timeline animation
├── collaborative-editor-demo.tsx # Real-time collab demo (Solution section)
├── multi-language-ide-demo.tsx   # Language tabs IDE demo (Solution section)
├── animated-wrapper.tsx      # Scroll-triggered fade-in
├── social-proof-badge.tsx    # Avatar stack + rating
├── feature-card.tsx          # Feature grid cards
├── navigation.tsx
├── pain-points-section.tsx
├── solution-section.tsx      # Tab-based: Editors/Developers/Business
├── features-grid-section.tsx
├── how-it-works-section.tsx  # 3-step workflow with visual demos
├── audience-section.tsx
├── cost-section.tsx
├── social-proof-section.tsx
├── pricing-section.tsx
├── faq-section.tsx
└── footer-section.tsx
```

## Hero Section Architecture

The hero (`hero-section.tsx`) is a two-column layout:
- **Left column**: Animated copy with staggered entrance (badge → heading → paragraph → social proof → CTAs)
- **Right column**: `HeroDemoStack` - the rotating window carousel

All left-column elements use `AnimatedWrapper` with increasing delays (0ms → 400ms) for cascading fade-in.

## Hero Demo Stack (Window Carousel)

**File:** `app/components/landing/hero-demo/hero-demo-stack.tsx`

The centerpiece is a 4-window rotating carousel demonstrating the product workflow:

### Window Stack System
Windows are layered using CSS transforms based on position:
```
Position 0 (Front):     scale(1), rotate(0°)     - Active, full opacity
Position 1 (Back-Right): scale(0.92), rotate(2°)  - Partially visible
Position 2 (Back-Left):  scale(0.88), rotate(-2°) - Dimmed
Position 3 (Hidden):     scale(0.84), rotate(0°)  - Not visible
```

All transitions use `duration-500 ease-out`.

### Timing Constants
```typescript
WINDOW_DURATION = 10500  // Each window active for 10.5s
FINAL_WINDOW_PAUSE = 2000 // Extra pause after output window
WINDOW_COUNT = 4
```

### Window Cycle (repeats ~45s)
1. **Editor Window** (0-10.5s): Shows prompt being typed with variable badges
2. **Testing Window** (10.5-21s): Dropdown selections → run button → output preview
3. **IDE Window** (21-31.5s): Code typing with syntax highlighting
4. **Output Window** (31.5-44s): Word streaming + cost ticker + confetti

### State Management
- `activeIndex`: Which window is at position 0
- `isPaused`: Carousel pauses on hover
- Position calculation: `(windowIndex - activeIndex + WINDOW_COUNT) % WINDOW_COUNT`

### Reset Behavior
When a window becomes inactive, it resets its internal state after 600ms (allows exit animations to complete).

## Individual Window Animations

### DemoEditorWindow
- Segments typed at 40ms per character
- Variable badges appear with 530ms delay using `badge-pop` animation
- Auto-save indicator shows after typing completes

### DemoTestingWindow
Animation phases (sequential):
1. `select-company` → dropdown opens → value selected (1.3s)
2. `select-user` → dropdown opens → value selected (1.3s)
3. `select-plan` → dropdown opens → value selected (1.3s)
4. `click-run` → button highlights
5. `running` → spinner state
6. Output preview appears, 3s pause for reading

### DemoIdeWindow
- `CodeBlock` types at 24ms per character
- Syntax highlighting via token types (keywords=purple, strings=emerald, functions=yellow)
- Auto-scrolls during typing
- `onComplete` callback triggers next window

### DemoOutputWindow
- Words stream at 67ms intervals (word-by-word, not character)
- `NumberTicker` animates cost from $0 to final value
- `ConfettiBurst` triggers when complete (12 particles, 1.2s)
- Gets extra 2s pause due to longer animation

## Solution Section

**File:** `app/components/landing/solution-section.tsx`

Tab-based section showcasing the product for three audiences:

### Tab Structure
- **For Editors**: `CollaborativeEditorDemo` - shows real-time collaboration
- **For Developers**: `MultiLanguageIdeDemo` - shows SDK code in multiple languages
- **For Business**: Static cost overview visualization

### CollaborativeEditorDemo (`collaborative-editor-demo.tsx`)
Demonstrates real-time collaboration with multiple cursors:
- Three collaborators (Sarah, Alex, Jordan) with color-coded cursors
- Typing animation with cursor movement
- Label popups showing collaborator names
- Controlled by `isVisible` prop from parent tab state

### MultiLanguageIdeDemo (`multi-language-ide-demo.tsx`)
Shows SDK usage across different languages:
- Language tabs: TypeScript, Python, Go, Swift
- Syntax-highlighted code snippets for each language
- Copy button functionality
- Controlled by `isVisible` prop from parent tab state

## How It Works Section

**File:** `app/components/landing/how-it-works-section.tsx`

Three-step workflow with modular visual components:

### Component Structure
- `HowItWorksStep` - Reusable card with step number, title, description, and visual slot
- Step visuals are selected based on `visual` field in data:
  - `'editor'` → `StaticEditorWindow`
  - `'code'` → `StaticIdeWindow`
  - `'iterate'` → `AnimatedVersionHistory`

### StaticEditorWindow
Non-animated prompt editor preview showing:
- Window chrome (traffic lights)
- Prompt text with variable badges
- Auto-save indicator

### StaticIdeWindow
Non-animated IDE preview showing:
- Language tabs
- Syntax-highlighted TypeScript code
- SDK usage example

### AnimatedVersionHistory
Animated version timeline that cycles through versions:
- Shows 3 versions at a time, sliding in new versions
- "Live" badge with pulsing animation on current version
- `animate-version-slide-in` for entrance animation
- `animate-live-pulse` for live indicator

## Animation Utilities

### NumberTicker (`animations/number-ticker.tsx`)
Animated number counter with:
- `value`: Target number
- `from`: Starting number (default 0)
- `delay`: Delay before animation starts (default 0, only on first render)
- `duration`: Animation duration in ms (default 1000)
- Uses `requestAnimationFrame` with ease-out-cubic easing

### AnimatedWrapper (`animated-wrapper.tsx`)
Scroll-triggered fade-in wrapper:
```tsx
<AnimatedWrapper delay={100} direction="up">
  {content}
</AnimatedWrapper>
```
- Directions: `up` (default), `left`, `right`
- Uses `useInView` hook with IntersectionObserver
- `triggerOnce: true` - only animates once

### useInView Hook (`app/hooks/use-in-view.ts`)
Uses **ref callback pattern** (not useEffect) for intersection detection:
```tsx
const { ref, isInView } = useInView({ threshold: 0.1, triggerOnce: true });
```

## CSS Animations

**File:** `app/app.css`

Key keyframes for landing page:
```css
@keyframes fade-in-up        /* Section entrance */
@keyframes fade-in-left      /* Section entrance */
@keyframes fade-in-right     /* Section entrance */
@keyframes badge-pop         /* Variable badges: scale 0→1.15→1 */
@keyframes dropdown-slide    /* Dropdown: translateY(-8px)→0 */
@keyframes confetti-fall     /* Particle trajectory */
@keyframes label-enter       /* Label bounce in */
@keyframes label-exit        /* Label scale out */
@keyframes blink             /* Cursor blinking */
@keyframes version-slide-in  /* Version history: translateY(20px)→0 with overshoot */
@keyframes live-pulse        /* Pulsing glow for "live" badge */
@keyframes step-activate     /* Step number scale bounce */
```

## Making Changes Safely

### Adding a new section
1. Create component in `app/components/landing/`
2. Import and add to `app/routes/landing.tsx`
3. Wrap content in `AnimatedWrapper` for entrance animation

### Modifying window animations
1. Each window manages its own animation state internally
2. Windows receive `isActive` prop from `HeroDemoStack`
3. Use `onComplete` callback to signal animation finished
4. Reset state when `isActive` becomes false (with 600ms delay)

### Adjusting timing
- **Window duration**: Change `WINDOW_DURATION` in `hero-demo-stack.tsx`
- **Transition speed**: Modify `duration-500` classes on window containers
- **Typing speed**: Adjust `charDelay` prop on `TypingText`/`CodeBlock`
- **NumberTicker speed**: Use `duration` and `delay` props

### Adding new animations
1. Define keyframes in `app/app.css`
2. Add Tailwind animation class in the CSS file
3. Apply class conditionally based on component state

## Performance Notes
- `useInView` with `triggerOnce` prevents re-triggering animations
- Carousel pauses on hover to reduce animation load
- All timeouts are cleaned up on unmount
- CSS transforms are GPU-accelerated (scale, rotate, translate)

## Mobile Overflow Prevention

The landing page uses multiple layers of overflow protection to prevent horizontal scrolling on mobile (especially iOS Safari):

**Root-level protection** (`app/app.css`):
```css
html,
body {
  @apply h-full bg-background;
  overflow-x: hidden;
}
```

**Page-level protection** (`app/routes/landing.tsx`):
```tsx
<div className="min-h-screen bg-background overflow-x-hidden">
```

**Common overflow culprits to watch for:**
1. **Large background blur elements** - Gradients with fixed widths (e.g., `w-[600px]`) can extend beyond viewport
2. **Code blocks with `overflow-x-auto`** - Change to `overflow-hidden` for demo code that doesn't need scrolling
3. **Absolute/fixed positioned elements** - Check that they're properly contained

**Testing mobile overflow:**
```js
// Run in Chrome DevTools at 375px width
const hasOverflow = document.documentElement.scrollWidth > document.documentElement.clientWidth;
console.log('Has horizontal overflow:', hasOverflow,
  'Difference:', document.documentElement.scrollWidth - document.documentElement.clientWidth);
```

**Verification checklist:**
1. Test at 375px (iPhone) and 320px (smallest common mobile)
2. Test both light and dark modes
3. Scroll entire page - no horizontal scroll should be possible

# Authentication

## Password Hashing
The app uses **PBKDF2** for password hashing (not Better Auth's default Scrypt):
- **File**: `app/lib/password.server.ts`
- **Format**: `saltHex:hashHex` (97 characters total)
- **Algorithm**: PBKDF2 with SHA-256, 100,000 iterations

### Legacy Password Migration
If users have legacy Scrypt hashes (from Better Auth defaults or old bun versions), they'll see "Invalid password" errors. The logs will show:
```
Legacy Scrypt hash detected - user needs password reset
```

**Fix**: Update the password hash in the `account` table:
```sql
UPDATE account
SET password = '<new_pbkdf2_hash>'
WHERE user_id = (SELECT id FROM user WHERE email = '<user_email>')
AND provider_id = 'credential';
```

To generate a new PBKDF2 hash, use Node.js with the Web Crypto API (see `password.server.ts` for the algorithm).

## Better Auth Internal API
- `auth.api.signInEmail()` returns cookies via `response.headers.get('set-cookie')`
- Social login (Google) works differently - cookies are set by the callback endpoint `/api/auth/callback/google`
- Password column is in the `account` table, NOT the `user` table

## Debugging Auth Issues
1. Check Cloudflare Worker logs for Better Auth errors
2. Verify `BETTER_AUTH_URL` has no leading/trailing spaces
3. Check password hash format (should be `saltHex:hashHex`, ~97 chars)
4. For OAuth: verify redirect URIs match exactly in Google Console

# Deployment

## Deployment Architecture

The application is split across two Cloudflare services:

| Service | URL | Platform | Purpose |
|---------|-----|----------|---------|
| **App** | https://app.promptlycms.com | Cloudflare Workers | Authenticated app, dynamic content |
| **Landing Page** | https://promptlycms.com | Cloudflare Pages | Marketing site, prerendered static HTML |

**Cloudflare Project Names:**
- Workers: `promptly`
- Pages: `promptly-landing-pages`

## Quick Deploy (Both Services)

```bash
# 1. Build the app
bun run build

# 2. Deploy the app to Workers
wrangler deploy

# 3. Pre-render landing page from local wrangler dev
bunx wrangler dev  # in one terminal
bun run prerender  # in another terminal

# 4. Copy files to landing-pages directory
cp build/client/index.html landing-pages/
cp -r build/client/assets landing-pages/

# 5. Deploy landing page to Cloudflare Pages
bunx wrangler pages deploy landing-pages/ --project-name=promptly-landing-pages
```

## App Deployment (Workers)

### Pre-Deployment Checklist
1. `bun run lint` - fix any errors
2. `bun run typecheck` - fix any type errors
3. `bun run test:e2e` - ensure tests pass (dev server must be running)

### Deploy Command
```bash
bun run deploy
# Runs: bun run build && wrangler deploy
```

### Post-Deployment Verification
1. Test login flow at https://app.promptlycms.com/login
2. Test Google SSO
3. Check Cloudflare Worker logs for errors

## Landing Page Deployment (Pages)

The landing page is pre-rendered from a local wrangler dev server and deployed as static HTML.

**IMPORTANT: Always pre-render from local wrangler dev, never from production.** The production URL (`promptlycms.com`) serves the Pages static site, so fetching from it is circular. Cloudflare edge features (like Rocket Loader) can also mangle script tags in the response, breaking the pre-rendered HTML.

```bash
# Build the app
bun run build

# Start local server (in one terminal)
bunx wrangler dev

# Pre-render from localhost (in another terminal)
bun run prerender

# Copy to landing-pages directory
cp build/client/index.html landing-pages/
cp -r build/client/assets landing-pages/

# Deploy to Cloudflare Pages
bunx wrangler pages deploy landing-pages/ --project-name=promptly-landing-pages
```

### Landing Page Files
```
landing-pages/
├── index.html      # Prerendered HTML (gitignored)
├── assets/         # JS/CSS bundles (gitignored)
├── _headers        # Cloudflare Pages caching config (tracked)
└── favicon.ico     # Site favicon (gitignored)
```

### Caching Configuration
The `_headers` file configures aggressive edge caching:
- `s-maxage=3600` - CDN caches for 1 hour
- `stale-while-revalidate=86400` - Serve stale content while revalidating for 24 hours

## Database Migrations

```bash
# Apply migrations to production
bunx wrangler d1 migrations apply promptly --remote

# Apply migrations to local dev
bunx wrangler d1 migrations apply promptly --local
```

## Environment Variables

### Required for Workers
| Variable | Value | Notes |
|----------|-------|-------|
| `BETTER_AUTH_URL` | `https://app.promptlycms.com` | No trailing slash, no leading spaces |
| `GOOGLE_CLIENT_ID` | From Google Console | OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | From Google Console | OAuth client secret |

### OAuth Configuration (Google Console)
- Authorized redirect URI: `https://app.promptlycms.com/api/auth/callback/google`

## Common Deployment Issues

### "Legacy Scrypt hash detected"
- **Cause**: Password hash format mismatch (see Authentication section)
- **Fix**: Update user's password hash in D1 database

### OAuth redirect_uri mismatch
- **Cause**: `BETTER_AUTH_URL` has wrong value or extra spaces
- **Fix**: Check env var in Cloudflare dashboard, ensure exact match with Google Console

### Cookies not being set
- **Cause**: Usually means auth actually failed (check logs)
- **Fix**: Check Better Auth logs for the real error (often password-related)

### Landing page shows old content
- **Cause**: Pre-rendered from old build or cached at edge
- **Fix**: Rebuild, re-run `bun run prerender` from local wrangler dev, then redeploy Pages

### Landing page blank / text invisible / dark mode broken
- **Cause**: Pre-rendered HTML has broken `<script>` tags (e.g. Cloudflare Rocket Loader mangled the `type` attributes)
- **Fix**: Ensure Rocket Loader is **disabled** in Cloudflare dashboard (Speed > Optimization). Re-prerender from local wrangler dev (never from production) and redeploy Pages

### Wrangler pages deploy fails
- **Cause**: Wrong project name or not authenticated
- **Fix**: Run `bunx wrangler login` and verify project name is `promptly-landing-pages`

# Promptly API Worker (Separate Repo)

A dedicated Cloudflare Worker for serving prompts to 3rd party applications via API. This runs as a **separate service** from the main app for performance isolation.

## Overview

| Property | Value |
|----------|-------|
| **URL** | `https://api.promptlycms.com` |
| **Platform** | Cloudflare Workers (separate from main app) |
| **Database** | Same D1 database (`promptly`) |
| **Caching** | KV namespace with 60-second TTL |
| **Bundle Size** | ~20KB (no ORM, no framework) |

## Endpoint

```
GET https://api.promptlycms.com/prompts/get?promptId=<id>&version=<optional-semver>
Authorization: Bearer <api_key>
```

**Success Response (200):**
```json
{
  "promptId": "xxx",
  "promptName": "My Prompt",
  "version": "1.0.0",
  "systemMessage": "...",
  "userMessage": "...",
  "config": {}
}
```

**Error Response (4xx):**
```json
{
  "error": "Error message",
  "code": "ERROR_CODE"
}
```

Error codes: `INVALID_KEY`, `DISABLED`, `EXPIRED`, `FORBIDDEN`, `NO_ORG`

## Database Schema (Reference)

The API worker queries the existing Promptly D1 database directly (no ORM).

### `apikey` table (Better Auth)
```sql
-- Better Auth stores API keys with SHA-256 hashing
CREATE TABLE apikey (
  id TEXT PRIMARY KEY,
  key TEXT NOT NULL,           -- SHA-256 hash of the API key (NOT the raw key)
  permissions TEXT,            -- JSON: {"prompt": ["read"]}
  metadata TEXT,               -- JSON: {"organizationId": "xxx"}
  enabled INTEGER DEFAULT 1,
  expires_at INTEGER,          -- Unix timestamp (milliseconds)
  -- other Better Auth fields omitted
);
CREATE INDEX idx_apikey_key ON apikey(key);
```

**Important**: The `key` column stores `SHA-256(rawApiKey)`, not the raw key. When verifying:
```typescript
const hashedKey = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(rawApiKey));
// Convert to hex string, then query: SELECT * FROM apikey WHERE key = ?
```

### `prompt` table
```sql
CREATE TABLE prompt (
  id TEXT PRIMARY KEY,         -- nanoid
  name TEXT NOT NULL,
  organization_id TEXT NOT NULL,
  deleted_at INTEGER,          -- Soft delete timestamp
  -- other fields omitted
);
```

### `prompt_version` table
```sql
CREATE TABLE prompt_version (
  id TEXT PRIMARY KEY,
  prompt_id TEXT NOT NULL,
  major INTEGER,               -- NULL for drafts
  minor INTEGER,
  patch INTEGER,
  system_message TEXT,
  user_message TEXT,
  config TEXT DEFAULT '{}',    -- JSON string
  published_at INTEGER,        -- NULL for drafts, timestamp for published
  -- other fields omitted
);
```

**Version Query Logic:**
- If `version` param provided: exact match on `major.minor.patch`
- If no version: get latest by `ORDER BY (published_at IS NULL), major DESC, minor DESC, patch DESC LIMIT 1`
  - This prioritizes published versions over drafts, then sorts by semver

## API Key Verification Flow

1. Extract Bearer token from `Authorization` header
2. Hash the token with SHA-256 (same as Better Auth storage)
3. Check KV cache for `apikey:{hashedKey}`
4. If cache miss, query D1: `SELECT * FROM apikey WHERE key = ?`
5. Validate:
   - `enabled = 1`
   - `expires_at` is null or in the future
   - `permissions` JSON contains `{"prompt": ["read"]}`
   - `metadata` JSON contains `organizationId`
6. Cache the validated key data in KV (60s TTL)
7. Return `organizationId` for prompt access check

## KV Caching Strategy

| Key Pattern | Value | TTL |
|-------------|-------|-----|
| `apikey:{sha256Hash}` | `{organizationId, permissions, expiresAt, enabled}` | 60s |
| `prompt:{promptId}` | `{id, name, organizationId}` | 60s |
| `version:{promptId}:latest` | `{systemMessage, userMessage, config, version}` | 60s |
| `version:{promptId}:{semver}` | `{systemMessage, userMessage, config, version}` | 60s |

**Cache Logging**: All cache hits/misses are logged as JSON for observability:
```json
{"event": "cache", "type": "apikey", "hit": true, "key": "apikey:abc123...", "timestamp": 1234567890}
```

## Cache Invalidation (Main App Responsibility)

The main Promptly app must invalidate KV cache when data changes. Add the same KV namespace binding to the main app's `wrangler.jsonc`:

```jsonc
"kv_namespaces": [
  {
    "binding": "PROMPTS_CACHE",
    "id": "<SAME_KV_NAMESPACE_ID_AS_API_WORKER>"
  }
]
```

### When to Invalidate

| Action | Keys to Delete |
|--------|---------------|
| Update prompt name | `prompt:{promptId}` |
| Publish version | `version:{promptId}:latest` |
| Delete prompt | `prompt:{promptId}`, `version:{promptId}:latest` |
| Disable/delete API key | `apikey:{hashedKey}` |

### Invalidation Helper

```typescript
// Add to main app: app/lib/cache-invalidation.server.ts
export const invalidatePromptCache = async (
  cache: KVNamespace,
  promptId: string,
) => {
  await cache.delete(`prompt:${promptId}`);
  await cache.delete(`version:${promptId}:latest`);
  // Specific version keys expire naturally (60s TTL)
};

export const invalidateApiKeyCache = async (
  cache: KVNamespace,
  rawApiKey: string,
) => {
  const encoder = new TextEncoder();
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(rawApiKey));
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashedKey = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  await cache.delete(`apikey:${hashedKey}`);
};
```

## Worker Configuration

### `wrangler.jsonc`
```jsonc
{
  "name": "promptly-api",
  "main": "./src/index.ts",
  "compatibility_date": "2025-10-08",
  "compatibility_flags": ["nodejs_compat_v2"],
  "observability": { "enabled": true },
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "promptly",
      "database_id": "eadc5f7c-e195-4bd0-bcb1-8e4d2950606b"
    }
  ],
  "kv_namespaces": [
    {
      "binding": "CACHE",
      "id": "<CREATE_WITH: bunx wrangler kv namespace create PROMPTS_CACHE>",
      "preview_id": "<CREATE_WITH: bunx wrangler kv namespace create PROMPTS_CACHE --preview>"
    }
  ],
  "routes": [
    {
      "pattern": "api.promptlycms.com/*",
      "zone_name": "promptlycms.com"
    }
  ]
}
```

### DNS Setup
After deploying, add DNS record in Cloudflare:
1. Go to Cloudflare Dashboard → DNS
2. Add AAAA record: `api` → `100::` (proxied)
3. The worker route pattern handles requests

## File Structure

```
promptly-api/
├── src/
│   ├── index.ts           # Worker entry point
│   ├── handler.ts         # Request routing
│   ├── verify-api-key.ts  # API key verification
│   ├── fetch-prompt.ts    # Prompt data fetching
│   ├── cache.ts           # KV cache helpers
│   └── types.ts           # TypeScript interfaces
├── wrangler.jsonc
├── tsconfig.json
└── package.json
```

## Testing

### Local Development
```bash
bunx wrangler dev
# Test: curl "http://localhost:8787/prompts/get?promptId=XXX" -H "Authorization: Bearer promptly_xxx"
```

### Production Test
```bash
curl "https://api.promptlycms.com/prompts/get?promptId=<id>" \
  -H "Authorization: Bearer <api_key>"
```

### Get Test Data
To find valid test data, query the main app's D1 database:
```bash
# Get a prompt ID
bunx wrangler d1 execute promptly --remote --command "SELECT id, name FROM prompt LIMIT 5"

# Get an API key (you'll need the raw key from when it was created)
bunx wrangler d1 execute promptly --remote --command "SELECT id, metadata FROM apikey WHERE enabled = 1 LIMIT 5"
```

## Performance Targets

| Metric | Target |
|--------|--------|
| Cold start | <5ms |
| Warm request (cache hit) | <10ms |
| Warm request (cache miss) | <50ms |
| Bundle size | <25KB |

## CORS Configuration

The API allows cross-origin requests:
```
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET, OPTIONS
Access-Control-Allow-Headers: Authorization, Content-Type
Access-Control-Max-Age: 86400
```

## Error Handling

| HTTP Status | When |
|-------------|------|
| 400 | Missing `promptId` parameter |
| 401 | Missing/invalid Authorization header, invalid API key |
| 403 | API key lacks permission, wrong organization |
| 404 | Prompt or version not found |
| 405 | Non-GET request to `/prompts/get` |
| 500 | Unexpected error (logged) |
