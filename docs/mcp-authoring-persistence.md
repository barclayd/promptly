# Authoring persistence foundation

The shared persistence and domain services implement authorized, revision-checked creation, editing, publication, history restoration, and browser soft deletion. Browser/MCP adapters and editor coordination use these services; concurrent MCP authoring is enabled for the two approved pilot workspaces.

## Migration

`0027_authoring_persistence.sql` adds `prompt.revision` and `composer.revision`, fills existing rows with opaque random values, and assigns a revision to inserts from legacy routes. The insert triggers are transitional compatibility; they do not detect legacy updates. Every writer must advance/check revisions through the shared services before enabling MCP mutations.

The migration adds a unique partial index for the single draft of each prompt/composer. Read-only local inventory on 2026-09-15 found zero duplicate groups for both kinds. Root's independent production inventory also found zero. Both migrations were applied locally and remotely on 2026-09-15 after the final duplicate-draft inventory. For future installations, recheck before applying because legacy autosaves can create races. The migration fails if duplicates exist; it does not choose or delete a draft. The D1 regression confirms the migration batch rolls back schema/backfill changes while preserving duplicate drafts.

`0028_single_snippet_draft.sql` separately enforces one snippet draft. Its local and production read-only inventories also found zero duplicate groups. `snippet-drafts.server.ts` hardens existing browser snippet saves and publication so a pending save can never modify a published snippet used by prompt readiness checks. A save that loses a publication race atomically clones the latest publication into one draft and updates only its requested content/config field. Simultaneous content/config saves preserve both fields, and publication checks the current draft and semantic-version ordering inside the transaction. Initial snippet creation also inserts its parent and draft together. Snippet authoring remains outside MCP scope.

Auxiliary storage has independent lifetimes:

| Table | Purpose | Lifetime |
| --- | --- | --- |
| `authoring_request` | Atomic admission, request hash, original JSON result | 24 hours |
| `authoring_change` | Workspace, document, user/client, action, revision/version | 90 days |
| `authoring_snapshot` | Separate before/after complete saved definitions | Cascades with change |
| `authoring_outbox` | Durable cache/editor delivery intent | Pending events retained until delivery; delivered records cleaned after 90 days |

Workspace deletion cascades all auxiliary rows. Physical document deletion removes its history/snapshots; soft deletion retains them. User/connection deletion nulls the corresponding live history foreign key while preserving actor/client labels and the immutable actor scope. Retry records retain the scope string rather than a connection foreign key so cleanup does not prematurely erase a completed retry outcome. Authorization must reject removed users/connections before looking up that outcome. Pending outbox rows deliberately have no document/change foreign key: delivery can still invalidate a removed document's cache, and history expiry cannot silently discard an undelivered event.

## Caller contract

The server-only `commitAuthoringMutation` takes an authenticated actor, operation, key/hash, target document and expected revision, commit-time SQL guards, and a synchronous `prepare` callback. `expectedRevision: null` exclusively means create; updates, restore, publication and browser soft deletion require a nonempty revision. The callback receives generated `revision`, `changeId`, and `now` and returns structured writes, before/after definitions, version ID, concise result and side effects.

Callers must:

1. Authorize the current user, workspace, connection and required scope before calling either `readAuthoringReplay` or `commitAuthoringMutation`. Replay results are protected data. The primitive does not construct or authenticate the actor.
2. Hash the canonical submitted intent, including the addressed existing document/revision and requested edits, **before** assigning field/version/document IDs or applying defaults that depend on current saved state. A retry with omitted generated IDs must have the same hash. The hash must be a lowercase SHA-256 hex digest. Never hash the new saved snapshot in place of the submitted intent.
3. Check replay before performing stale-revision/domain validation or generating new IDs. The primitive checks again before calling `prepare` and atomically handles races, but its internal check cannot undo a premature rejection by its caller.
4. Validate the complete resulting definition and references. Supply commit-time guards for mutable access/membership/scope, ownership/reference readiness, subscription restrictions and relevant creation quotas. These guards are trusted server SQL with bound values, never client-provided SQL. A rejected guard returns `not_admitted`; the domain service determines the appropriate safe error after rechecking current state.
5. Provide the full restorable definition in before/after snapshots, including configuration and ordered references. Create uses `before: null`. Include the generated IDs/revision and schema mapping in the result so replay preserves them.
6. Use expected affected-row counts for every write. Parent/version updates normally require exactly one; deleting old junctions may use an explicit bounded range. Do not treat an unexpected zero-row write as success.

The request key is scoped by workspace, `mcp:<connectionId>` or `browser:<userId>`, operation and key. A matching hash returns the original JSON result; another hash returns `key_conflict`. An expired key can be used again after the documented 24-hour window, subject to normal revision and creation rules.

The descriptors support inserts, updates and deletes only on prompt/composer roots, versions and their junctions. Values are bound. The primitive additionally restricts each descriptor to the target document and rejects attempts to update identity, ownership or revision columns. Cross-workspace reference validity remains the domain service's responsibility.

For a create that uses the existing default folder behavior, set `prepare(...).ensureDefaultFolder = true` and omit `folder_id` from the root insert descriptor. The primitive creates the workspace's exact `Untitled` folder only if missing, and sources its ID in the root insert in the same transaction. It also records the committed folder ID in the after snapshot. Explicit folder IDs use ordinary descriptors without this option. Failed guards or subsequent writes cannot leave a new orphan default folder.

## Domain services

`access.server.ts` validates live browser membership or MCP connection, token scope, membership identity and sole-workspace membership before replay. Commit predicates check the same mutable authorization facts again. Existing prompt subscription/creation limits apply without charging the workspace API allowance; composer operations retain the existing absence of such quotas. Existing active composer names remain unique within the workspace.

