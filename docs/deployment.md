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

