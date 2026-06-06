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
- **Always look up documentation** when unsure about APIs - don't guess. Use web search for official docs.
- **Always research suggestions** before dismissing them - verify current browser support and best practices via web search before adding ignore comments or workarounds.

# Testing Requirements
- **All tests must pass** before completing any feature: `bun run lint`, `bun run typecheck`, and `bun run test:e2e`
- Fix lint errors as you go - don't accumulate technical debt
- **Add e2e tests** for: critical user flows, complex interactions, regression-prone features
- **Skip e2e tests** for: simple UI changes, internal refactors, already-covered features

# React Patterns
- Avoid `useEffect` wherever possible - it causes unintended bugs
- Use ref callbacks for DOM-related side effects (focus, scroll, measurements) instead of `useRef` + `useEffect`
- Prefer event-driven patterns (e.g., `useDebouncedCallback` over debounced values with useEffect)
- Use `useSyncExternalStore` for external state synchronization
- Use Navigation API listeners, event handlers, and other non-effect patterns when possible

# Routing
- Routes are explicitly configured in `app/routes.ts` (not auto-discovered from file names)
- App routes (authenticated pages) go inside the `layout('./routes/layouts/app.tsx', [...])` block
- Route types are auto-generated at `./+types/{routeName}` after adding to routes.ts

# File Naming Conventions
- **API routes**: `app/routes/api/[resource].[action].ts` (e.g., `prompts.create.ts`)
- **Page routes with params**: `[routeName].$paramName.tsx` (e.g., `invite.$id.tsx`)
- **Validation schemas**: `app/lib/validations/[feature].ts`
- **Server-only code**: `*.server.ts`; **Client-only code**: `*.client.ts`
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
Light, Dark, and System modes via a theme switcher in the user dropdown menu.
- Uses `remix-themes`; theme stored in **cookies** (not localStorage) for SSR
- Server reads cookie and renders correct `class` on `<html>`; `PreventFlashOnWrongTheme` prevents flash
- `useTheme` hook in `app/hooks/use-dark-mode.ts` provides `{ theme, isDark, setTheme }`
- Key files: `app/sessions.server.ts` (cookie storage), `app/routes/api/set-theme.ts` (action), `app/root.tsx` (ThemeProvider)

**Testing UI in both modes:** Cookie-based themes mean `emulate({ colorScheme: 'dark' })` in Chrome DevTools will NOT work. Instead:
1. Toggle theme via the user dropdown menu (requires login), or
2. Inject the class via DevTools: `document.documentElement.classList.add('dark')` / `.remove('dark')`
3. Check contrast, readability, and visual consistency in both modes

# Testing
- Test user: test@promptlycms.com / Testing123
- Local dev server: http://localhost:5173
- App URL: https://app.promptlycms.com | Landing page: https://promptlycms.com
- To test prompts: "Create" button in the sidebar or navigate to /prompts

# Database & Migrations
- Migrations live in `migrations/drizzle/`
- Apply: `bunx wrangler d1 migrations apply promptly --local` (or `--remote`)
- Local D1 database is in `.wrangler/state/v3/d1/` (not `migrations/local.db`)
- Better Auth uses Kysely with CamelCasePlugin - table names become lowercase (`apiKey` → `apikey`)
- Column names use snake_case in the database (`userId` → `user_id`)

# Common Utilities
- **ID generation**: `nanoid()` from `nanoid`
- **Auth helpers**: `getAuth(context)` from `~/lib/auth.server`
- **Class merging**: `cn()` from `~/lib/utils` (clsx + tailwind-merge)

# Common Gotchas
- This is React Router 7, NOT Next.js - don't use Next.js patterns
- D1 uses prepared statements with `.bind()` - don't interpolate SQL
- Better Auth MCP server is available for auth-related questions
- Always check `session?.user` before accessing user data
- Form actions use `FormData`, not JSON bodies

# Cost Calculator Feature

The cost calculator popover (`app/components/cost-calculator-popover.tsx`) estimates LLM API costs based on model, token counts, and user preferences.

## Files
- `app/lib/model-pricing.ts` - Model pricing data (input/cached/output prices per 1M tokens)
- `app/lib/currency.ts` - Currency conversion using Frankfurter API
- `app/lib/token-counter.ts` - Token counting (tiktoken for OpenAI, estimates for others)

## Updating Model Prices
Edit the `MODEL_PRICING` object in `app/lib/model-pricing.ts`. Prices are USD per 1M tokens:

```typescript
'model-id': {
  id: 'model-id',
  displayName: 'Model Name',
  provider: 'openai' | 'anthropic' | 'google',
  inputPrice: 2.50,
  cachedInputPrice: 1.25,
  outputPrice: 10.00,
},
```

