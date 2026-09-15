# Shared authoring contracts

The definition/read modules define persisted authoring data and authoritative reads. They do not authenticate callers, write drafts, validate publication readiness, execute models, or expose MCP tools. Browser and MCP adapters must obtain `organizationId` from their authenticated authorization context, never from a client assertion. The history module below accepts a principal and checks authorization itself; the separate mutation/access modules provide domain writes.

## Definition contracts

The exported Zod schemas and inferred types live in `../validations/authoring.ts`:

- `PromptDefinition`: current name/description, version labels, system/user messages, saved config and ordered snippet references.
- `ComposerDefinition`: current name/description, version labels, existing TipTap HTML and saved config. Prompt references derive from HTML; they are not a second independently editable input.
- `SnippetDefinition`: current name/description, version labels, content and saved snippet test configuration. Snippet authoring remains outside the MCP release scope.

Unknown JSON config, field, validation and parameter settings are retained. Unknown definition properties are rejected so spelling mistakes cannot silently disappear. The schemas preserve all existing `SchemaField` parameters, including nested discriminated-union and validation cases. Transform and custom-validation code strings remain data and are never executed by these helpers.

`normalizePromptDefinition(value)` and `normalizeComposerDefinition(value)` return `{ definition, assignedIds, diagnostics }`; the composer result also includes `promptReferences`. They preserve caller data and all supplied field/rule IDs, assigning `nanoid()` only where an ID is absent. Explicit empty or null IDs are rejected. Duplicate IDs are rejected across the full schema. The result reports each assigned ID with its definition path. A caller must hash canonical submitted intent before normalization for idempotency; generated IDs are not request identity.

`parsePromptDefinition`, `parseComposerDefinition` and `parseSnippetDefinition` validate saved definitions without generating IDs. Missing IDs in legacy saved data require repair instead of becoming different IDs on each read. Defaults materialize omitted legacy config fields using the existing editor defaults. Explicit saved JSON values remain intact.

Incomplete field names and unresolved composer variable IDs produce diagnostics. Contradictory pins for repeated composer prompt references are rejected because the existing junction table permits only one selection per referenced prompt. These diagnostics are structural checks only; a successful parse does not establish publication readiness.

## Bounds

Bounds use UTF-8 bytes and are enforced by the normalization/parsing helpers, in addition to Zod field validation. A whole normalized definition is limited to 512 KiB. Each message/content, config and sample-data value is limited to 256 KiB. There are at most 200 schema fields across all nested cases, 32 validation rules per field, and 100 distinct references per document. JSON depth is at most 32 with at most 50,000 values. Non-finite numbers, cycles, sparse arrays and non-JSON objects are rejected.

These bounds leave room beneath D1's 2 MB row limit for metadata and separately stored before/after snapshots. Calling a raw Zod schema alone does not perform aggregate byte/depth/count checks; domain services must use the exported parsing/normalization helpers.

## Read service

`getPrompt(db, input)`, `getComposer(db, input)` and `getSnippet(db, input)` take an `AuthoringReadInput`: `{ organizationId, id, version }`. Version selection is explicit:

| Selector | Meaning |
| --- | --- |
| `{ kind: 'draft' }` | The existing shared draft only. |
| `{ kind: 'latest' }` | The greatest published semantic version only. |
| `{ kind: 'working' }` | Shared draft if present, otherwise latest publication. |
| `{ kind: 'published', versionId }` | That published version belonging to the requested item. |
| `{ kind: 'published', version: '1.2.3' }` | That exact published semantic version. |

Missing explicit selections produce `version_not_found`; there is no fallback. Inaccessible, deleted and nonexistent parents all produce the same `content_not_found`. Multiple shared drafts produce `duplicate_drafts` when selecting a draft or working copy.

Reads return `AuthoringReadResult<T>`: `{ metadata, version, definition, dependencies, diagnostics }`. Name, description and folder remain current parent metadata even when reading a historical publication. Runtime token measurements and model credentials are never selected or returned. `metadata.revision` is the parent revision once the persistence migration exists; `null` denotes legacy read-only state before that migration (and snippets, which have no shared authoring revision). A null revision is not an edit precondition.

The parent, selected definition and junction rows are read in a primary-first D1 session batch. Reference resolution uses the same session and verifies every parent is active in the requested workspace and every explicit version is a publication belonging to that parent. Unpinned references resolve the latest publication, or return a missing-publication diagnostic for an existing accessible dependency that has none. Inaccessible references produce generic diagnostics and are omitted from resolved dependencies. The owned saved definition remains readable for repair, including reference IDs/labels already stored in it; no inaccessible target metadata or content is resolved. Composer reads inspect both HTML references and saved junction rows; legacy divergence returns `reference_index_mismatch` without rewriting content.

`listVersions(db, { organizationId, id, kind, offset?, limit? })` returns `{ items, nextOffset }` with drafts first and descending published semantic versions. It returns version metadata only. `listAvailableModels(db, { organizationId, offset?, limit? })` returns deduplicated model IDs actually enabled on the workspace's configured keys, with public display names/provider metadata. Unknown configured model IDs are retained using the current model-dispatch provider convention. It does not expose the unrestricted provider catalog, key names, hints or credentials. Both list helpers default to 25 results and cap pages at 100.

