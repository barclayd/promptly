# MCP implementation and compatibility record

Updated 2026-09-17. The [accepted design](./mcp-server-design.md) remains the release contract.

## Workspace availability

The authoring server is available at `https://app.promptlycms.com/mcp`. The current implementation enables MCP for every workspace while `MCP_ENABLED=true`; it no longer reads a pilot allowlist. Users still need a current workspace membership and must approve each connection. The compatibility evidence below records the initial two-workspace deployment; deploying this change is required to expand production access.

The 21 tools cover connection information, content search, full prompt/composer/snippet reads, version/model discovery, prompt/composer creation and editing, validation and previews, composer markup generation, dedicated publication, and activity inspection/restoration. Snippets can be read and reused; snippet authoring, deletion tools, and LLM execution are outside the MCP release. Published prompts also appear through native MCP `prompts/list` and `prompts/get`.

The server uses SDK v2 in the existing app Worker. It supports stateless 2026-07-28 requests and the SDK's older Streamable HTTP transport. OAuth uses resource discovery, S256 PKCE, Better Auth sign-in, access/refresh tokens, CIMD, and authenticated manual client registration. Dynamic client registration remains disabled.

Each connection is bound to its user, sole workspace membership, client, and consented scopes. Every request checks current membership and permissions. Consent offers read, draft editing, and publishing; draft editing is the default. Clients request all three available scopes so the user can opt into publishing. Existing read-only grants do not acquire additional permissions automatically.

Browser and MCP prompt/composer writes share atomic services, opaque revisions, stable retry keys, and immutable history acknowledgements. Clean editors adopt committed remote changes; dirty editors preserve local work and require explicit conflict resolution. The Activity page shows before/after definitions and restores either state into the working draft without altering published history. See [browser integration](./mcp-browser-integration.md) and [persistence](./mcp-authoring-persistence.md).

## Compatibility evidence

| Client/path | Verified evidence | Remaining check |
| --- | --- | --- |
| Codex bundled CLI 0.154.0-alpha.6.2 | Hosted CIMD OAuth with publishing opt-in; 21 tools; create/replay/read/validate/preview two related prompts and a composer; unpublished dependency denial; publication; exact text edit; stale revision rejection; semantic version bump; before/after history; restore to draft with immutable publication | Passed again on the optimized deployment |
| Claude Code | Hosted CIMD OAuth with publishing opt-in; actual prompt creation, validation, preview and publication; generated composer markup; composer creation, validation, preview and publication; on the optimized deployment, exact edits, stale revision denial, version 1.1.0, history and restore with immutable publication | Passed; native retrieval of latest and explicit 1.0.0 plus missing-input rejection verified |
| Cursor 3.4.20 | Public client registration, exact native callback OAuth, both foundation tools, revoked-call denial and successful reconnect | Full authoring grant and workflow; Cursor currently needs authentication after the consent attempt expired |
| Personal ChatGPT | Private developer app, CIMD OAuth and both foundation tools with read permission; Refresh populated the initial action list | Refresh 21 tools, reconnect with publishing permission and exercise authoring |
| Claude chat app | The pilot account requires workspace approval for custom connectors | Deferred until workspace approval; no chat-app compatibility claim |
| Direct protocol/OAuth harness | Hosted current/legacy authenticated lifecycle, refresh downscoping, publish scope excluded without consent, authorization-code replay rejection, RFC 7009 access/refresh revocation | Hosted current-protocol native prompt retrieval and missing-input rejection pass through Claude Code; direct legacy prompt rendering remains covered locally |

Codex checks use an ephemeral app-server session without model turns or a saved task. Claude Code uses its normal subscription authentication, disables session persistence, and restricts tools to the pilot MCP connection. No test invokes an LLM through Promptly. Temporary direct-protocol OAuth tokens remain in process memory and test grants are revoked afterward.

Live acceptance retained two sets of related prompts and published composers in the pilot workspace. Both workflows published a prompt at 1.1.0 and restored its earlier content into a draft while preserving publication history; the Claude composer uses two explicitly pinned published dependencies.

## Resource investigation

The first Claude Code workflow received Cloudflare 1102 responses while creating its composer and on two subsequent read calls. A later connection probe succeeded. Replaying the exact 436-byte composer HTML locally succeeded through both protocol versions. Retrying through the same Claude connection and original request key then created, validated, previewed and published the composer successfully. Captured tail events for that retry were successful; the original failure occurred before the live tail started, so CPU versus memory exhaustion is not established.

