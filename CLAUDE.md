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
The app uses cookie-based themes, **not** `prefers-color-scheme` media queries. `emulate({ colorScheme: 'dark' })` in Chrome DevTools will NOT work. Instead:
1. Toggle theme via the user dropdown menu (requires being logged in)
2. Or inject the class directly via Chrome DevTools: `document.documentElement.classList.add('dark')` / `.remove('dark')`
3. Check contrast, readability, and visual consistency in both modes

# Testing
- Test user: test@promptlycms.com / Testing123
- Local dev server: http://localhost:5173
- App URL: https://app.promptlycms.com (authenticated app)
- Landing page URL: https://promptlycms.com (marketing site)
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

## Adding a New Model (Full Process)

Use the `/project:update-models` slash command for a guided walkthrough. The full process involves:

1. **Research**: Verify the AI SDK model ID at https://github.com/vercel/ai (check PRs and provider source)
2. **Package update**: `bun update @ai-sdk/<provider>` if the model is very new
3. **Pricing entry**: Add to `MODEL_PRICING` in `app/lib/model-pricing.ts`
4. **SDK mapping**: Add display-ID → SDK-ID mapping in `app/lib/model-dispatch.server.ts` (Anthropic uses dots in display IDs but hyphens in SDK IDs)
5. **Landing page**: Update hardcoded model names in `app/components/landing/hero-demo/demo-editor-window.tsx` and `app/components/landing/how-it-works/static-editor-window.tsx` if the new model replaces the flagship
6. **Automated checks**: `bun run lint:fix`, `bun run typecheck`, `bun run test:e2e`
7. **Browser verification**: Add the model via Settings > LLM API Keys (using the provider key from `.env`), test a prompt to confirm streaming works, then verify cost calculator math

### Files that need manual edits
| File | What to add |
|------|-------------|
| `app/lib/model-pricing.ts` | Pricing entry in `MODEL_PRICING` |
| `app/lib/model-dispatch.server.ts` | SDK ID mapping in `MODEL_ID_MAP` (if IDs differ) |
| `app/components/landing/hero-demo/demo-editor-window.tsx` | Update model badge text (if flagship) |
| `app/components/landing/how-it-works/static-editor-window.tsx` | Update model badge text (if flagship) |
| `app/lib/landing-data.ts` | Update model names in FAQ copy (if flagship) |

### Files that auto-derive (no edits needed)
- `app/components/ui/select-scrollable.tsx` — groups models by provider prefix
- `app/components/cost-calculator-popover.tsx` — reads from `getModelPricing()`
- `app/components/create-llm-api-key-dialog.tsx` — reads from `getModelsByProvider()`
- `app/components/sidebar-right.tsx` — uses `SelectScrollable`

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

Key keyframes:
```css
@keyframes fade-in-up        /* Section/element entrance */
@keyframes fade-in-left      /* Section entrance */
@keyframes fade-in-right     /* Section entrance */
@keyframes badge-pop         /* Bouncy scale 0→1.15→1 entrance */
@keyframes dropdown-slide    /* Dropdown: translateY(-8px)→0 */
@keyframes confetti-fall     /* Particle trajectory */
@keyframes label-enter       /* Label bounce in */
@keyframes label-exit        /* Label scale out */
@keyframes blink             /* Cursor blinking */
@keyframes version-slide-in  /* Version history: translateY(20px)→0 with overshoot */
@keyframes live-pulse        /* Pulsing glow for "live" badge */
@keyframes step-activate     /* Step number scale bounce */
@keyframes pulse-glow-red    /* Red pulsing box-shadow for urgency CTAs */
```

### Reusable animation classes
- `.animate-fade-in-up` — 0.6s ease-out, use with `opacity-0` initial state
- `.animate-badge-pop` — Bouncy scale entrance. **Initial state is built into the class** (`transform: scale(0); opacity: 0;`), so do NOT add Tailwind `opacity-0` or `scale-0` alongside it
- `.animate-pulse-glow-red` — Red pulsing glow for urgent CTAs (e.g., last-day trial warning)

### Staggered entrance pattern for modals/dialogs

