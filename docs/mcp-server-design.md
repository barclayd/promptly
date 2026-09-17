# Promptly MCP server design

Status: accepted for implementation on 2026-09-15. Compatibility/authentication milestone in progress. Interview conducted on 2026-09-13.

Scope extended on 2026-09-17 to include configurable LLM tests and version comparisons for snippets, prompts and composers. The [testing contract](./mcp-testing.md) supersedes the original execution deferral.

## Outcome

Customers can use an MCP client to create, inspect, edit, validate, preview, and publish Promptly prompts and composers. They can also use published prompts through MCP's native prompts capability. Changes share the same drafts and business rules as the browser app, remain attributable to a user/client, and can be recovered from a 90-day activity history.

Pilot in an approved workspace. The primary acceptance workflow starts with a brief or codebase, creates related prompts plus a composer, defines their inputs, validates/previews the result, publishes dependencies individually and then the composer, and safely revises the result.

## Agreed scope

| Area | Decision |
| --- | --- |
| Audience | Customer-facing integration, initially piloted in an approved workspace |
| Protocol | Latest MCP specification by default; current baseline is 2026-07-28 and SDK v2 |
| Hosting | `https://app.promptlycms.com/mcp`, in the existing Worker and repository |
| Authentication | OAuth sign-in using existing Promptly accounts; MCP API-key access deferred |
| Workspace | Each user belongs to one workspace; bind the connection automatically to that workspace |
| Consent | Read only; Create and edit drafts; Create/edit/publish. Default to draft editing; publishing is opt-in. Independent Run tests opt-in |
| Read access | Includes drafts, published content, configuration, and saved sample input data |
| Connection control | Members manage their own connections; owners/admins can view and revoke any workspace connection |
| Authoring | Full saved definitions: content, metadata, model settings, schemas, sample input data, and references |
| Snippets | Find/read/reuse existing snippets; attach, reorder, and pin references; no snippet authoring |
| Editing | Shared draft; partial updates, exact-match replacements, and full replacement; revision checks |
| Incomplete work | Save incomplete drafts with diagnostics; block publication on structural errors and unresolved references |
| Publishing | A dedicated tool publishes immediately when authorized; client controls approval prompts |
| Version numbers | Existing Promptly suggestion by default, with an explicit version override |
| Composer dependencies | Publishing a composer never publishes prompt drafts; report missing published dependencies |
| Browser interaction | Automatically update clean editors; preserve unsaved local edits and show conflicts in dirty editors |
| Recovery | Activity history with user/client/action and before/after state; restore earlier state into the current draft |
| Retention | 90 days for MCP activity/snapshots; retain existing published-version behavior |
| LLM execution | Explicit testing tools for snippets, prompts and composers, plus shared-input version comparisons; validation and preview continue to make no LLM calls |
| Native MCP prompts | Include published prompts; require supplied input values, validate, resolve snippets, return prepared messages |
| Mutation size | One document per mutation, atomic persistence, duplicate-safe retries |
| Plans | All existing plans, including Free/trials, subject to normal resource limits |
| Usage | Separate MCP usage tracking and rate limits; no consumption of existing monthly API-call allowance |
| Clients | Codex, Claude Code, Cursor, ChatGPT, and Claude are launch acceptance targets |
| Installation | Custom connections, guided from Promptly Settings; public directory listings deferred |
| Delivery | Tested milestones, beginning with OAuth/basic tool calls across all five clients; no additional deadline |

Deletion, MCP API keys, snippet authoring, public directory submissions, and bulk/all-or-nothing multi-document operations are outside this release. Preserve default creation in the existing Untitled folders; folder management is not part of this proposal.

## Authorization and connections

Use the user's existing Better Auth login to identify them during OAuth consent. The access grant records the actual user, their workspace, the OAuth client, and allowed scopes. The connection never follows a mutable browser active-workspace selection.

Recommended scope implementation:

| Consent level | Effective capabilities |
| --- | --- |
| Read only | Search/read content and history; inspect versions/models; validate/preview; prepare published native prompts |
| Create and edit drafts | All read capabilities, plus create/update/restore prompt and composer drafts |
| Create/edit/publish | All editor capabilities, plus publish prompts/composers |
| Run tests (independent opt-in) | Test snippets, prompts and composers and compare versions using provider keys; requires read access, not write/publish access |

These are MCP authoring scopes, distinct from the existing published-only API-key read scopes. A narrower token never gains permission from a user's broader browser session. Every protected operation enforces the intersection of the grant, current membership/role, resource ownership, and applicable subscription rules. Server-side authorization is mandatory even if a client hides unavailable tools.

Members can connect without an owner approving each grant. Owners/admins get workspace-level visibility and revocation. Removing membership or revoking a connection must stop subsequent calls, including calls using an otherwise unexpired access token. Increasing a connection's scope requires renewed user consent; it cannot be accomplished through an authoring tool.

Settings should show client, authorizing user, permission level, connection state, and last observed use, with reconnect/revoke actions. Do not claim a client is currently online based only on a historical OAuth grant. Provider API keys, refresh tokens, browser cookies, and unrelated workspace administration data are not authoring outputs.

### OAuth implementation recommendation

Begin the compatibility milestone with `@cloudflare/workers-oauth-provider` handling MCP OAuth and Better Auth handling Promptly sign-in. Cloudflare documents current MCP resource binding, PKCE, issuer identification, and client metadata support for Workers. Keep a D1 connection/authorization record for application-level revocation and membership enforcement, in addition to the provider's token storage.

This is an engineering recommendation, not a separately mandated vendor decision. Better Auth's MCP/OAuth packages remain an alternative if the spike establishes a simpler correct integration. Its current CIMD documentation requires a secure runtime-specific metadata transport on Workers; do not copy its Node transport example into the Worker.

Prefer pre-registered clients where appropriate and CIMD for modern discovery. Enable deprecated DCR only if a named acceptance client requires it and a suitable pre-registered path is insufficient. Any fallback must preserve the same resource binding, scopes, and workspace rules.

## Server architecture

Use stateless Streamable HTTP with SDK v2 and Cloudflare's `createMcpHandler` from `agents/mcp/server`. The MCP protocol does not need its own Durable Object. Existing editor presence can continue using `PresenceRoom`.

Handle `/mcp` and OAuth discovery/token routes without routing unauthenticated protocol requests into browser login redirects. The OAuth authorization/consent UI can use ordinary Promptly login. Keep credentials and authorization state scoped to each request rather than mutable global server state.

Extract shared authoring services from the existing route actions. Both browser actions and MCP adapters invoke those services. They own validation, access rules, version selection, draft creation, reference synchronization, revision checks, mutation history, and publish/cache side effects. MCP should not simulate browser FormData submissions or maintain a second implementation of publishing rules.

Use the actual checkout's framework APIs: `package.json` currently has React Router 8.3.1, while AGENTS.md still describes version 7. This is a React Router/Workers project, not Next.js.

SDK-provided compatibility for ordinary older Streamable HTTP requests is acceptable where needed for the named clients. The architecture remains based on the latest specification. Explicitly test the protocol versions used by the clients; do not equate installing SDK v2 with proven client interoperability.

## Proposed MCP surface

These names and groupings are implementation recommendations; the approved behavior above is the contract.

| Capability | Proposed tools |
| --- | --- |
| Discovery | `search_content`, `list_versions`, `list_available_models` |
| Read | `get_prompt`, `get_composer`, `get_snippet` |
| Create | `create_prompt`, `create_composer` |
| Edit | `update_prompt`, `update_composer` |
| Check | `validate_prompt`, `validate_composer` |
| Preview | `preview_prompt`, `preview_composer` |
| Reference markup | A read-only helper that produces canonical composer HTML for structured prompt/variable/raw-HTML-block inputs |
| Publish | `publish_prompt`, `publish_composer` |
| History/recovery | `list_changes`, `get_change`, `restore_change` |
| LLM testing | `test_prompt`, `test_snippet`, `test_composer`, `compare_tests`, `get_test_result` |