`mutations.server.ts` exports `createPrompt`, `createComposer`, `updatePrompt`, `updateComposer`, `publishPrompt`, and `publishComposer`. Creates accept `requestKey`, a submitted definition, and an optional existing folder ID. Updates require `id`, `expectedRevision`, `requestKey`, an edit operation, and an optional folder change. Publication requires the addressed revision/key and an optional explicit semantic version. Every success returns the exact revision, change/version IDs, publication state, diagnostics, and assigned schema IDs; adapters retrieve the immutable after snapshot by change/revision for a full acknowledgement without a later-read race.

Updates preserve complete definition state when cloning a published version into a single draft. Incomplete drafts retain diagnostics; publication checks structural readiness and all published dependencies again at commit. Prompt publication pins attached snippets. Composer publication preserves explicitly pinned prompt references and live auto-update references, and never publishes prompt drafts recursively.

Validation, preview and mutation services share bounded dependency loading. Composer checks include each referenced published prompt's own structure and attached snippets, so invalid legacy publications can be inspected and repaired but cannot make a new composer publication appear ready. Publication guards recheck the resolved nested snippet versions and access as well as the direct prompt references. Resolved prompt definitions and snippet content together allow at most 2 MiB per operation, with at most 200 expanded snippet references and 512 KiB of snippet content attached to each prompt. SQL byte/count preflights avoid fetching unbounded legacy bodies.

`restoreAuthoringChange` accepts `kind`, `id`, `expectedRevision`, `requestKey`, `changeId`, and `phase` (`before` or `after`). It restores the selected complete definition and folder into the current draft or creates a draft from the current publication. Publication history stays intact. Its request hash covers the original source-change/phase intent so a retry returns the original result even after later edits or expiry of the source snapshot. Current authorization is still checked before replay. Missing before states, other documents' history, inaccessible references and unavailable folders are rejected.

`softDeletePrompt` and `softDeleteComposer` are browser-only owner operations with revision/key checks, audit snapshots and outbox delivery. Prompt deletion checks for active composer references both before and during the commit. Public history readers require an active document, so a delete adapter returns the concise result rather than fetching the deleted document's after snapshot.

## Atomic admission

One D1 batch performs the operation:

1. Remove only an expired record for this scoped key.
2. Claim a new unique attempt row only when the exact target revision (or absence for create) and all supplied guards match. A concurrent key claim does nothing.
3. Generate every root/version/junction/folder statement with an `EXISTS` predicate for this attempt's pending admission row. A lost claim cannot write any of those rows.
4. After every document/folder statement, inspect SQL `changes()` and update the pending request state. An unexpected count assigns a value rejected by a `CHECK` constraint, aborting and rolling back the entire batch. This also catches a malformed descriptor after earlier writes have already run.
5. Advance the root revision with an exact compare-and-set (one affected row), then insert gated history, snapshots and outbox events. The admission excludes deleted items; final compare-and-set permits an explicitly authorized browser soft-delete descriptor while retaining ownership/revision guards.
6. Complete the request and read the persisted outcome. A raced replay returns the winner's original result before returning any stale-revision error. A different key losing the revision race returns `not_admitted` with the current accessible revision, or null for missing/inaccessible/deleted content.

D1 documents that a failed statement rolls back its whole batch. SQLite's SQL `changes()` excludes trigger work, which permits the temporary legacy insert revision trigger without breaking expected root insert counts. D1 result `meta.changes` includes cascades, so cleanup counts `DELETE ... RETURNING id` rows to report logical parent rows accurately.

## Limits and delivery integration

Cloudflare currently documents 100 bound parameters per statement, a 100,000-byte SQL statement limit, and a 2,000,000-byte string/BLOB/row limit. The primitive validates statement parameter/SQL length limits; multi-row inserts bind JSON and use `json_each`, so 100 junction rows do not consume 300 parameters. Normalized definitions are capped at 524,288 UTF-8 JSON bytes. Each history snapshot envelope allows 786,432 bytes for the definition plus folder/version metadata; before/after occupy separate rows. Concise retry results are capped at 131,072 bytes; each outbox payload is capped at 16,384 bytes. Encoded insert batches allow 1,572,864 bytes to accommodate escaping already serialized configuration while staying below D1's string limit. Domain field/definition limits still apply independently.

At most 200 document descriptors are allowed per commit. Every descriptor uses two statements because the affected-row check is part of the transaction. This is below the paid Worker query allowance, but callers should combine junction inserts and avoid per-reference updates where possible.

`cleanupAuthoringPersistence` deletes a bounded number of expired request/change/delivered-event rows per call; snapshot deletion cascades. The separate outbox consumer uses availability, lease, attempt and delivery columns to retry failures without rerunning a committed mutation. Event IDs/revisions support idempotent delivery. Integration tests cover scheduled cleanup and real Worker notification delivery; sampled production outbox events were delivered after the pilot deployment.

## Verification

The isolated Miniflare/D1 suite covers migration preservation/refusal, legacy insert revisions, unique drafts, concurrent root creation and default folders, CAS winner/loser without partial child/history/event writes, replay before stale validation, conflicting requests, simultaneous replay/collisions, statement rollback, cross-document descriptor rejection, commit-time guard rejection, scope separation, authorized browser soft deletion, independent retention, foreign-key lifecycle and 100-reference bulk inserts. It does not mutate the app's local or production database.

Primary references: [D1 batch transactions and sessions](https://developers.cloudflare.com/d1/worker-api/d1-database/), [D1 limits](https://developers.cloudflare.com/d1/platform/limits/), [D1 foreign keys](https://developers.cloudflare.com/d1/sql-api/foreign-keys/), [SQLite changes()](https://www.sqlite.org/lang_corefunc.html#changes).