`AuthoringError` provides a stable `code`, safe message and structured diagnostics with field paths. Callers translate it into their browser/MCP transport response.

Internal mutation services may use `readPromptDefinition` and `readComposerDefinition` to obtain the same atomic workspace-scoped snapshot without resolving dependencies. This permits an edit to remove an unavailable old reference. The result includes its D1 `session`; composer results also include `promptReferences` from HTML and `storedReferences` from the junction. These internal helpers must not be exposed as unrestricted external reads. Domain services must validate the resulting edited definition's references through strict `resolveAuthoringDependencies(session, organizationId, kind, references)` before writing. Public `getPrompt` and `getComposer` report unresolved references as diagnostics so callers can inspect and repair the saved state.

## Edits, request identity and versions

`promptSubmittedDefinitionSchema` and `composerSubmittedDefinitionSchema` expose corresponding `...Input` types that permit new fields/rules without IDs. Their static defaults do not depend on the current draft. `promptAuthoringEditSchema` / `PromptAuthoringEditInput` and their composer equivalents accept either `{ mode: 'replace', definition }` or `{ mode: 'patch', changes?, replacements? }`.

`applyPromptEdits(current, edit)` and `applyComposerEdits(current, edit)` return the same normalized result as creation. A patch preserves omitted top-level fields and merges `config` by key. Supplying `config.schema`, sample data, provider options or snippet references replaces that whole value; it does not recursively merge arrays or nested settings. Null is accepted only where the saved field supports it. Full replacement resets omitted values to the definition defaults.

Each replacement is `{ field, oldText, newText }`: `field` is `systemMessage`/`userMessage` for prompts or `content` for composers. A nonempty `oldText` must match exactly once, including potentially overlapping occurrences, in the original content. All matches are validated against that original content before applying edits; replacements cannot depend on text generated by another replacement. Overlapping replacements and a full field assignment combined with a replacement of the same field are rejected. Replacement strings are literal: no regular-expression or replacement-token interpretation occurs.

`canonicalAuthoringRequestHash(intent)` returns lowercase SHA-256 hex of recursively sorted-key JSON, preserving array order, omissions and explicit nulls. It performs no normalization or ID generation and allows 512 KiB plus 8 KiB for the request envelope. The domain caller must include operation/target/expected revision and all mutation options in this intent, and hash it before assigning IDs. Authentication and replay scope are separate persistence responsibilities.

`suggestAuthoringVersion({ currentSchema, latestPublished })` returns `{ major, minor, patch, version }`, with `latestPublished` either null or `{ version, schema }`. It suggests `1.0.0` for the first publication, increments major and resets minor/patch for a schema change, or increments minor while retaining patch otherwise. Schema equality matches the existing UI: sort only the top-level fields by name and compare JSON, including IDs and settings. `selectAuthoringPublishVersion({ ...same, override? })` accepts a canonical safe-integer semver override strictly greater than the latest publication. Neither helper changes the browser UI or publishes anything.

## Protected history and save acknowledgments

`listAuthoringChanges(db, principal, { kind?, id?, offset?, limit? })` lists change metadata, with no snapshot bodies. An `id` filter requires `kind`. `getAuthoringChange(db, principal, { changeId })` returns `{ change, before, after }`; a create has `before: null`. Each snapshot has a discriminating `kind`, the saved `definition`, `folderId` and an `AuthoringVersion` object. Actor/client names reflect the recorded change; list document names reflect the active parent.

`getAuthoringAfterSnapshot(db, principal, { kind, id, changeId, revision? })` returns the immutable saved after-state plus `changeId` and `revision`. It also accepts `{ kind, id, revision }`. Browser saves should acknowledge with this helper rather than rereading the working draft, which may already contain another writer's changes. A mismatched document/revision/change, missing snapshot or expired history never falls back to a current definition.

All history helpers accept `AuthoringPrincipal`, authorize current membership and effective `mcp:read` scope, and apply the resulting membership/connection predicates again in the actual data query. Reads require an active parent in the authorized workspace. Soft-deleted documents are hidden; delete adapters should return their concise deletion result or redirect without requesting an after-state. Inaccessible and expired changes share `change_not_found`. The helper enforces both stored expiry and a maximum age of 90 days even before cleanup runs. History stays readable after the independent 24-hour idempotency record expires. The optional final `now` parameter is for deterministic server tests; external adapters must use the server clock.

## Verification

`e2e/tests/authoring-contracts.spec.ts` checks normalization, legacy preservation, nested IDs and payload bounds. `e2e/tests/authoring-reads.spec.ts` uses isolated Miniflare D1 databases with the real application migrations to verify selections, workspace/reference isolation, current parent metadata, saved settings, duplicate drafts and configured-model privacy. `e2e/tests/authoring-edits.spec.ts` covers omission and null behavior, exact replacements, generated IDs, canonical request hashes and existing semver rules. `e2e/tests/authoring-history.spec.ts` commits through the real persistence primitive and checks immutable acknowledgments, before/after state, retention, membership/scope revocation and corrupt/missing snapshots. These tests do not mutate the shared development database.