Expose ordinary, descriptive tools with explicit schemas and appropriate read/write/idempotency annotations. A tool annotation is a client hint, not a permission check. No general-purpose code execution or SQL tool is needed.

Search is workspace-scoped and paginated, initially using deterministic name/description matching and type filters. Return metadata and stable IDs in search results, rather than every document body. Names need not uniquely identify prompts; mutations require IDs. Read operations explicitly distinguish the working draft, latest publication, and a particular published version. Never silently substitute a different version for a missing requested one.

Return structured data with a concise human-readable summary. Mutation results include stable item/version IDs, the resulting revision, draft/published status, diagnostics, and a link to the item in Promptly. Keep large content and detailed change diffs opt-in. Enforce documented payload limits and return actionable size errors rather than silently truncating saved content.

Errors should distinguish authentication, insufficient scope, inaccessible/missing content, malformed input, draft diagnostics, publication blockers, stale revision, ambiguous replacement, subscription/rate limits, and transient service failure. Provide field paths, dependency IDs, current revision, or retry information as relevant. Do not expose the existence or content of another workspace's records through error details.

## Content and schema contracts

### Prompts

Support name/description, system/user messages, persisted model configuration, structured input schema, saved sample input/root name, and ordered snippet references. Preserve unspecified fields on partial updates. Reading configured models returns usable identifiers and metadata, never stored credentials. Do not reinterpret local test-only overrides or historical token measurements as model configuration to be changed by an authoring call.

### Composers

HTML remains the content representation. Preserve editor-supported formatting, tables, links, prompt references, variable references, and raw HTML blocks. Helpers should accept structured references and produce canonical markup with server-resolved names/IDs/pins. They must handle the existing raw-HTML attribute encoding and references inside raw blocks.

Validate and normalize against the actual editor representation without silently dropping unsupported content. Treat rich editor HTML and deliberately raw HTML blocks according to their existing semantics. Preview rendering must not execute active content. Existing custom extensions include DOM/React dependencies, so separate serialization/validation from browser NodeViews for Worker use.

Use Promptly's structured schema-field representation to preserve the full saved definition. Retain existing field IDs and assign IDs for new fields on the server. Return the resulting schema/ID mapping. A schema edit must not silently repoint existing composer variable references; missing or invalid references produce diagnostics until repaired.

### Updates

An omitted field means unchanged; clearing a field must be explicit. Define clearing behavior per field rather than applying one blanket null rule. New items can include their complete initial draft in one creation call.

Targeted replacements use literal text/HTML matching against the expected revision. Reject zero matches or ambiguous matches instead of guessing. Reject contradictory operations such as simultaneously replacing an entire content field and applying a targeted edit to that same field. Validate the complete resulting document before persisting structural changes.

## Drafts, conflicts, and retries

Add an opaque revision covering the saved definition and publication state. Clients receive it on read/create/update and supply it on edits, restores, and publishing. Use compare-and-set semantics in the database. Timestamps alone are insufficient as a collision-proof revision.

Browser writes must participate. Checking only MCP revisions would still allow an older browser autosave to overwrite the agent's new state. A publish operation must publish the exact draft revision the caller addressed, including when a semantic version is selected automatically.

Keep at most one draft per item, including under concurrent creation from a published version. Inventory existing duplicates before adding a database constraint. Commit content/configuration, reference-junction changes, revision advancement, audit snapshots, and idempotency outcome as one guarded operation. A lost revision race must leave no partial changes.

Use an explicit idempotency key for mutations, bound to the workspace, connection, operation, and normalized request. Repeating the same operation/key returns the original result without a second draft, version, snapshot, or notification. Reusing a key with a different request is an error. Check a valid replay before treating its original revision as stale. Recommend a documented 24-hour retry window, independently of the 90-day activity history.

A conflict returns enough information to re-read and reconsider the edit; the server does not merge or blindly retry against the newer revision. Restoration is a new audited draft edit, not alteration of an old publication.

