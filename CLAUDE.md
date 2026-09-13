# Promptly

React Router 7 (not Next.js) on Cloudflare Workers. D1 + Drizzle, Better Auth, Zustand + Zundo, Zod v4, Radix/shadcn, Tailwind 4, Biome, Playwright, Bun.

Deep-dive docs live in `docs/` — read them only when working on that area:
`landing-page.md`, `composers.md`, `stripe.md`, `deployment.md`, `interstitials.md`, `model-pricing.md`.

## Commands

```bash
bun run dev                 # http://localhost:5173
bun run lint:fix
bun run typecheck
bun run test:e2e            # needs dev server running
bunx wrangler d1 migrations apply promptly --local    # or --remote
bun run deploy              # build + wrangler deploy (app only, see docs/deployment.md for landing page)
stripe listen --forward-to localhost:5173/api/auth/subscription/webhook
```

## Definition of done

Lint, typecheck and e2e all pass before a feature is complete. Test UI changes in both light and dark mode. Add an e2e test for critical flows or regression-prone interactions; skip for trivial UI or refactors.

## Conventions

- Arrow functions only. `export const` inline, not separate export statements.
- Icons from `@tabler/icons-react`, not lucide.
- Avoid `useEffect`. Use ref callbacks for DOM side effects, `useSyncExternalStore` for external state, `useDebouncedCallback` over debounced values.
- Routes are explicit in `app/routes.ts`. Authenticated pages go inside the `layout('./routes/layouts/app.tsx', [...])` block. Types generate at `./+types/{routeName}`.
- File names: API routes `app/routes/api/[resource].[action].ts`, params `[route].$param.tsx`, schemas `app/lib/validations/[feature].ts`, `*.server.ts` / `*.client.ts` for side-specific code, stores `app/stores/[name]-store.ts`, hooks `app/hooks/use-[name].ts`.
- Actions: parse `FormData` (not JSON) with Zod `safeParse`, return `z.flattenError(result.error).fieldErrors` on failure. Session via `getAuth(context).api.getSession({ headers })`. DB via `context.cloudflare.env.promptly`. Org context via `context.get(orgContext)`.
- D1 uses prepared statements with `.bind()`. Never interpolate SQL.
- IDs via `nanoid()`. Class merging via `cn()` from `~/lib/utils`.
- Look up docs when unsure about an API. Research a linter or reviewer suggestion before dismissing it.
- E2E: no `describe` blocks, no shared state or `beforeEach`. Use the `authenticatedPage` fixture. Never `waitForResponse` with URL matching (RR7 uses `?_data=` params and the 15s actionTimeout applies). Wait for UI state instead: dialog closes, URL changes.

## Facts you cannot read from the code

- Test user: `test@promptlycms.com` / `Testing123`
- App: https://app.promptlycms.com (Workers project `promptly`). Landing: https://promptlycms.com (Pages project `promptly-landing-pages`, prerendered static HTML).
- Local D1 lives in `.wrangler/state/v3/d1/`. Migrations in `migrations/drizzle/`.
- Stripe test: product `prod_TvT5WGDqvZ9udw`, Pro price `price_1Sxc9ULw9ky8dfhCmQI8Od59` ($29/mo). Env: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`.
- Google OAuth redirect URI: `https://app.promptlycms.com/api/auth/callback/google`. `BETTER_AUTH_URL` must have no trailing slash or stray spaces.
- Model price source: https://www.llm-prices.com/. Use `/project:update-models` to add a model.
- Enterprise plan is provisioned manually: `UPDATE subscription SET plan='enterprise', status='active', updated_at=<ms> WHERE organization_id='<org>'`. Its `priceId` is a placeholder.

## Gotchas learned the hard way

- **Themes use cookies, not `prefers-color-scheme`.** DevTools colour-scheme emulation does nothing. Toggle via the user menu or `document.documentElement.classList.add('dark')`.
- **Passwords are PBKDF2** (`saltHex:hashHex`, ~97 chars) via `app/lib/password.server.ts`, not Better Auth's Scrypt. "Legacy Scrypt hash detected" in logs means the hash in `account.password` needs regenerating. The password column is on `account`, not `user`.
- **Better Auth tables are lowercase, columns snake_case** (`apiKey` → `apikey`, `userId` → `user_id`).
- **Invited users skip the Stripe trial.** The `user.create.after` hook checks the `invitation` table and returns early. Everyone else gets a real 14-day trialing subscription with no payment method.
- **Stripe v20** puts period dates on `items.data[0].current_period_start/end`, not the subscription. Use `Stripe.createFetchHttpClient()` and `createSubtleCryptoProvider()` for Workers.
- **Trial expiry is lazy.** No cron. `/subscription/status` flips `expired` on read.
- **Never prerender the landing page from production.** It's circular and Rocket Loader mangles script tags. Prerender from local `wrangler dev`. Rocket Loader must stay off in Cloudflare.
- **Composers:** one draft per composer (`published_at IS NULL`). Saving to a published version creates a new draft. Publishing pins prompt refs unless `auto_update` is set. Prompt FK is `ON DELETE RESTRICT`. Content is HTML parsed with regex on the server because Workers have no DOM.
- **Composer undo is split:** ProseMirror history for content, Zundo for schema/inputData. `content` is excluded from Zundo snapshots.
- **CSS animations with `forwards` fill:** don't stack Tailwind `opacity-0`/`scale-0` on a class whose keyframes set the same property. Bake the initial state into the class (see `.animate-badge-pop`). Only `animate-fade-in-up` tolerates `opacity-0`.
- **Interstitials are mutually exclusive** except banners. Priority order and the frequency-cap localStorage pattern are in `docs/interstitials.md`. To test expired states: `UPDATE subscription SET status='expired' WHERE user_id=(SELECT id FROM user WHERE email='test@promptlycms.com')`, then restore to `active`.
- **Mobile overflow:** check `scrollWidth > clientWidth` at 375px and 320px. Usual culprits are fixed-width blur backgrounds and `overflow-x-auto` code blocks.