Price sources: [llm-prices.com](https://www.llm-prices.com/)

## Adding a New Model (Full Process)

Use the `/project:update-models` slash command for a guided walkthrough. Steps:

1. **Research**: Verify the AI SDK model ID at https://github.com/vercel/ai (check PRs and provider source)
2. **Package update**: `bun update @ai-sdk/<provider>` if the model is very new
3. **Pricing entry**: Add to `MODEL_PRICING` in `app/lib/model-pricing.ts`
4. **SDK mapping**: Add display-ID → SDK-ID mapping in `app/lib/model-dispatch.server.ts` (Anthropic uses dots in display IDs but hyphens in SDK IDs)
5. **Landing page**: Update hardcoded model names if the new model replaces the flagship
6. **Automated checks**: `bun run lint:fix`, `bun run typecheck`, `bun run test:e2e`
7. **Browser verification**: Add the model via Settings > LLM API Keys (provider key from `.env`), test a prompt to confirm streaming, verify cost calculator math

### Files that need manual edits
| File | What to add |
|------|-------------|
| `app/lib/model-pricing.ts` | Pricing entry in `MODEL_PRICING` |
| `app/lib/model-dispatch.server.ts` | SDK ID mapping in `MODEL_ID_MAP` (if IDs differ) |
| `app/components/landing/hero-demo/demo-editor-window.tsx` | Model badge text (if flagship) |
| `app/components/landing/how-it-works/static-editor-window.tsx` | Model badge text (if flagship) |
| `app/lib/landing-data.ts` | Model names in FAQ copy (if flagship) |

### Files that auto-derive (no edits needed)
`select-scrollable.tsx`, `cost-calculator-popover.tsx`, `create-llm-api-key-dialog.tsx`, `sidebar-right.tsx`

## Token Counting
Character-based estimation is a fallback; accurate values come from the AI SDK response after running a test.
- **OpenAI**: ~4 chars/token, **Anthropic**: ~3.5 chars/token, **Google**: ~4 chars/token

## Currency Conversion
- Frankfurter API (free, no key): `https://api.frankfurter.dev/v1/latest?base=USD`
- Rates cached in localStorage for 24 hours; locale currency detected via `Intl.NumberFormat`

## Technical Notes
- `useSyncExternalStore` for localStorage rate subscription (with object caching to prevent re-renders)
- Model selector auto-syncs with sidebar selection from `usePromptEditorStore`
- "Use cached input pricing" checkbox defaults ON for System Prompt, OFF for User Prompt

# E2E Testing

Playwright with Chromium only. **Dev server must be running** (`bun run dev`) before tests.

- `bun run test:e2e` - headless | `test:e2e:ui` - Playwright UI | `test:e2e:headed` - visible browser

## Structure
- `e2e/tests/` - test files (*.spec.ts)
- `e2e/fixtures/base.ts` - auth fixture with login helper
- `e2e/helpers/test-data.ts` - test credentials & constants

## Writing Tests
- Import `test` and `expect` from `../fixtures/base`
- Use `authenticatedPage` fixture for tests requiring login
- **Avoid `describe` blocks** - each test self-contained and independent
- **No shared state** - no `beforeEach` or mutable variables across tests
- See: https://kentcdodds.com/blog/avoid-nesting-when-youre-testing

```typescript
import { test, expect } from '../fixtures/base';

test('example test', async ({ authenticatedPage }) => {
  // authenticatedPage is already logged in
  await expect(authenticatedPage).toHaveURL(/dashboard/);
});
```

## Waiting for Form Submissions
**DO NOT use `waitForResponse` with URL pattern matching** - unreliable because React Router 7 form submissions use `?_data=...` query params (not `.data` suffix), and the `actionTimeout` (15000ms) gets applied instead of default timeout.

**Instead, wait for UI state changes:**
```typescript
await submitButton.click();
// Wait for dialog to close (form submission completed)
await expect(dialog).not.toBeVisible({ timeout: 30000 });
// Or wait for navigation
await page.waitForURL(/\/prompts\/[a-zA-Z0-9_-]+$/, { timeout: 30000 });
```

# Landing Page

The landing page (`app/routes/landing.tsx`) is a marketing page with complex animations. Components live in `app/components/landing/`.

## Key Components
- `hero-section.tsx` — two-column hero: animated copy (left, `AnimatedWrapper` with staggered 0–400ms delays) + `HeroDemoStack` (right)
- `hero-demo/` — 4-window rotating carousel (`hero-demo-stack.tsx` orchestrator, `demo-window-frame.tsx` chrome, editor/testing/ide/output windows, `animations/` helpers: `typing-text`, `code-block`, `variable-badge`, `confetti-burst`, `number-ticker`, `blinking-cursor`)
- `how-it-works/` — 3-step workflow: `how-it-works-step.tsx` card; visuals selected by `visual` field: `'editor'` → `StaticEditorWindow`, `'code'` → `StaticIdeWindow`, `'iterate'` → `AnimatedVersionHistory`
- `solution-section.tsx` — tabs: For Editors → `collaborative-editor-demo.tsx` (multi-cursor typing demo), For Developers → `multi-language-ide-demo.tsx` (TS/Python/Go/Swift tabs), For Business → static cost visualization. Demos receive `isVisible` from parent tab state
- `animated-wrapper.tsx` — scroll-triggered fade-in
- Section components: navigation, pain-points, features-grid, audience, cost, social-proof, pricing, faq, footer

## Hero Demo Stack (Window Carousel)

**File:** `app/components/landing/hero-demo/hero-demo-stack.tsx`

Windows are layered with CSS transforms by position: front `scale(1) rotate(0°)`, back-right `scale(0.92) rotate(2°)`, back-left `scale(0.88) rotate(-2°)`, hidden `scale(0.84)`. Transitions use `duration-500 ease-out`.

Timing constants:
```typescript
WINDOW_DURATION = 10500   // each window active 10.5s
FINAL_WINDOW_PAUSE = 2000 // extra pause after output window
WINDOW_COUNT = 4
```

Cycle (~45s): Editor (typing + variable badges) → Testing (dropdown selections → run → output) → IDE (code typing, syntax highlighting) → Output (word streaming at 67ms intervals + `NumberTicker` cost + `ConfettiBurst`).

State: `activeIndex` (window at position 0), `isPaused` (pauses on hover). Position = `(windowIndex - activeIndex + WINDOW_COUNT) % WINDOW_COUNT`. When a window becomes inactive it resets internal state after 600ms (lets exit animations complete). Windows receive `isActive` and signal completion via `onComplete`.

Typing speeds: editor 40ms/char, IDE `CodeBlock` 24ms/char (adjust via `charDelay` prop).

## Animation Utilities

### NumberTicker (`hero-demo/animations/number-ticker.tsx`)
Animates a number from `from` (default 0) to `value` with `delay`/`duration` (default 1000ms) props, using `requestAnimationFrame` with ease-out-cubic. Reuse anywhere numbers should feel tangible (loss counts in warning modals, usage stats, pricing):
```tsx
<NumberTicker value={283} duration={800} delay={460} />
```

### AnimatedWrapper (`animated-wrapper.tsx`)
```tsx
<AnimatedWrapper delay={100} direction="up">{content}</AnimatedWrapper>
```
Directions: `up` (default), `left`, `right`. Uses `useInView` with IntersectionObserver, `triggerOnce: true`.

### useInView Hook (`app/hooks/use-in-view.ts`)
Uses **ref callback pattern** (not useEffect):
```tsx
const { ref, isInView } = useInView({ threshold: 0.1, triggerOnce: true });
```

## CSS Animations

**File:** `app/app.css`

Key keyframes: `fade-in-up`, `fade-in-left`, `fade-in-right`, `badge-pop` (bouncy scale 0→1.15→1), `dropdown-slide`, `confetti-fall`, `label-enter`/`label-exit`, `blink`, `version-slide-in`, `live-pulse`, `step-activate`, `pulse-glow-red` (urgency CTAs).

### Reusable animation classes
- `.animate-fade-in-up` — 0.6s ease-out, use with `opacity-0` initial state
- `.animate-badge-pop` — Bouncy scale entrance. **Initial state is built into the class** (`transform: scale(0); opacity: 0;`), so do NOT add Tailwind `opacity-0` or `scale-0` alongside it
- `.animate-pulse-glow-red` — Red pulsing glow for urgent CTAs

### Staggered entrance pattern for modals/dialogs

Use for orchestrated modal entrances (see `trial-expiry-modal.tsx`, `upgrade-gate-modal.tsx`):

```typescript
const stagger = (base: number, i: number, step = 60) => ({
  animationDelay: `${base + i * step}ms`,
  animationFillMode: 'forwards' as const,
});

// Elements start invisible, animate in with increasing delays
<div className="opacity-0 animate-fade-in-up" style={stagger(80, 0)}>Title</div>
{items.map((item, i) => (
  <div className="opacity-0 animate-fade-in-up" style={stagger(400, i)}>...</div>
))}
```

Example timing map (trial expiry modal): 0ms icon badge-pop → 80ms title → 160ms description → 300ms date pill → 400ms+ content items (60ms each) → 700ms CTA → 800ms secondary CTA.

### CSS animation gotcha: Tailwind utilities vs `animation-fill-mode: forwards`

**CRITICAL**: Never combine Tailwind utilities (`opacity-0`, `scale-0`) with CSS animations using `forwards` fill mode if the animation changes the same property via `transform`. Tailwind utilities can override the animation's final state.

```tsx
// WRONG: Tailwind's opacity-0/scale-0 fight the animation's final state
<div className="opacity-0 scale-0 animate-badge-pop" style={stagger(0, 0)}>

// RIGHT for fade-in-up (animates opacity directly; forwards holds final state)
<div className="opacity-0 animate-fade-in-up" style={stagger(80, 0)}>

// RIGHT for badge-pop (initial state baked into the CSS class — no utilities needed)
<div className="animate-badge-pop" style={stagger(0, 0)}>
```

**Why:** `animate-fade-in-up` animates `opacity` as a property, so the animation's `forwards` fill overrides Tailwind's `opacity-0`. But `animate-badge-pop` uses `transform: scale()` in keyframes — Tailwind's `scale-0` uses the separate `scale` CSS property, so they don't interact and the animation can't override it.

**Rule of thumb:** If a CSS animation class needs specific initial state, define it **in the CSS class itself** (like `.animate-badge-pop`), not via Tailwind utilities.

## Making Changes Safely
- **New section**: create component in `app/components/landing/`, add to `app/routes/landing.tsx`, wrap in `AnimatedWrapper`
- **New animation**: define keyframes in `app/app.css`, add Tailwind animation class there, apply conditionally
- **Timing**: `WINDOW_DURATION` in `hero-demo-stack.tsx`; `duration-500` classes for transitions; `charDelay` for typing; `duration`/`delay` props for NumberTicker
- Performance: `triggerOnce` prevents re-triggering; carousel pauses on hover; clean up all timeouts on unmount; use GPU-accelerated transforms

## Mobile Overflow Prevention

Multiple layers prevent horizontal scrolling on mobile (especially iOS Safari):
- Root level (`app/app.css`): `html, body { overflow-x: hidden; }`
- Page level (`landing.tsx`): `<div className="min-h-screen bg-background overflow-x-hidden">`

**Common culprits:** large background blur elements with fixed widths (e.g., `w-[600px]`); code blocks with `overflow-x-auto` (use `overflow-hidden` for demo code); uncontained absolute/fixed positioned elements.

**Testing:**
```js
// Run in Chrome DevTools at 375px width
const hasOverflow = document.documentElement.scrollWidth > document.documentElement.clientWidth;
```
Checklist: test at 375px and 320px, both light and dark modes, scroll entire page — no horizontal scroll possible.

# Composers Feature

Composers are rich-text documents that orchestrate multiple prompts into a single assembled output. Unlike prompts (system/user message pairs for one LLM call), a composer is a free-form TipTap HTML document embedding **prompt references** and **variable references** as inline badges. Running a composer executes all referenced prompts in parallel, then streams back the assembled document with static HTML and LLM output interleaved.

## Architecture Overview

| Aspect | Prompts | Composers |
|--------|---------|-----------|
| Editor | Plain `<textarea>` | TipTap rich text (WYSIWYG) |
| Content format | Plain text templates | HTML with custom `<span>` node embeddings |
| Variables | `{{variable}}` mustache | `VariableRefNode` — draggable inline badges |
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
| `composer_version_prompt` | Junction: version → prompt. `auto_update` flag, `prompt_version_id` (NULL=latest, pinned on publish) |

Key invariants:
- Only one draft per composer (where `published_at IS NULL`)
- Saving to a published version auto-creates a new draft
- Publishing pins all prompt version references to their current latest published version
- `prompt_id` FK is `ON DELETE RESTRICT` — can't delete a prompt referenced by a composer

## Key Files

- `app/components/composer-editor/` — `composer-editor.tsx` (main TipTap component), `composer-toolbar.tsx` (overflow-responsive toolbar), `extensions/` (`index.ts` with `getComposerExtensions()`, `prompt-ref-extension.ts`, `variable-ref-extension.ts`, `atom-gap-extension.ts`), badge NodeViews (`prompt-ref-badge.tsx`, `variable-ref-badge.tsx`), insert pickers, `toolbar-*.tsx` sub-components
- `app/stores/composer-editor-store.ts` — Zustand + Zundo temporal
- `app/hooks/use-composer-undo-redo.ts` — keyboard undo/redo delegation
- `app/lib/validations/composer.ts` — Zod schemas
- `app/lib/composer-content-parser.ts` — regex HTML parser (no DOM — Workers-safe)
- `app/lib/composer-junction-sync.server.ts` — syncs junction table on content save

## API Routes (`/api/composers/`)

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

Page routes: `/composers` (`composers.tsx` list page), `/composers/:composerId` (`composers.composerId.tsx`), layout `layouts/composer-detail.tsx` (resizable two-panel: editor + right sidebar).

## TipTap Extensions

`getComposerExtensions()` configures: StarterKit (H1-H3, bold, italic, strike, code, blockquote, lists, hr, code block), Underline, TextStyle + Color, Highlight (multicolor), TextAlign, Link (openOnClick: false), Table (resizable), TaskList + TaskItem (nested), Placeholder, plus custom nodes:

- **PromptRefNode**: Inline atom → `<span data-prompt-ref data-prompt-id="..." data-prompt-name="...">`. Command: `editor.commands.insertPromptRef({ promptId, promptName })`
- **VariableRefNode**: Inline atom → `<span data-variable-ref data-field-id="..." data-field-path="...">`. Command: `editor.commands.insertVariableRef({ fieldId, fieldPath })`
- **AtomGap**: ProseMirror `Decoration.widget` — invisible spans between adjacent atoms for drag-and-drop targets

## Store (`composer-editor-store.ts`)

Zustand with Zundo temporal middleware. Key state: `content` (HTML), `schemaFields`, `inputData`, `inputDataRootName`, `testVersionOverride`.

- `content` is **excluded from Zundo snapshots** — TipTap's ProseMirror history handles editor undo/redo
- `setContentFromRemote()` pauses temporal tracking to avoid WebSocket updates polluting undo history
- Temporal snapshots throttled at 500ms
- `initialize()` clears temporal history when navigating to a new composer

## Content Serialization

Content is stored as **HTML strings** (`editor.getHTML()`). On the server, `composer-content-parser.ts` uses regex parsing (Workers have no DOM API):
- `parseComposerContent(html)` → splits into `ComposerSegment[]` (`static` | `prompt`) at `data-prompt-ref` boundaries
- `replaceVariableRefs(html, inputData, rootName)` → interpolates variable spans from input data
- `extractPromptIds(html)` / `extractVariableIds(html)` — junction table sync

## Execution Flow (`composers.run.ts`)

1. Parse HTML into ordered segments (static / prompt)
2. Resolve each prompt's version (pinned > latest published > latest draft)
3. Run all prompts **in parallel** via `generateText()` from AI SDK
4. Stream assembled document as NDJSON in document order: `{type:'static', content, index}`, `{type:'prompt_ref', promptId, promptName, index}`, then `prompt_start` → `prompt_chunk` → `prompt_done` per prompt, finally `{type:'complete', errors: []}`

Duplicate prompt IDs in the document share the same output (de-duplicated by `streamedPrompts` set).

## Toolbar Overflow System

`useToolbarOverflow` (ResizeObserver-based) with priority levels. Items with `overflowPriority: Infinity` are pinned; others cascade into a `ToolbarOverflowMenu` (`...` button). "Add prompt"/"Add variable" buttons progressively collapse: text disappears → merge into single `ToolbarInsertPicker` sparkles button → overflow entirely.

## Version Suggestion Logic

On publish, suggested version auto-increments by change type: schema changed → major bump (`2.0.0`), only content changed → minor bump (`1.1.0`).

# Authentication

## Password Hashing
Uses **PBKDF2** (not Better Auth's default Scrypt):
- **File**: `app/lib/password.server.ts`
- **Format**: `saltHex:hashHex` (97 characters total)
- **Algorithm**: PBKDF2 with SHA-256, 100,000 iterations

### Legacy Password Migration
Users with legacy Scrypt hashes see "Invalid password" errors; logs show `Legacy Scrypt hash detected - user needs password reset`.

**Fix**: Update the hash in the `account` table:
```sql
UPDATE account SET password = '<new_pbkdf2_hash>'
WHERE user_id = (SELECT id FROM user WHERE email = '<user_email>')
AND provider_id = 'credential';
```
Generate a new PBKDF2 hash via Node.js Web Crypto API (see `password.server.ts` for the algorithm).

## Better Auth Internal API
- `auth.api.signInEmail()` returns cookies via `response.headers.get('set-cookie')`
- Social login (Google): cookies are set by the callback endpoint `/api/auth/callback/google`
- Password column is in the `account` table, NOT the `user` table

## Debugging Auth Issues
1. Check Cloudflare Worker logs for Better Auth errors
2. Verify `BETTER_AUTH_URL` has no leading/trailing spaces
3. Check password hash format (`saltHex:hashHex`, ~97 chars)
4. For OAuth: verify redirect URIs match exactly in Google Console

# New User Signup Flow

On signup (key file: `app/routes/auth/sign-up.tsx` action):

1. **Form validation** — `signUpSchema` validates name, email, password, confirmPassword
2. **User creation** — `auth.api.signUpEmail()`
3. **Stripe trial provisioning** (via `trial-stripe` plugin `databaseHooks.user.create.after`): creates Stripe customer (with `userId` metadata) + subscription on the Pro price with a 14-day trial (`trial_period_days: 14`, `missing_payment_method: 'cancel'`); stores Stripe IDs and period timestamps in the local `subscription` table
4. **Organization creation** — default workspace (`"<Name>'s Workspace"`)
5. **Redirect** — to `/dashboard` with session cookie

The Stripe trial runs in Better Auth's database hook, so it applies to both email/password and Google signups.

**Exception: Invited users skip Stripe trial.** The hook checks the `invitation` table for a pending invitation matching the new user's email; if found, it returns early — no Stripe customer/subscription/`subscription` row. Invited users join their inviter's org and share that org's plan.

# Stripe Integration

Stripe handles subscription billing via a custom Better Auth plugin (`trial-stripe`). New org-creating users get a 14-day Pro trial with a real Stripe subscription, no payment method required. Invited users are excluded.

## Environment Variables
`STRIPE_SECRET_KEY` (`sk_test_...`/`sk_live_...`) and `STRIPE_WEBHOOK_SECRET` (`whsec_...`) — in `.env` locally, Cloudflare dashboard in production.

## Stripe Test Account
- **Product** (Promptly Pro): `prod_TvT5WGDqvZ9udw`
- **Price** ($29/mo): `price_1Sxc9ULw9ky8dfhCmQI8Od59`

## Plugin Architecture

Custom Better Auth plugin at `app/plugins/trial-stripe/`:
- `index.ts` — server plugin: databaseHooks + endpoint registration
- `client.ts` — client plugin: typed `authClient.subscription.*` actions
- `schema.ts` — subscription table schema (disableMigration: true)
- `error-codes.ts`, `types.ts`
- `routes/` — `status.ts`, `upgrade.ts`, `cancel.ts`, `portal.ts`, `webhook.ts`

**Registration:** server in `app/lib/auth.server.ts` (`trialStripe()` in plugins array); client in `app/lib/auth.client.ts` (`trialStripeClient()`). Endpoints are served via the `/api/auth/*` catch-all route (`app/routes/api/auth.ts`).

## Plugin Configuration

```typescript
trialStripe({
  stripeSecretKey: ctx.cloudflare.env.STRIPE_SECRET_KEY,
  stripeWebhookSecret: ctx.cloudflare.env.STRIPE_WEBHOOK_SECRET,
  trial: { days: 14, plan: 'pro' },
  freePlan: { name: 'free', limits: { prompts: 3, teamMembers: 1, apiCalls: 5000 } },
  plans: [
    { name: 'pro', priceId: 'price_1Sxc9ULw9ky8dfhCmQI8Od59', limits: { prompts: -1, teamMembers: 5, apiCalls: 50000 } },
  ],
})
```

`-1` means unlimited.

## API Endpoints (`/api/auth/subscription/`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/subscription/status` | Session | Plan, status, trial days left, limits |
| POST | `/subscription/upgrade` | Session | Creates Stripe Checkout session, returns `{ url }` |
| POST | `/subscription/cancel` | Session | Sets `cancel_at_period_end: true` |
| POST | `/subscription/portal` | Session | Creates billing portal session, returns `{ url }` |
| POST | `/subscription/webhook` | None | Handles Stripe webhook events |

## Client Usage

```typescript
import { authClient } from '~/lib/auth.client';

const { data } = await authClient.subscription.status();
// → { plan, status, isTrial, daysLeft, limits, cancelAtPeriodEnd }

// Upgrade / portal return { url } — redirect with window.location.href = data.url
await authClient.subscription.upgrade({ plan: 'pro', successUrl, cancelUrl });
await authClient.subscription.portal({ returnUrl });
await authClient.subscription.cancel();
```

## Database Table

**Table:** `subscription` (migration: `0011_add_subscription_table.sql`). Columns: `id` (TEXT PK, nanoid), `user_id` (FK→user, one subscription per user), `plan` (`'free'`/`'pro'`/...), `status` (`'trialing'`/`'active'`/`'canceled'`/`'expired'`/`'past_due'`), `trial_start`/`trial_end` (ms), `stripe_customer_id`/`stripe_subscription_id`/`stripe_price_id`, `period_start`/`period_end` (ms), `cancel_at_period_end` (0/1), `created_at`/`updated_at` (ms).

## Webhook Events Handled
- `checkout.session.completed` → status `active`, store Stripe IDs, map priceId to plan
- `customer.subscription.updated` → sync status, period, plan, cancelAtPeriodEnd
- `customer.subscription.deleted` → status `canceled`, revert to free plan

## Key Design Decisions
- **Stripe customer + trial created on signup (org creators only)** — invited users detected via pending `invitation` record and skipped. No payment method → Stripe auto-cancels after trial.
- **Lazy trial expiration** — no cron job; `/subscription/status` checks `trialEnd < now` and updates to `expired` on read.
- **Workers compatibility** — Stripe SDK uses `Stripe.createFetchHttpClient()` and `Stripe.createSubtleCryptoProvider()` (async `crypto.subtle` webhook verification).
- **Stripe v20** — subscription period dates are on `items.data[0].current_period_start/end` (not on the subscription object).

## Local Development with Stripe CLI
```bash
stripe listen --forward-to localhost:5173/api/auth/subscription/webhook
```
The CLI outputs a `whsec_...` secret — put it in `STRIPE_WEBHOOK_SECRET` in `.env`.

## Adding a New Plan
1. Create product + price in Stripe Dashboard (or API)
2. Add to `plans` array in `app/lib/auth.server.ts`: `{ name: 'team', priceId: 'price_xxx', limits: {...} }`
3. Optionally add `yearlyPriceId` for annual billing

# Deployment

## Architecture

| Service | URL | Platform | Project Name |
|---------|-----|----------|--------------|
| **App** | https://app.promptlycms.com | Cloudflare Workers | `promptly` |
| **Landing Page** | https://promptlycms.com | Cloudflare Pages (prerendered static) | `promptly-landing-pages` |

## Quick Deploy (Both Services)

```bash
bun run build
wrangler deploy                  # deploy app to Workers
bunx wrangler dev                # in one terminal
bun run prerender                # in another terminal
cp build/client/index.html landing-pages/
cp -r build/client/assets landing-pages/
bunx wrangler pages deploy landing-pages/ --project-name=promptly-landing-pages
```

## App Deployment (Workers)
- Pre-deploy: `bun run lint`, `bun run typecheck`, `bun run test:e2e` (dev server running)
- Deploy: `bun run deploy` (runs `bun run build && wrangler deploy`)
- Post-deploy: test login at https://app.promptlycms.com/login, test Google SSO, check Worker logs

## Landing Page Deployment (Pages)

**IMPORTANT: Always pre-render from local wrangler dev, never from production.** The production URL serves the Pages static site (circular), and Cloudflare edge features (e.g. Rocket Loader) can mangle script tags and break the pre-rendered HTML.

Files in `landing-pages/`: `index.html` (gitignored), `assets/` (gitignored), `_headers` (tracked — caching config: `s-maxage=3600`, `stale-while-revalidate=86400`), `favicon.ico` (gitignored).

## Environment Variables (Workers)

| Variable | Value | Notes |
|----------|-------|-------|
| `BETTER_AUTH_URL` | `https://app.promptlycms.com` | No trailing slash, no leading spaces |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | From Google Console | OAuth |
| `STRIPE_SECRET_KEY` | From Stripe Dashboard | `sk_test_...` or `sk_live_...` |
| `STRIPE_WEBHOOK_SECRET` | From Stripe CLI or Dashboard | `whsec_...` |

OAuth redirect URI (Google Console): `https://app.promptlycms.com/api/auth/callback/google`

## Common Deployment Issues
- **OAuth redirect_uri mismatch**: `BETTER_AUTH_URL` wrong or has extra spaces — check Cloudflare env var, ensure exact match with Google Console
- **Cookies not being set**: usually auth actually failed — check Better Auth logs (often password-related)
- **Landing page shows old content**: rebuild, re-run `bun run prerender` from local wrangler dev, redeploy Pages
- **Landing page blank / dark mode broken**: pre-rendered HTML has broken `<script>` tags (Rocket Loader). Disable Rocket Loader in Cloudflare dashboard (Speed > Optimization), re-prerender from local, redeploy
- **Pages deploy fails**: run `bunx wrangler login`, verify project name is `promptly-landing-pages`

# Enterprise Plan

Highest tier, no resource restrictions (all limits `-1`). Manually provisioned — no Stripe checkout flow yet.

## Provisioning
```sql
UPDATE subscription
SET plan = 'enterprise', status = 'active', updated_at = <timestamp_ms>
WHERE organization_id = '<org_id>';
```

## Future Stripe Connection
Placeholder `priceId` (`enterprise_placeholder`) in `auth.server.ts`. To connect: create Stripe product + price, replace the placeholder, build upgrade UI if needed.

## Plan Limits
| Plan | Prompts | Team Members | API Calls |
|------|---------|-------------|-----------|
| Free | 3 | 1 | 5,000/mo |
| Pro | Unlimited | 5 | 50,000/mo |
| Enterprise | Unlimited | Unlimited | Unlimited |

## Frontend Behavior
- Gold/amber "ENTERPRISE" badge in the sidebar
- No upsell CTAs, upgrade modals, trial banners, or interstitial modals
- Settings > Billing shows a minimal "Enterprise Plan" card (no usage stats or plan comparison)

# Interstitial Modal System

Priority-based system for modals, banners, and drawers communicating subscription state. All wired in `app/routes/layouts/app.tsx`.

## Priority Order

Modals/drawers are mutually exclusive (one at a time); banners can stack. Highest to lowest:

| Priority | Component | Trigger | Type |
|----------|-----------|---------|------|
| 1 | `FailedPaymentBanner` | `status === 'past_due'` | Banner |
| 2 | `TrialBanner` | Active trial | Banner |
| 3 | `TrialExpiredBanner` | Expired trial (after initial modal) | Banner |
| 4 | `CancelledBanner` | Active + `cancelAtPeriodEnd` | Banner |
| 5 | `MidTrialNudgeDrawer` | Trialing, mid-trial milestone | Drawer |
| 6 | `TrialExpiryModal` | Trialing, approaching expiry (5d/2d/lastday) | Modal |
| 7 | `TrialExpiredModal` | Expired trial, first visit | Modal |
| 8 | `WinbackModal` | Expired trial, return visit (frequency-capped) | Modal |
| 9 | `UsageThresholdDrawer` | Approaching resource limit | Drawer |

`UsageThresholdDrawer` is suppressed when any other interstitial modal/drawer is active via `otherInterstitialVisible`.

## Adding a New Interstitial

Pattern: hook + component + wiring.

1. **Hook** (`app/hooks/use-{name}.ts`): return a `NOT_VISIBLE` constant (`{ visible: false, ... }`) when conditions aren't met; check conditions via `useSubscription()` / `useOrganizationId()` and return `{ visible: true, ...data }`
2. **Component** (`app/components/{name}.tsx`): follow the `VARIANT_CONFIG` + `stagger()` pattern — `VARIANT_CONFIG` object with theme variants (icon, colors, gradients, copy); `stagger(baseMs, index, step)` for animation delays; `Dialog`/`DialogContent` from `~/components/ui/dialog`; `useCanManageBilling()` for role-aware CTAs
3. **Wire into `app/routes/layouts/app.tsx`**: import hook + component; call hook with aliased destructuring (`visible: myVisible`); add `useState` for open state; add `useEffect` with 2s delay to show; update `otherInterstitialVisible` if needed; render with guard: `{myVisible && <MyModal open={...} />}`

## Frequency-Capped Modal Pattern

Used by `WinbackModal` for return-visit modals.

**localStorage keys per org:**
- `promptly:{feature}-show-count:{orgId}` — times shown (cap at N)
- `promptly:{feature}-last-shown:{orgId}` — timestamp of last show (cooldown)
- `promptly:{feature}-dismissed:{orgId}` — `"1"` for permanent dismiss

**Visibility check order:** subscription state matches → prerequisite met (e.g., initial expired modal shown) → not permanently dismissed → show count < max → last shown > cooldown ago.

**Component responsibilities:** `markShown(orgId)` on any close (increment count + timestamp); `dismiss(orgId)` on "Don't show this again".

## Winback Modal

- `app/hooks/use-winback-modal.ts` — visibility logic, frequency cap (3 shows, 7-day cooldown), engagement segmentation
- `app/components/winback-modal.tsx` — three-segment dialog

**Segments** (based on `promptCount` from `useResourceLimits()`):
- `power` (3+ prompts) — indigo theme, "current → free limit" comparison rows with amber warnings
- `partial` (1-2 prompts) — purple theme, "Pro includes" feature bullets
- `ghost` (0 prompts) — teal theme, numbered getting-started steps, CTA navigates to `/prompts` instead of upgrade

## Test Data for Interstitial Testing

When visually testing via Chrome DevTools MCP:

```sql
-- Set subscription to expired for winback/expired modal testing
UPDATE subscription SET status = 'expired' WHERE user_id = (SELECT id FROM user WHERE email = 'test@promptlycms.com');
-- Restore after testing
UPDATE subscription SET status = 'active' WHERE user_id = (SELECT id FROM user WHERE email = 'test@promptlycms.com');
```

**localStorage prerequisites for winback modal:** set `promptly:trial-expired-modal-shown:{orgId}` to `"1"`; clear `promptly:winback-*:{orgId}` keys to reset frequency cap.

**Theme testing:** see "Testing UI in both modes" under Theme System.