A separate benchmark identified avoidable schema conversion: all static tool contracts were converted on every request, and listing converted them again. Registration of the 19 authoring tools averaged 13.23 ms in the local warm benchmark; caching just schema-derived JSON reduced it to 0.094 ms. This is an optimization, not proof of the cause of 1102. Fresh servers, authenticated callbacks and request data must remain request-scoped. The implemented lazy cache preserves the initial conversion cost; warm registration averaged 0.30 ms after implementation. Catalog/validation equivalence and separate per-request permissions pass regression tests. The optimization is deployed and hosted Codex/Claude Code rechecks pass. Sampled warm tool calls use 9–34 ms CPU compared with 68–124 ms in the earlier composer retry; initial schema conversion still incurs higher cost. No resource failures occurred in these rechecks; the optimized native prompt request used 13 ms CPU. The original 1102 cause remains unconfirmed. Live tail capture has stopped; a sanitized timing/outcome summary was retained and the raw request-header log was removed.

## Local setup

```sh
bun install
bunx wrangler d1 migrations apply promptly --local
```

Keep the existing Better Auth/provider configuration in the ignored `.env` and set:

```dotenv
BETTER_AUTH_URL=http://localhost:5173
MCP_ENABLED=true
MCP_AUTHORING_ENABLED=true
MCP_ALLOW_DCR=false
```

No workspace allowlist is needed. Use a local test account with a workspace membership. Run `bun run dev`; MCP setup is at `/settings?tab=mcp`, manual client registration at `/settings/mcp/clients`, and history at `/activity`.

```sh
bun run lint
bun run typecheck
bun run test:e2e
bun run build
bunx wrangler deploy --dry-run
```

The E2E suite needs the local server and standard test user. Authoring/OAuth domain regressions use isolated Miniflare databases. Browser tests cover actual saved state, concurrent edits, publish/save ordering, conflict recovery, history restoration, mobile sizes and light/dark themes. Chrome DevTools MCP is unavailable; verification uses repository Playwright Chromium plus native Chrome inspection when its accessibility surface responds.

## Client setup notes

Settings supplies the server URL, exact client configuration, connection state and revocation controls. Codex uses `https://chatgpt.com/oauth/codex/client.json`, Claude Code uses `https://claude.ai/oauth/claude-code-client-metadata`, and ChatGPT uses `https://chatgpt.com/oauth/client.json`. Hosted CIMD resolution works with DCR disabled. Local Codex CIMD fetching previously received an upstream 403; do not weaken OAuth validation to work around that local limitation.

Cursor's [static OAuth configuration](https://prod.cursor.com/docs/mcp) uses `auth.CLIENT_ID` and `auth.scopes`. Register the exact desktop/web callbacks supplied by the client. The installed Cursor 3.4.20 used `cursor://anysphere.cursor-mcp/oauth/callback`; Promptly permits only that exact native callback in addition to HTTPS and loopback callbacks. The other documented callbacks are `http://localhost:8787/callback` and `https://www.cursor.com/agents/mcp/oauth/callback`. Require exact paths and S256 PKCE. Use the public client ID returned by manual registration; no client secret is required. Cursor's `--add-mcp` command produced a VS Code-format entry its settings did not display, so the pilot uses `.cursor/mcp.json`.

ChatGPT's private developer app remains unpublished. Its pilot test uses an account with custom connector access. Claude chat-app testing remains deferred pending workspace approval.

## Operational controls

| Setting | Value | Purpose |
| --- | --- | --- |
| `MCP_ENABLED` | `true` | Master endpoint and OAuth switch |
| `MCP_AUTHORING_ENABLED` | `true` | Exposes authoring tools, full discovery scopes and native published prompts |
| `MCP_ALLOW_DCR` | `false` | Dynamic registration is separately gated |
| `BETTER_AUTH_URL` | Existing app URL | Canonical OAuth issuer and MCP origin |
| `OAUTH_KV` | `089b4a1d119b49ae9ec5286fae8fa10b` | Dedicated OAuth storage |

Authenticated traffic permits 120 requests per connection per minute and 600 per workspace per minute, returning `429` with `Retry-After`. MCP usage is tracked separately and does not consume the existing application API allowance. Creation still enforces the workspace's normal resource/subscription limits.

Activity snapshots expire after 90 days; exact request replays after 24 hours. Ordinary published-version history retains its existing lifetime. A minute cron performs bounded cleanup and retries the D1 outbox. Outbox delivery invalidates cached publications and sends metadata-only committed revision notifications. Failed delivery never repeats a committed mutation. The final primary production query found no undelivered outbox events.

