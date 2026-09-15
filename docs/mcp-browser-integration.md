# Browser authoring integration

Implementation plan, 2026-09-15. MCP writes remain unavailable until every prompt/composer writer participates in shared revisions.

## Shared contracts and ownership

- Persistence agent: authenticated domain create/update/publish services, browser-only soft delete, atomic membership/subscription/reference/revision guards, audit snapshots and replay.
- Read/contracts agent: authorized immutable `after` snapshot reader by document/change ID, returning its exact revision, normalized definition, folder and version.
- Frontend agent: browser transport/controller, prompt/composer pages and their loader/action adapters, stores, layouts, sidebars, dialogs, onboarding, and focused browser tests.
- Root: route configuration, readiness, committed-revision notification/outbox delivery, MCP adapters, final integration and release checks.

Mutation results remain concise and include `changeId`. Browser acknowledgements obtain the exact committed normalized definition from that change's immutable after snapshot. Reading the latest working draft after saving is insufficient because it may already contain another writer's change. A failed acknowledgement read after a successful commit is an uncertain outcome: retry the same request/key, never invent a replacement mutation.

## Writer inventory

| Existing writer | Integration |
| --- | --- |
| `prompts.promptId.tsx` action: message/config writes and draft copying | Replace SQL with shared update service; validate expected revision/key and reject historical-view writes. Remove parallel component text submitter. |
| `api/prompts.save-snippets.ts` | Shared update of the ordered snippet-reference field with the same document revision. |
| `api/composers.save-content.ts`, `api/composers.save-config.ts` | Shared update service; content and reference junctions commit together. |
| `api/prompts.update.ts`, `api/composers.update.ts` | Metadata uses shared update and the same editor queue. |
| `api/prompts.create.ts`, `api/composers.create.ts` | Shared idempotent create; retain current create-dialog/navigation and workspace bootstrap behavior. |
| `api/prompts.publish.ts`, `api/composers.publish.ts` | Shared dedicated publish after flushing all staged edits; use latest acknowledged revision. |
| `api/prompts.delete.ts`, `api/composers.delete.ts` | Browser-only owner-checked soft delete using revision/key, audit and atomic dependency checks. Never expose as MCP tools. |
| `sidebar-right.tsx` | Config/schema/sample inputs and separate “save test config” submitter join the queue. Preserve config fields that the UI does not understand. |
| `composer-sidebar-right.tsx` | Config/schema/sample data join the same composer queue. |
| `use-onboarding-orchestrator.ts` | Replace two unawaited parallel writes with one staged definition and awaited flush; creation retains one retry key. |
| Store undo/redo and `use-variable-sync-modal.ts` | Observe actual saved-field changes, so undo and variable-driven schema edits save too. Suppress initialization and acknowledged remote application. |
| `prompts.run.ts`, `composers.run.ts`, `snippets.run.ts` | Their SQL writes only token-usage telemetry, which is outside the saved definition and does not advance an authoring revision. |

Snippet-only creation/editing/publishing/deletion remains outside the prompt/composer authoring service scope. Reading/reusing snippets and changing a prompt's snippet references are included. No other prompt/composer root, version or junction SQL writers were found in the inventory.

## Browser integration

Use one controller per signed-in user/workspace/document working view. It owns the existing framework-independent save coordinator and injected FormData transport. Content, config, references and metadata use atomic field patches; a config update merges the changed known keys into the coordinator's current config, preserving unknown stored keys.

Bind saved fields from `prompt-editor-store.ts` and `composer-editor-store.ts` to the controller using event-driven subscriptions. Initialize/apply acknowledged remote state under an explicit suppression guard. Keep test-only model/version choices, token estimates and other transient state outside the saved-field projection. Retain the existing undo models; remote acknowledgements do not become local undo entries.

Pages, desktop/mobile layouts, sidebars and edit/publish/delete dialogs share that controller. Autosave debounce schedules `flush`; it never creates an independent revision or request key. Saved indicators reflect actual acknowledgement, while differences from the last publication remain a separate publish-readiness calculation. Navigation must not silently destroy staged or uncertain work.

Working-view identity is `kind/id/working`, not the displayed semver. Loader revalidation feeds an authorized saved snapshot into the coordinator instead of reinitializing the editor after publication. Requested historical versions are separate read-only views. Missing/invalid historical versions show an error rather than falling back to editable current content; no historical view can submit into the working draft.

The existing live presence stream is not a saved-revision acknowledgement. Prompt and composer pages ignore all speculative content messages, including the room’s cached initial content; they retain presence and cursors. Only committed snapshots can change editor content. Committed-revision notifications and reconnects trigger authorized reads; clean controllers adopt, dirty controllers hold the newer snapshot for conflict review.

Conflict UI shows preserved local work and the reviewed remote definition, with explicit accept-remote/reapply-local actions. Unknown network outcomes must first retry their exact request. An in-flight publication cannot be cancelled by pretending its outcome is known. A queued publication is cancelled on definitive conflict/failure and requires a fresh user invocation after resolution.

## Verification

The coordinator has 17 deterministic controlled-promise tests, including edits during saves, exact retries, stale resolution, publication barriers, revision notifications before acknowledgements, and immutable subscription snapshots. Browser integration adds real saved-state checks for text/config/references/metadata races, undo/redo and schema changes, onboarding, publish-before-debounce, working/history navigation, stale save/delete/publication, dirty conflict recovery and clean remote adoption. Conflict UI was checked at desktop, 375px and 320px sizes in light/dark themes. The integrated deployment passed the complete repository checks recorded in mcp-implementation.md.


## Implemented browser bridge

`browser.server.ts` now adapts every active prompt/composer writer to domain mutation services. All legacy mutation URLs require a revision and stable request key; no blind writer remains. `editor-session.ts` observes saved store fields, retains uncertain/pending work across navigation, blocks early interaction until the observer is attached, and prompts before unloading unsaved work. Immutable after-snapshot acknowledgements are used for saves, publication and restore; deletion uses its terminal revision without trying to read a deleted parent.

The nine browser integration regressions cover overlapping text edits and persisted grouped undo; clean remote adoption and explicit dirty conflict reapplication; TipTap updates and stale/blind legacy endpoint rejection; dialog creation/metadata/publication/history/deletion; exact-key replay after a committed response is lost; open-dialog foreign versus own acknowledgements; exact history phase retry; and restoration across two editors with stale legacy presence data. Conflict rendering also checks desktop, 375px and 320px viewports in light/dark modes. Root owns activity/restore UI and the eight create/edit/publish/delete dialogs; their shared helper consumes this same session.