Notify open editors after a committed change. Clean editors adopt the newer state. Dirty editors retain their unsaved work, show a conflict, and provide a way to inspect the newer state before replacing or reapplying edits. No automatic merge is promised. Reconnection must refresh the revision because a presence notification can be missed.

## Validation, preview, and publication

Reject malformed structures, invalid types, inaccessible references, and contradictory operations immediately. Allow structurally valid but incomplete drafts, returning diagnostics such as undeclared variables or dependencies that are not publishable yet. Distinguish errors from warnings; do not label an incomplete draft publishable merely because it saved.

Publication revalidates the addressed draft and blocks structural/required-reference errors. Required declared variables must resolve through the applicable prompt/composer/reference input contract. Sample input that is incomplete is a preview diagnostic and should not itself prevent publishing a valid reusable template; the exact diagnostic rules should be covered by acceptance fixtures. Validation does not claim to assess LLM output quality or prove provider execution works.

Prompt preview resolves attached snippets and supplied variables into system/user messages. Composer preview returns static content, resolved variables, and explicit placeholders plus dependency details for LLM-generated sections. It must distinguish those placeholders from real generated output. Caller-selected saved sample data may be used for a preview, but native prompt calls do not silently fall back to it.

Publish through dedicated tools. Defaults are 1.0.0 initially, major bump for schema changes, minor bump otherwise, with an explicit semantic version override that must exceed the latest publication. Share the current suggestion logic with the UI rather than creating a diverging MCP-only heuristic. The existing implementation retains patch when incrementing minor; changing that behavior is not implicit in this plan.

Preserve current dependency semantics:

- Composer publication reports dependencies missing a required published version and never publishes prompt drafts automatically.
- Composer auto-update references remain live and follow later published prompt versions. Explicitly pinned references remain pinned. Do not follow outdated prose saying all composer references are frozen on publication.
- Prompt publication follows existing snippet-version pinning behavior, with invalid/unresolved required references surfaced as publication blockers.
- Validate that pinned versions belong to the referenced item and that references belong to the caller's workspace.

Preserve necessary published-content cache invalidation. MCP authoritative reads should observe committed state. Handle cache/presence delivery failures separately from an already committed publication so a retry cannot publish twice; define retryable delivery for these side effects during implementation.

## Native MCP prompts

List published prompts with stable IDs, human-readable names/descriptions, and deterministic ordering. Default retrieval to the latest published version; allow selecting a specific published version. Require explicit input values for required variables and validate against that version's schema. Resolve its attached snippets and return prepared system/user messages. A prompt with no required inputs should not require fabricated input data.

Nested Promptly data must survive the native MCP argument contract. Recommend a documented JSON input argument where a client's prompt arguments are strings, rather than flattening away nested types. Use the same preparation service as preview tools.

These messages are used by the client with its own model. Promptly's provider/model/temperature settings do not control that host. Native composer execution is outside scope. Native prompt-menu rendering depends on client support; offer equivalent prompt preparation through tools for clients that lack the menu. All five launch clients must support the agreed authoring workflow; document native-menu availability separately instead of promising an unavailable client UI.

## History, usage, and operational controls

Record successful MCP mutations with actor, OAuth client/connection, action, item, resulting revision/version, time, and before/after saved state. Persist enough configuration/reference information to restore the definition, not just its text. History views follow workspace read access; restore follows draft-edit access. A create operation has no prior item to restore into nonexistence, since deletion is deferred.

Expire activity/snapshots after 90 days using a bounded, retryable cleanup job. Retention expiry never deletes normal prompt/composer publications. Idempotency records have their own documented expiry. Decide how deletion/account cleanup applies to auxiliary records consistently with the app's existing lifecycle.

Collect tool-level counts, errors, conflicts, latency, rate-limit events, and failed side-effect delivery without logging full content or credentials in operational logs. History snapshots are a deliberate product feature and stay in protected storage, separate from routine logs.