RFC 7009 revocation disables the whole connection, including when an access token is submitted. D1 is authoritative even if a concurrent refresh recreates KV entries. The narrow revocation adapter depends on `workers-oauth-provider` 0.10.3 storage keys; run its ownership/revocation regressions on upgrades. Settings also records revocation in D1 before clearing provider state.

## Deployment and recovery

Production migrations `0024`–`0028` are applied. `0027` adds opaque revisions, unique prompt/composer drafts, replay/history/snapshot/outbox storage. `0028` enforces one snippet draft, with browser snippet writes hardened against publication races. Local and production inventories found no duplicate draft groups before migration. No existing draft was discarded.

Last recorded pilot authoring Worker: `4f7f4b55-b605-41ee-8810-c7b036383e79` (2026-09-15). Deployment used `--keep-vars`, preserving all 14 secret bindings and existing infrastructure. Hosted discovery advertises all three scopes, unauthenticated `/mcp` returns 401, and the existing login page returns 200. `public/.assetsignore` excludes `.DS_Store` assets.

First authoring candidate Worker: `6913b93d-61f3-4d05-9e93-a0dce1ff4617`. Previous foundation-only Worker: `27d9031f-3483-45e1-a607-d1fcba714ae8`. Pre-pilot Worker: `c22d1cee-ee79-4618-9f3b-f14475206bc6`. Database recovery bookmarks belong in the private deployment record.

First disable `MCP_AUTHORING_ENABLED` to stop authoring exposure, or `MCP_ENABLED` to stop all MCP access. Do not routinely roll back the database: it could discard unrelated subsequent writes. Browser writers must retain revision-aware services while MCP authoring is enabled.

## Verification and remaining work

The deployed authoring candidate passed **238 E2E tests without retries**, `bun run lint`, `bun run typecheck`, production build and Worker dry run. This includes discovery-driven consent, explicit publish opt-in, setup command formats, immutable publication, stale revision/retry races, activity restoration across two editors, and snippet publication races. The static-schema optimization passed all 241 tests (240 directly, one browser element screenshot on retry), lint, typecheck, production build and dry run. The screenshot check then passed three consecutive runs without retries and without concurrent build work. The optimized Worker was deployed and both Codex and Claude Code hosted rechecks passed.

The workspace-wide access and first-connection changes passed **253 E2E tests without retries**, lint (existing warnings only), typecheck, production build and Worker dry run. Coverage includes actual Better Auth callbacks for Google, Apple and GitHub, signed-out login and recovery, JavaScript-disabled registration and consent, exact read/publish scopes, cross-origin referrer suppression, and responsive light/dark login screens. These changes still require deployment and a hosted first-connection smoke check from a workspace outside the former pilot.

Remaining acceptance: complete Cursor and personal ChatGPT authoring checks when browser access recovers; perform the user-deferred Claude chat-app check after workspace approval. These client-specific checks are independent of workspace eligibility.

## First-connection sign-in

A signed-out MCP connection returns to the complete OAuth authorization request after login. Local redirect validation accepts standard query characters (including `+` between scopes) while rejecting external destinations, network-path references, backslashes, and control characters. Client ID, callback URL, state, resource, scopes and PKCE challenge survive both password and social login.

Manual registration and consent also work before JavaScript loads. Their `Referrer-Policy: same-origin` preserves the browser's origin on native form submissions while withholding the referrer from external OAuth callbacks. The previous `no-referrer` policy made native POSTs send `Origin: null`, which React Router correctly rejected. Consent submits the selected permission directly from its radio input, including without JavaScript; the previous hidden field could retain the default edit permission after the user selected read-only. Same-origin validation and explicit publish consent remain enforced.

Better Auth 1.7.4 requires the existing local email to be verified before implicitly linking a new social provider. Promptly password signup leaves it unverified. Selecting a different provider can therefore produce `account_not_linked` even when that provider verifies the same email. Existing linked providers and verified accounts retain Better Auth's normal behavior. See the [account-linking error reference](https://better-auth.com/docs/reference/errors/account_not_linked) and the [pinned implementation](https://github.com/better-auth/better-auth/blob/v1.7.4/packages/better-auth/src/oauth2/link-account.ts).

The login page directs MCP users to their existing sign-in method. Social callback failures return to that page with a fixed, actionable message and the original authorization request intact. Signing in with the existing method continues to consent without restarting the assistant connection. This does not disable email verification checks, trust unverified provider emails, or silently merge identities.
