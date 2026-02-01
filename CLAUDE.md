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
- Production URL: https://promptlycms.com
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
├── animated-wrapper.tsx      # Scroll-triggered fade-in
├── social-proof-badge.tsx    # Avatar stack + rating
├── navigation.tsx
├── pain-points-section.tsx
├── solution-section.tsx
├── features-grid-section.tsx
├── how-it-works-section.tsx
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
@keyframes fade-in-up      /* Section entrance */
@keyframes fade-in-left    /* Section entrance */
@keyframes fade-in-right   /* Section entrance */
@keyframes badge-pop       /* Variable badges: scale 0→1.15→1 */
@keyframes dropdown-slide  /* Dropdown: translateY(-8px)→0 */
@keyframes confetti-fall   /* Particle trajectory */
@keyframes label-enter     /* Label bounce in */
@keyframes label-exit      /* Label scale out */
@keyframes blink           /* Cursor blinking */
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