Apply rate limits to connections/users and workspaces, with clear retry guidance. Exact initial thresholds and payload limits are engineering tuning parameters for the pilot, not a new billing allowance. Resource-limit checks must be shared with browser authoring, including prompt creation and restricted editing after trial expiry; do not invent a composer quota the product does not currently have.

The initial deployment used a workspace allowlist. The general workspace rollout removes that allowlist; retain the operator kill switches for MCP access and authoring. Membership, per-connection consent, scopes, revocation and resource limits continue to apply to every workspace.

## Delivery milestones and acceptance

1. **Compatibility and authentication.** Establish the latest-spec endpoint, discovery, Promptly login, consent, refresh/reconnect, scope denial, and revocation. Verify basic authenticated tool calls in Codex, Claude Code, Cursor, ChatGPT, and Claude. Record the actual tested client versions/surfaces and any narrowly needed compatibility settings before building the complete surface.
2. **Shared authoring core.** Extract domain services; add revisions, atomic writes/reference synchronization, idempotency, history, and necessary browser participation. Preserve current supported behavior while enforcing the agreed invariants.
3. **MCP authoring and preparation.** Implement discovery/read/create/update/validate/preview/publish, HTML helpers, native published prompts, and history/restore. Cover input contracts and failure modes with protocol-level integration tests.
4. **Product integration.** Add Settings onboarding/connection management, activity/diff/restore, clean-editor updates, and dirty-editor conflict handling. Verify light/dark modes and the existing frontend test requirements.
5. **Pilot acceptance.** Complete the brief/codebase-to-prompts-and-composer scenario in every launch client. Confirm published results in Promptly, edit safely, test conflict recovery and restoration, exercise native prompt preparation, and revoke access. Then decide when to expand beyond the pilot.

Required automated coverage includes cross-workspace isolation, membership removal, all three consent levels, duplicate names, explicit missing versions, stale saves/publication, concurrent draft creation, exact-match ambiguity, atomic reference updates, duplicate-safe retries, publish dependency failures, live versus pinned references, native prompt input handling, no LLM calls during preview, history retention/restore, and plan/rate-limit behavior.

Run `bun run lint`, `bun run typecheck`, and the complete `bun run test:e2e` suite before completing implementation. Add meaningful protocol/domain integration tests for guarantees that browser tests alone cannot establish. Test frontend changes with Chrome DevTools MCP in both cookie/class-based light and dark modes as required by AGENTS.md; record any unavailable tool rather than claiming the check passed. Use the required TypeScript agent when implementation work begins. Client authentication tests may require the user's account interaction, but no provider API key is needed for the no-LLM-call MCP feature set.

## Sources and code grounding

- [MCP 2026-07-28](https://modelcontextprotocol.io/specification/2026-07-28) and [Cloudflare's MCP v2 article](https://blog.cloudflare.com/mcp-v2/) establish the stateless baseline.
- [Cloudflare handler APIs](https://developers.cloudflare.com/agents/model-context-protocol/apis/handler-api/) documents SDK v2, request handling, and the limited older-client compatibility path.
- [Cloudflare Workers OAuth provider](https://github.com/cloudflare/workers-oauth-provider) and [Better Auth MCP](https://better-auth.com/docs/plugins/mcp) inform the auth implementation options.
- [ChatGPT developer mode](https://developers.openai.com/api/docs/guides/developer-mode), [Codex MCP](https://learn.chatgpt.com/docs/extend/mcp), [Claude custom connectors](https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp), [Claude Code MCP](https://code.claude.com/docs/en/mcp), and [Cursor MCP](https://prod.cursor.com/docs/mcp) inform the custom-connection test matrix. Documentation establishes an integration path, not a completed live test.
- Local sources: `workers/app.ts`, auth/org middleware, `app/lib/auth.server.ts`, prompt/composer route actions, composer reference extensions/parser/junction synchronization, schema utilities, presence handling, subscription helpers, migrations, and existing E2E tests. Detailed findings and confirmed interview decisions are retained in `docs/mcp-design-interview.md`.
