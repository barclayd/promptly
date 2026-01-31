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
- Theme preference stored in `localStorage` under key `theme` (values: `light`, `dark`, `system`)
- Inline script in `app/root.tsx` applies theme before React hydrates (prevents flash)
- `useTheme` hook in `app/hooks/use-dark-mode.ts` provides `{ theme, isDark, setTheme }`
- Uses `useSyncExternalStore` for reactivity (no useEffect)

**Testing UI in both modes:**
When implementing or modifying UI components, test in both light and dark modes:
1. Use Chrome DevTools MCP to set theme: `localStorage.setItem('theme', 'light')` or `'dark'`
2. Reload page and verify UI appearance
3. Check contrast, readability, and visual consistency in both modes

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