Use this pattern for orchestrated modal entrances (see `trial-expiry-modal.tsx`, `upgrade-gate-modal.tsx`):

```typescript
// Helper to generate staggered animation delay styles
const stagger = (base: number, i: number, step = 60) => ({
  animationDelay: `${base + i * step}ms`,
  animationFillMode: 'forwards' as const,
});

// Usage: elements start invisible, animate in with increasing delays
<div className="opacity-0 animate-fade-in-up" style={stagger(80, 0)}>Title</div>
<div className="opacity-0 animate-fade-in-up" style={stagger(160, 0)}>Description</div>
{items.map((item, i) => (
  <div className="opacity-0 animate-fade-in-up" style={stagger(400, i)}>...</div>
))}
```

**Timing map example (trial expiry modal):**
- 0ms — Icon badge-pop
- 80ms — Title fade-in-up
- 160ms — Description fade-in-up
- 300ms — Date pill badge-pop
- 400ms+ — Content items stagger (60ms each)
- 700ms — CTA fade-in-up
- 800ms — Secondary CTA fade-in-up

### CSS animation gotcha: Tailwind utilities vs `animation-fill-mode: forwards`

**CRITICAL**: Never combine Tailwind utility classes (`opacity-0`, `scale-0`) with CSS animations that use `forwards` fill mode if the animation changes the same property via `transform`. Tailwind utilities can override the animation's final state due to CSS specificity.

**Wrong:**
```tsx
// Tailwind's opacity-0 overrides the animation's final opacity: 1
<div className="opacity-0 scale-0 animate-badge-pop" style={stagger(0, 0)}>
```

