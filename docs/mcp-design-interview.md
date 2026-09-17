# Promptly MCP design interview

Status: accepted for implementation on 2026-09-15 when Dan said “let’s build it”. The implementation brief is in `docs/mcp-server-design.md`.

Historical interview record: on 2026-09-17 Dan extended the scope to LLM testing and comparisons for snippets, prompts and composers. Execution-deferral statements below describe the original release; current behavior is in [MCP testing](./mcp-testing.md).

## Confirmed decisions

- Build a customer-facing Promptly integration, initially piloted in an approved workspace.
- Start with creating, updating, and publishing prompts and composers, supported by the read, validation, preview, and recovery capabilities below.
- Use the latest MCP specification by default. As verified on 2026-09-13, the current specification is 2026-07-28. Dan specifically referenced [Cloudflare's MCP v2 article](https://blog.cloudflare.com/mcp-v2/).
- Customers authorize through their existing Promptly account using OAuth in the first release. Scoped API-key access for MCP is deferred.
- Confirmed product constraint: a user can belong to only one workspace. Bind the OAuth connection to that workspace automatically; no workspace picker or multi-workspace tool parameters are needed. The generalized organization helpers in the code do not override this product constraint.
- OAuth consent offers three permission levels: Read only, Create and edit drafts, and Create/edit/publish. Default to draft editing; publishing access requires explicit opt-in.
- A dedicated publish tool publishes immediately when the connection has publishing permission. Approval prompts are controlled by the MCP client; there is no additional Promptly approval gate. Saving a draft never publishes automatically.
- Publishing automatically uses Promptly's suggested semantic version unless the caller supplies an explicit version: first release 1.0.0, major bump for input-schema changes, minor bump otherwise.
- Publishing a composer publishes only that composer. It reports required prompt references without a published version, allowing the agent to publish dependencies individually and retry. Referenced prompt drafts are never automatically published.
- MCP edits the existing shared draft. Reject stale writes when the document changed since the agent last read it, rather than introducing separate agent drafts.
- When an MCP edit reaches an open browser editor, update automatically if the editor has no unsaved local changes. Preserve unsaved edits and show a conflict notice with a way to review the newer version if it is dirty. Do not automatically merge.
- First-release authoring covers the complete saved definition: content, metadata, model settings where applicable, input schemas, sample input data, and references.
- Snippets are read/reuse only in the first release: agents can find/read existing snippets and attach, reorder, or pin them in prompts. Snippet creation, editing, and publishing are deferred.
- First release includes validation and previews (schema checks, variable substitution, reference inspection) without LLM calls. LLM execution through MCP is deferred.
- Composer authoring uses Promptly's existing HTML representation, with structured helpers generating/inserting prompt and variable reference markup. Preserve editor formatting and raw HTML blocks.
- Edits support partial updates (omitted fields stay unchanged), targeted exact-match text/HTML replacements, and full replacement. All edits check the document revision.
- Incomplete drafts can be saved with clear diagnostics. Publication is blocked on structural errors and unresolved references. Malformed requests are rejected immediately.
- Deletion through MCP is deferred; users continue to delete through the existing Promptly UI.
- Include activity history identifying the user, connected client, action, and before/after state, with restoration of an earlier state into the current draft. Published history remains intact.
- Retain MCP activity records and restorable draft snapshots for 90 days. Existing published-version retention remains unchanged.
- MCP access is included in all existing plans, including Free and trials, subject to existing resource limits.
- Track MCP usage separately and apply request-rate limits. MCP authoring does not consume the workspace's existing monthly API-call allowance. No separate monthly MCP allowance is planned for the first release.
- Host at `https://app.promptlycms.com/mcp` in the existing Promptly app Worker and repository, backed by shared authoring services used by both MCP and browser actions.
- Launch acceptance includes coding clients plus ChatGPT and Claude chat apps. Working interpretation communicated to Dan: Codex, Claude Code, Cursor, ChatGPT, and Claude; all five must pass connection and authoring tests.
- Launch distribution uses custom connections with guided setup in Promptly Settings: server URL, client-specific instructions, connection status, and revocation controls. Public directory listings are deferred.
- MCP Read only access includes drafts and published content, with their saved configuration and sample input data. It supports draft review without write permission and is distinct from the existing published-only API-key read scope.
- Members can connect/revoke their own clients. Owners/admins can view and revoke any workspace MCP connection. Check current membership and permissions per call; no owner approval is required to establish each connection.
- Include native MCP prompt-menu integration for published Promptly prompts, in addition to authoring/review tools. This is an explicit addition chosen over deferral.
- Native prompt calls require caller-supplied input values, validate them against the prompt schema, resolve attached snippets, and return prepared system/user messages. Do not default to saved sample data.
- Mutations affect one document at a time, save atomically, and protect retries against duplicate effects. Agents sequence larger workflows; bulk/multi-document atomic operations are deferred.
- Primary pilot scenario: an agent builds related prompts plus a composer from a brief/codebase, defines inputs, validates/previews, explicitly publishes dependencies and composer, then safely revises the result.
- No additional deadline, deployment constraint, or essential workflow. Proceed through tested milestones, beginning with OAuth and basic authenticated tool calls in all five clients before building the full authoring surface.

## Final confirmation

Dan authorized building the consolidated design on 2026-09-15. No product question is pending. Validate engineering choices and actual client compatibility in the stated milestones.

## Findings from the code

- There is no MCP server dependency in `package.json`.
- The running application is a Cloudflare Worker with React Router. The package manifest currently specifies React Router 8.3.1, although AGENTS.md describes version 7. Use the actual checkout when designing implementation details.
- Better Auth 1.7.4 provides browser authentication, organizations, and organization-referenced API keys. The API-key settings UI exposes only `prompt:read`, `snippet:read`, and `composer:read`, described as access to published content. The scope validation schema currently accepts arbitrary strings.
- Authoring routes depend on browser session and organization middleware. Business logic is mostly inside route actions, rather than a shared service layer.
- Prompt content/configuration saves are actions in `app/routes/prompts.promptId.tsx`. Prompt metadata has a separate API action.
- Composer content, configuration, and metadata use separate API actions. Content saves also synchronize prompt-reference junction rows.
- Existing save paths update a draft or create a draft from the current published version. They do not require an expected revision from callers.
- The shared-draft conflict decision requires revision checks on browser writes and publish calls as well as MCP writes. Otherwise a stale browser save could overwrite a newer MCP save. This is an implementation consequence, not a separate approval requirement.
- Browser collaboration currently broadcasts content through `use-presence.ts` and `PresenceRoom`; prompt and composer pages subscribe to those events. MCP writes need an explicit notification/invalidation path because a database update alone does not use the browser's send-content-update flow.
- Publish actions accept an explicit semantic version greater than the latest published version and publish the current draft. Prompt publishing also updates its API cache and pins unpinned snippet references when a published snippet exists.
- Prompt and composer pages compute version suggestions in the UI: first publication 1.0.0; schema comparison failure increments major and resets minor/patch; otherwise increment minor while retaining the prior patch. The schema comparison sorts top-level fields by name and compares serialized values. This logic would need a shared server-side equivalent for automatic MCP version selection.
- Composer publishing rejects unresolved unpinned references without a published prompt. Auto-update references remain unpinned and follow later published prompt versions; explicit pins remain fixed. Some repository prose describes an older pin-everything behavior; the current code and migration 0023 supersede that description.
- Composer content is TipTap HTML with custom prompt/variable references and raw HTML blocks. Input schemas use Promptly's `SchemaField` representation.
- Create/edit/publish routes inspected do not restrict these actions to owners/admins. Delete routes explicitly require the workspace owner.
- Prompt creation enforces subscription prompt limits. Prompt content saves have an expired-trial read-only restriction. Composer create/save paths inspected do not have equivalent limits.
- Existing version records attribute creation, edits, and publication to user IDs.
- Existing run routes execute provider calls; `resolveModelForOrg` uses organization LLM keys when available, with a system Anthropic key fallback. If MCP execution is added, its billing/credential behavior and permissions need explicit design instead of inheriting the fallback without discussion.

## Technical direction to validate

- Include search/read/version-discovery tools needed for authoring existing items and resolving references. These follow from the authoring workflow; exact pagination, representation, and tool contracts remain to be designed.
- Preserve the existing structured Promptly schema-field representation, retain existing field IDs during updates, and assign IDs server-side for new fields. This supports the full saved definition and stable composer variable references without a lossy JSON Schema conversion. This is a code-informed implementation direction, not an independently confirmed product choice.
- Preserve existing default placement in each resource type's Untitled folder; folder management is outside the proposed first release. No folder create/rename/move authoring flow was found in the inspected routes.
- Restoring history is a draft edit governed by the same permissions, expected-revision checks, validation, reference synchronization, and audit recording as other draft writes.
- Native MCP prompts return prepared messages for the client's current model; they do not execute Promptly's configured provider/model or set the host model/temperature. Provider execution remains deferred. Published prompt-menu integration does not imply native composer execution.
- Native prompt calls default to the latest published version and allow requesting a specific published version. Use stable prompt IDs as protocol identifiers with human-readable display titles. Client rendering of native prompt menus is capability-dependent; preserve equivalent preparation through a tool for clients without that surface.
- Stateless Streamable HTTP on Cloudflare Workers using SDK v2 and `createMcpHandler` from `agents/mcp/server` fits the requested protocol baseline. MCP itself does not require a Durable Object.
- The handler provides an optional compatibility path for ordinary 2025-client tool calls. Actual launch clients and their authorization compatibility still need verification.
- Better Auth's current MCP/OAuth packages can reuse Promptly accounts. Its CIMD transport has Workers-specific requirements that need assessment before selecting an implementation; the Cloudflare OAuth provider is another candidate, not a confirmed choice.
- Current official client documentation supports a custom-connection launch path. ChatGPT developer mode supports OAuth/read-write tools and does not require search/fetch tools; availability depends on the customer's ChatGPT plan and settings. Its OAuth setup can use pre-registered credentials, CIMD, or configured DCR. Claude custom remote connectors accept server URLs and OAuth settings, with organization administration rules on team plans. Cursor and Claude Code support remote OAuth and preconfigured clients; Claude Code also documents automatic CIMD discovery. Live compatibility still requires testing; documentation alone is not acceptance evidence.

## Remaining validation

Product branches have been resolved and consolidated for final confirmation. Implementation must still establish:

1. Actual protocol/OAuth behavior in all five launch clients and native prompt-menu availability per client.
2. The OAuth package choice, shared service boundaries, and atomic D1 revision/idempotency strategy.
3. Exact tool schemas, diagnostics, payload/rate limits, and retryable cache/presence delivery.
4. Migration safety, retention cleanup, frontend conflict recovery, and the agreed acceptance checks.

These are engineering validation tasks, not unanswered product questions. Reopen the interview if their findings require changing agreed behavior.

## Sources checked

- [MCP 2026-07-28 specification](https://modelcontextprotocol.io/specification/2026-07-28)
- [Cloudflare: The next generation of MCP](https://blog.cloudflare.com/mcp-v2/)
- [Cloudflare MCP handler APIs](https://developers.cloudflare.com/agents/model-context-protocol/apis/handler-api/)
- [Better Auth MCP](https://better-auth.com/docs/plugins/mcp)
- [Better Auth OAuth provider](https://better-auth.com/docs/plugins/oauth-provider)
- [Cloudflare Workers OAuth provider](https://github.com/cloudflare/workers-oauth-provider)
- [ChatGPT developer mode](https://developers.openai.com/api/docs/guides/developer-mode)
- [Codex MCP setup](https://learn.chatgpt.com/docs/extend/mcp)
- [Claude custom remote connectors](https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp)
- [Claude Code MCP](https://code.claude.com/docs/en/mcp)
- [Cursor MCP](https://prod.cursor.com/docs/mcp)