**Right — for fade-in-up** (uses `opacity` property, which Tailwind's `opacity-0` matches):
```tsx
// Works because animate-fade-in-up animates opacity directly
// and animationFillMode: 'forwards' holds the final state
<div className="opacity-0 animate-fade-in-up" style={stagger(80, 0)}>
```

**Right — for badge-pop** (initial state baked into the CSS class):
```tsx
// .animate-badge-pop already sets transform: scale(0); opacity: 0;
// No Tailwind utilities needed — just apply the class
<div className="animate-badge-pop" style={stagger(0, 0)}>
```

**Why it works differently:** `animate-fade-in-up` animates `opacity` and `transform` as separate properties, and Tailwind's `opacity-0` gets overridden by the animation's `forwards` fill. But `animate-badge-pop` uses `transform: scale()` in its keyframes — if you also apply Tailwind's `scale-0` (which uses the separate `scale` CSS property, not `transform`), they don't interact and the animation can't override it.

**Rule of thumb:** If a CSS animation class needs specific initial state, define that initial state **in the CSS class itself** (like `.animate-badge-pop` does), not via Tailwind utilities.

### NumberTicker for tangible numbers

The `NumberTicker` component (`~/components/landing/hero-demo/animations/number-ticker`) animates a number from 0 to a target value. Reuse it anywhere you want numbers to feel tangible:

```tsx
<NumberTicker value={283} duration={800} delay={460} />
```

Good for: loss counts in warning modals, usage statistics, pricing numbers.

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

# Composers Feature

Composers are rich-text documents that orchestrate multiple prompts into a single assembled output. Unlike prompts (system/user message pairs for a single LLM call), a composer is a free-form TipTap HTML document where you embed **prompt references** and **variable references** as inline badges. Running a composer executes all referenced prompts in parallel, then streams back the assembled document with static HTML and LLM-generated output interleaved.

## Architecture Overview

| Aspect | Prompts | Composers |
|--------|---------|-----------|
| Editor | Plain `<textarea>` | TipTap rich text (WYSIWYG) |
| Content format | Plain text templates | HTML with custom `<span>` node embeddings |
| Variables | `{{variable}}` mustache syntax | `VariableRefNode` — draggable inline badges |
| Prompt refs | N/A | `PromptRefNode` — inline badges linking to other prompts |
| Undo/redo | Zundo only | Dual: ProseMirror history for content; Zundo for schema/inputData |
| Right sidebar | Config, model, tokens, versions, test | Schema Builder, Input Data (JSON), Generated Code, Versions, Test |

## Database Schema

Migration: `migrations/drizzle/0019_add_composer_tables.sql`

| Table | Purpose |
|-------|---------|
| `composer_folder` | Org-scoped folder grouping (mirrors `snippet_folder`) |
| `composer` | Top-level record: name, description, folder_id, organization_id, deleted_at |
| `composer_version` | Versioned content: `content` (HTML), `config` (JSON), semver fields, published_at |
| `composer_version_prompt` | Junction: links version → prompt. `auto_update` flag, `prompt_version_id` (NULL=latest, pinned on publish) |

Key invariants:
- Only one draft per composer (where `published_at IS NULL`)
- Saving to a published version auto-creates a new draft
- Publishing pins all prompt version references to their current latest published version
- `prompt_id` FK is `ON DELETE RESTRICT` — can't delete a prompt referenced by a composer

## Directory Structure

```
app/components/composer-editor/
├── composer-editor.tsx         # Main TipTap editor component
├── composer-toolbar.tsx        # Overflow-responsive toolbar with priority system
├── extensions/
│   ├── index.ts                # getComposerExtensions() — all extension config
│   ├── prompt-ref-extension.ts # Custom inline atom: data-prompt-ref spans
│   ├── variable-ref-extension.ts # Custom inline atom: data-variable-ref spans
│   └── atom-gap-extension.ts   # ProseMirror plugin: drop targets between atoms
├── prompt-ref-badge.tsx        # NodeView renderer for prompt references
├── variable-ref-badge.tsx      # NodeView renderer for variable references
├── prompt-ref-picker.tsx       # Command popover to insert prompt refs
├── variable-ref-picker.tsx     # Command popover to insert variable refs
├── toolbar-*.tsx               # Toolbar sub-components (heading, list, marks, etc.)
└── index.ts                    # Re-exports ComposerEditor

app/stores/composer-editor-store.ts  # Zustand + Zundo temporal
app/hooks/use-composer-undo-redo.ts  # Keyboard undo/redo delegation
app/lib/validations/composer.ts      # Zod schemas
app/lib/composer-content-parser.ts   # Regex HTML parser (no DOM — Workers-safe)
app/lib/composer-junction-sync.server.ts # Syncs junction table on content save
```

## API Routes

All under `/api/composers/`:

| Route file | Purpose |
|------------|---------|
| `composers.create.ts` | Create composer + initial empty draft; redirect to `/composers/:id` |
| `composers.update.ts` | Update name/description |
| `composers.delete.ts` | Soft delete (owner-only) |
| `composers.save-content.ts` | Auto-save HTML; creates new draft if current is published; syncs junction table |
| `composers.save-config.ts` | Auto-save config JSON (schema + inputData); same draft logic |
| `composers.publish.ts` | Publish draft with semver; pins prompt version refs |
| `composers.run.ts` | Execute composer — resolve prompts, run LLMs in parallel, stream NDJSON |
| `composer-info.ts` | GET loader — name, folder, latest published version |

## Page Routes

| Route | File | Purpose |
|-------|------|---------|
| `/composers` | `composers.tsx` | List page with cards grid + folders |
| `/composers/:composerId` | `composers.composerId.tsx` | Detail page with editor |
| Layout | `layouts/composer-detail.tsx` | Resizable two-panel layout (editor + right sidebar) |

## TipTap Extensions

`getComposerExtensions()` in `extensions/index.ts` configures:

StarterKit (H1-H3, bold, italic, strike, code, blockquote, lists, hr, code block), Underline, TextStyle + Color, Highlight (multicolor), TextAlign, Link (openOnClick: false), Table + Row + Cell + Header (resizable), TaskList + TaskItem (nested), Placeholder, **PromptRefNode** (custom), **VariableRefNode** (custom), **AtomGap** (custom ProseMirror plugin)

### Custom Nodes

- **PromptRefNode**: Inline atom → `<span data-prompt-ref data-prompt-id="..." data-prompt-name="...">`. Command: `editor.commands.insertPromptRef({ promptId, promptName })`
- **VariableRefNode**: Inline atom → `<span data-variable-ref data-field-id="..." data-field-path="...">`. Command: `editor.commands.insertVariableRef({ fieldId, fieldPath })`
- **AtomGap**: ProseMirror `Decoration.widget` — inserts invisible spans between adjacent atoms for drag-and-drop targets

## Store (`composer-editor-store.ts`)

Zustand with Zundo temporal middleware. Key state: `content` (HTML), `schemaFields`, `inputData`, `inputDataRootName`, `testVersionOverride`.

Design decisions:
- `content` is **excluded from Zundo snapshots** — TipTap's ProseMirror history handles editor undo/redo
- `setContentFromRemote()` pauses temporal tracking to avoid WebSocket updates polluting undo history
- Temporal snapshots throttled at 500ms
- `initialize()` clears temporal history when navigating to a new composer

## Content Serialization

Content is stored as **HTML strings** (via `editor.getHTML()`). On the server, `composer-content-parser.ts` uses regex parsing (no DOM — Workers have no DOM API):
- `parseComposerContent(html)` → splits into `ComposerSegment[]` (`static` | `prompt`) at `data-prompt-ref` boundaries
- `replaceVariableRefs(html, inputData, rootName)` → interpolates variable spans with values from input data
- `extractPromptIds(html)` / `extractVariableIds(html)` — used for junction table sync

## Execution Flow (`composers.run.ts`)

1. Parse HTML into ordered segments (static / prompt)
2. Resolve each prompt's version (pinned > latest published > latest draft)
3. Run all prompts **in parallel** via `generateText()` from AI SDK
4. Stream assembled document as NDJSON in document order:
   - `{type:'static', content, index}` — HTML with variable refs already replaced
   - `{type:'prompt_ref', promptId, promptName, index}` — signals a prompt slot
   - `{type:'prompt_start', promptId}` → `{type:'prompt_chunk', promptId, chunk}` → `{type:'prompt_done', promptId}`
   - `{type:'complete', errors: []}`

Duplicate prompt IDs in the document share the same output (de-duplicated by `streamedPrompts` set).

## Toolbar Overflow System

The toolbar uses `useToolbarOverflow` (ResizeObserver-based) with priority levels. Items with `overflowPriority: Infinity` are pinned; others cascade into a `ToolbarOverflowMenu` (`...` button). "Add prompt" and "Add variable" buttons progressively collapse: text disappears → merge into single `ToolbarInsertPicker` sparkles button → overflow entirely.

## Version Suggestion Logic

When publishing, the suggested version auto-increments based on change type: schema changed → major bump (e.g., `2.0.0`), only content changed → minor bump (e.g., `1.1.0`).

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

# New User Signup Flow

When a new user signs up, the following happens in sequence:

1. **Form validation** — `signUpSchema` validates name, email, password, confirmPassword
2. **User creation** — `auth.api.signUpEmail()` creates the user record in Better Auth
3. **Stripe trial provisioning** (via `trial-stripe` plugin `databaseHooks.user.create.after`):
   - Creates a **Stripe customer** with user's email, name, and `userId` metadata
   - Creates a **Stripe subscription** on the Pro plan price with a 14-day trial (`trial_period_days: 14`)
   - Trial auto-cancels if no payment method is added (`missing_payment_method: 'cancel'`)
   - Stores the Stripe customer ID, subscription ID, price ID, and period timestamps in the local `subscription` table
4. **Organization creation** — Creates a default workspace (`"<Name>'s Workspace"`)
5. **Redirect** — User is redirected to `/dashboard` with session cookie

**Key file:** `app/routes/auth/sign-up.tsx` (action function)

The Stripe trial is created inside Better Auth's database hook, so it runs automatically for both email/password signups and social logins (Google).

**Exception: Invited users skip Stripe trial.** The `databaseHooks.user.create.after` hook checks the `invitation` table for a pending invitation matching the new user's email. If one exists, the hook returns early — no Stripe customer, subscription, or `subscription` row is created. Invited users join their inviter's organization and share that org's plan instead.

# Stripe Integration

## Overview

Stripe handles subscription billing via a custom Better Auth plugin (`trial-stripe`). Every new user who creates their own org gets a 14-day Pro trial with a real Stripe subscription - no payment method required upfront. Invited users (who join an existing org) are excluded from trial creation.

## Environment Variables

| Variable | Description |
|----------|-------------|
| `STRIPE_SECRET_KEY` | Stripe API secret key (test: `sk_test_...`, live: `sk_live_...`) |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret (`whsec_...`) |

Both are set in `.env` for local dev and in Cloudflare dashboard for production.

## Stripe Test Account

| Resource | ID |
|----------|----|
| **Product** (Promptly Pro) | `prod_TvT5WGDqvZ9udw` |
| **Price** ($29/mo) | `price_1Sxc9ULw9ky8dfhCmQI8Od59` |

## Plugin Architecture

The `trial-stripe` plugin is a custom Better Auth plugin at `app/plugins/trial-stripe/`.

```
app/plugins/trial-stripe/
├── index.ts          # Server plugin: databaseHooks + endpoint registration
├── client.ts         # Client plugin: typed authClient.subscription.* actions
├── schema.ts         # subscription table schema (disableMigration: true)
├── error-codes.ts    # Typed error codes via defineErrorCodes
├── types.ts          # TypeScript interfaces
└── routes/
    ├── status.ts     # GET  /subscription/status
    ├── upgrade.ts    # POST /subscription/upgrade
    ├── cancel.ts     # POST /subscription/cancel
    ├── portal.ts     # POST /subscription/portal
    └── webhook.ts    # POST /subscription/webhook
```

**Registration:**
- Server: `app/lib/auth.server.ts` — `trialStripe()` in the plugins array
- Client: `app/lib/auth.client.ts` — `trialStripeClient()` in the plugins array

All endpoints are served automatically via the existing `/api/auth/*` catch-all route (`app/routes/api/auth.ts`).

## Plugin Configuration

```typescript
trialStripe({
  stripeSecretKey: ctx.cloudflare.env.STRIPE_SECRET_KEY,
  stripeWebhookSecret: ctx.cloudflare.env.STRIPE_WEBHOOK_SECRET,
  trial: { days: 14, plan: 'pro' },
  freePlan: {
    name: 'free',
    limits: { prompts: 3, teamMembers: 1, apiCalls: 5000 },
  },
  plans: [
    {
      name: 'pro',
      priceId: 'price_1Sxc9ULw9ky8dfhCmQI8Od59',
      limits: { prompts: -1, teamMembers: 5, apiCalls: 50000 },
    },
  ],
})
```

`-1` means unlimited for that limit.

## API Endpoints

All endpoints are under `/api/auth/subscription/`:

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/subscription/status` | Session | Returns plan, status, trial days left, limits |
| POST | `/subscription/upgrade` | Session | Creates Stripe Checkout session, returns `{ url }` |
| POST | `/subscription/cancel` | Session | Sets `cancel_at_period_end: true` on Stripe sub |
| POST | `/subscription/portal` | Session | Creates Stripe billing portal session, returns `{ url }` |
| POST | `/subscription/webhook` | None | Handles Stripe webhook events |

## Client Usage

```typescript
import { authClient } from '~/lib/auth.client';

// Get subscription status
const { data } = await authClient.subscription.status();
// → { plan, status, isTrial, daysLeft, limits, cancelAtPeriodEnd }

// Upgrade (redirects to Stripe Checkout)
const { data } = await authClient.subscription.upgrade({
  plan: 'pro',
  successUrl: window.location.origin + '/dashboard?upgraded=true',
  cancelUrl: window.location.origin + '/settings',
});
window.location.href = data.url;

// Cancel subscription
await authClient.subscription.cancel();

// Open Stripe billing portal
const { data } = await authClient.subscription.portal({
  returnUrl: window.location.origin + '/settings',
});
window.location.href = data.url;
```

## Database Table

**Table:** `subscription` (migration: `0011_add_subscription_table.sql`)

| Column | Type | Description |
|--------|------|-------------|
| `id` | TEXT PK | nanoid |
| `user_id` | TEXT FK→user | One subscription per user |
| `plan` | TEXT | `'free'`, `'pro'`, etc. |
| `status` | TEXT | `'trialing'`, `'active'`, `'canceled'`, `'expired'`, `'past_due'` |
| `trial_start` | INTEGER | Trial start timestamp (ms) |
| `trial_end` | INTEGER | Trial end timestamp (ms) |
| `stripe_customer_id` | TEXT | Stripe customer ID (`cus_...`) |
| `stripe_subscription_id` | TEXT | Stripe subscription ID (`sub_...`) |
| `stripe_price_id` | TEXT | Stripe price ID (`price_...`) |
| `period_start` | INTEGER | Current billing period start (ms) |
| `period_end` | INTEGER | Current billing period end (ms) |
| `cancel_at_period_end` | INTEGER | 0 or 1 |
| `created_at` | INTEGER | Record creation timestamp (ms) |
| `updated_at` | INTEGER | Last update timestamp (ms) |

## Webhook Events Handled

| Stripe Event | Action |
|-------------|--------|
| `checkout.session.completed` | Set status to `active`, store Stripe IDs, map priceId to plan |
| `customer.subscription.updated` | Sync status, period, plan, cancelAtPeriodEnd |
| `customer.subscription.deleted` | Set status to `canceled`, revert to free plan |

## Key Design Decisions

- **Stripe customer + trial created on signup (org creators only)** — Users who sign up directly get a real Stripe subscription in `trialing` status. Invited users are detected via a pending `invitation` record matching their email and skip trial creation entirely. If no payment method is added, Stripe auto-cancels after the trial.
- **Lazy trial expiration** — No cron job. The `/subscription/status` endpoint checks if `trialEnd < now` and updates to `expired` on read.
- **Workers compatibility** — Stripe SDK uses `Stripe.createFetchHttpClient()` for HTTP and `Stripe.createSubtleCryptoProvider()` for webhook signature verification (async `crypto.subtle`).
- **Stripe v20** — Subscription period dates are on `items.data[0].current_period_start/end` (not on the subscription object directly).

## Local Development with Stripe CLI

Forward Stripe webhooks to local dev server:

```bash
stripe listen --forward-to localhost:5173/api/auth/subscription/webhook
```

The CLI outputs a webhook signing secret (`whsec_...`) — put this in `STRIPE_WEBHOOK_SECRET` in `.env`.

## Adding a New Plan

1. Create product + price in Stripe Dashboard (or via API)
2. Add to the `plans` array in `app/lib/auth.server.ts`:
   ```typescript
   { name: 'team', priceId: 'price_xxx', limits: { prompts: -1, teamMembers: -1, apiCalls: -1 } }
   ```
3. Optionally add `yearlyPriceId` for annual billing

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
| `STRIPE_SECRET_KEY` | From Stripe Dashboard | `sk_test_...` or `sk_live_...` |
| `STRIPE_WEBHOOK_SECRET` | From Stripe CLI or Dashboard | `whsec_...` |

### OAuth Configuration (Google Console)
- Authorized redirect URI: `https://app.promptlycms.com/api/auth/callback/google`

## Common Deployment Issues

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

# Enterprise Plan

## Overview
Enterprise is the highest tier with no resource restrictions (all limits `-1`). Enterprise subscriptions are manually provisioned — no Stripe checkout flow exists yet.

## Provisioning
Manually UPDATE an existing org's subscription row in D1:

```sql
UPDATE subscription
SET plan = 'enterprise', status = 'active', updated_at = <timestamp_ms>
WHERE organization_id = '<org_id>';
```

## Future Stripe Connection
The enterprise plan has a placeholder `priceId` (`enterprise_placeholder`) in `auth.server.ts`. When connecting to Stripe:
1. Create a Stripe product + price for Enterprise
2. Replace `enterprise_placeholder` with the real price ID
3. Build upgrade UI if needed

## Plan Limits
| Plan | Prompts | Team Members | API Calls |
|------|---------|-------------|-----------|
| Free | 3 | 1 | 5,000/mo |
| Pro | Unlimited | 5 | 50,000/mo |
| Enterprise | Unlimited | Unlimited | Unlimited |

## Frontend Behavior
- Enterprise users see a gold/amber "ENTERPRISE" badge in the sidebar
- No upsell CTAs, upgrade modals, trial banners, or interstitial modals
- Settings > Billing shows a minimal "Enterprise Plan" card with no usage stats or plan comparison

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
