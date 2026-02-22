# Plan: Composer UI

## Context

The Composer API routes are already implemented (see commit `d5d5bc1`). Database schema exists (migration `0019`), validation schemas exist (`app/lib/validations/composer.ts`), and all 7 API endpoints are registered. This plan covers the full UI implementation: list page, detail page with editor, right sidebar (versions, referenced prompts, schema builder, generated code, test panel), and all supporting components.

Composers are deterministic orchestrators — they combine static text with `${prompt:id}` references. Each referenced prompt uses its own model/temperature config. The composer has no LLM config of its own.

---

## Design Decisions (Confirmed)

- **Single `<PromptEditor>`** with title "Content" for the composer body
- **Nav position**: Before Prompts — Analytics → **Composers** → Prompts → Snippets → Team
- **Icon**: `IconFileMusic` from `@tabler/icons-react`
- **Full presence/collaboration** (WebSocket cursors + live sync)
- **Prompt ref insertion**: Manual `${prompt:id}` typing for now (picker deferred to future PR)
- **Publish dialog**: Identical to prompts/snippets (semver input, suggested bump)
- **Version bump logic**: Major when schema changes, minor otherwise (same as prompts)
- **List page**: Mirror `/prompts` and `/snippets` exactly (folders, cards, empty state with `IconFileMusic`)
- **Layout**: Same resizable panel pattern (75/25 split, cookie-persisted)
- **Menubar**: Match snippet menubar (File > Share/Delete, Edit > Undo/Redo/Edit Details)
- **Name editing**: Edit menu only (same as prompts/snippets)
- **Recents**: Show in sidebar recents with `IconFileMusic`
- **Config shape**: `{ schema, inputData, inputDataRootName }` — no model/temperature

### Right Sidebar Sections (in order)
1. **Versions** (default open) — shared `<VersionsTable>`
2. **Referenced Prompts** (default closed) — name + link + version pin status
3. **Schema Builder** (default closed) — reuse existing `<SchemaBuilder>`
4. **Generated Code** (default closed) — Zod schema via `<CodePreview>`
5. **Test** (controlled open) — input data JSON editor + version select + run button

### Test Panel
- Input Data: `<JsonEditor>` (json-edit-react)
- Composer Version: `<Select>` (draft + published versions)
- Run button: fires `/api/composers/run`
- **No model, no temperature, no save config** — each prompt uses its own config
- Response: new `<ComposerStreamingResponse>` component (seamless assembled document)

### Cost Calculator
- Aggregated cost from all referenced prompts' `last_*_tokens` columns
- Data loaded in detail page loader via junction table joins
- Summed in the popover — no per-prompt breakdown

---

## Files Overview

### New files (17)

| File | Purpose |
|------|---------|
| `app/routes/composers.tsx` | Composers list page |
| `app/routes/composers.composerId.tsx` | Composer detail page (loader + action + editor) |
| `app/routes/layouts/composer-detail.tsx` | Detail layout (resizable panels, sidebar-right) |
| `app/routes/api/composer-info.ts` | Composer info endpoint for recents |
| `app/stores/composer-editor-store.ts` | Zustand + Zundo store |
| `app/hooks/use-composer-undo-redo.ts` | Undo/redo keyboard hook |
| `app/components/composer-sidebar-right.tsx` | Right sidebar (5 sections) |
| `app/components/composer-streaming-response.tsx` | NDJSON assembled document display |
| `app/components/composer-cost-calculator-popover.tsx` | Aggregated cost from referenced prompts |
| `app/components/composer-referenced-prompts.tsx` | Referenced prompts section |
| `app/components/composer-editor-menubar.tsx` | File + Edit menubar |
| `app/components/create-composer-dialog.tsx` | Create composer dialog |
| `app/components/publish-composer-dialog.tsx` | Publish version dialog |
| `app/components/delete-composer-dialog.tsx` | Delete confirmation dialog |
| `app/components/edit-composer-details-dialog.tsx` | Edit name/description dialog |
| `plans/composer-ui.md` | This plan (saved to repo) |

### Modified files (4)

| File | Change |
|------|--------|
| `app/routes.ts` | Add page routes + composer-info API route |
| `app/components/sidebar-left.tsx` | Add Composers nav item before Prompts |
| `app/hooks/use-recents.ts` | Add composer URL parsing + fetch |
| `app/components/nav-documents.tsx` | Add `IconFileMusic` for composer type |

---

## 1. Zustand Store — `app/stores/composer-editor-store.ts`

Mirror `snippet-editor-store.ts` structure with these differences:

### State shape

```typescript
type ComposerEditorState = {
  content: string;                    // The composer body (static text + ${prompt:id} refs)
  schemaFields: SchemaField[];        // Variable schema definitions
  inputData: unknown;                 // Test input JSON data
  inputDataRootName: string | null;   // Optional root variable name
  testVersionOverride: string | null; // Test-panel version selection

  // Aggregated cost data (loaded from junction + prompt versions)
  referencedPromptTokens: Array<{
    promptId: string;
    promptName: string;
    lastOutputTokens: number | null;
    lastSystemInputTokens: number | null;
    lastUserInputTokens: number | null;
    model: string | null;
  }>;

  _composerId: string | null;
  _initialized: boolean;
};
```

**Key difference from prompt store**: No `model`, `temperature`, `testModel`, `testTemperature`, `systemMessage`, `userMessage`. Only `content` (single field).

### Actions

| Action | Purpose |
|--------|---------|
| `initialize(data)` | Set all fields from loader data, clear undo history |
| `reset()` | Reset to initial state, clear undo history |
| `setContent(value)` | Normal content update (tracked in undo history) |
| `setContentFromRemote(value)` | Remote collab update (pauses Zundo) |
| `setSchemaFields(fields)` | Replace all schema fields |
| `addSchemaField(field)` | Append a schema field |
| `updateSchemaField(id, updates)` | Merge updates into a field by id |
| `deleteSchemaField(id)` | Remove a field by id |
| `setInputData(data, rootName?)` | Update input data |
| `setTestVersionOverride(version)` | Set test panel version |
| `setReferencedPromptTokens(tokens)` | Update cost calculator data |

### Zundo config

Same pattern as snippets: `partialize` excludes `_composerId`/`_initialized`, `limit: 100`, `handleSet` throttled at 500ms, `equality` via `JSON.stringify`.

---

## 2. Undo/Redo Hook — `app/hooks/use-composer-undo-redo.ts`

Mirror `use-snippet-undo-redo.ts` exactly, replacing `useSnippetEditorStore` → `useComposerEditorStore`. Uses `useSyncExternalStore` to subscribe to temporal state. Sets up global `beforeinput` and `keydown` listeners for `data-managed-undo` elements.

---

## 3. List Page — `app/routes/composers.tsx`

Mirror `app/routes/snippets.tsx`:

### Loader
1. Read `orgContext`
2. Query `composer_folder` for org
3. Find "Untitled" folder, defer query for composers in it (`id, name, description, updated_at WHERE deleted_at IS NULL ORDER BY updated_at DESC`)
4. Return `{ folders, composers (deferred), untitledFolderId }`

### Component
- **Empty state**: `IconFileMusic` icon, "No Composers Yet" title, `<CreateComposerDialog>` CTA
- **Non-empty**: Folder cards (hide "Untitled"), composer cards as `<NavLink to="/composers/{id}">` with `<Paper>`, last-updated timestamp, name, description (line-clamp-4). "New Composer" dashed card at end.

---

## 4. Detail Layout — `app/routes/layouts/composer-detail.tsx`

Mirror `app/routes/layouts/snippet-detail.tsx`:

- `sidebarRightRef = useRef<ComposerSidebarRightHandle>(null)`
- `useRouteLoaderData('composer-detail')` for sidebar props
- Cookie-persisted resizable panels (75/25 split)
- Mobile: stacked vertically
- Desktop: `ResizablePanelGroup` with `<Outlet key={params.composerId}>` + `<ComposerSidebarRight ref={sidebarRightRef}>`
- Outlet context: `{ triggerTest: () => sidebarRightRef.current?.triggerTest() }`

### Loader data passed to sidebar
```typescript
type ComposerDetailLoaderData = {
  versions: Version[];
  schema: SchemaField[];
  inputData: unknown;
  inputDataRootName: string | null;
  isViewingOldVersion?: boolean;
  referencedPrompts: Array<{
    promptId: string;
    promptName: string;
    promptVersionId: string | null;
    autoUpdate: boolean;
    versionString: string | null; // "X.X.X" or null for auto-update
    lastOutputTokens: number | null;
    lastSystemInputTokens: number | null;
    lastUserInputTokens: number | null;
    model: string | null;
  }>;
};
```

---

## 5. Detail Page — `app/routes/composers.composerId.tsx`

Mirror `app/routes/snippets.snippetId.tsx` with key differences:

### Loader

1. Auth + org check, `isOwner` role check
2. Parse `?version=X.X.X` query param
3. Fetch `composer` row (name, description, folder_id)
4. Fetch `composer_folder` row
5. Fetch ALL versions with JOINed user names (same pattern as snippets)
6. Resolve target version (draft-first, or specific semver)
7. Parse `config` JSON → `schema`, `inputData`, `inputDataRootName`
8. Fetch `lastPublishedVersion` for schema diff / suggested version
9. **Fetch referenced prompts** (new for composers):
   ```sql
   SELECT cvp.prompt_id, cvp.prompt_version_id, cvp.auto_update,
          p.name as prompt_name,
          pv.major, pv.minor, pv.patch,
          pv.last_output_tokens, pv.last_system_input_tokens,
          pv.last_user_input_tokens, pv.config as prompt_config
   FROM composer_version_prompt cvp
   JOIN prompt p ON cvp.prompt_id = p.id
   LEFT JOIN prompt_version pv ON cvp.prompt_version_id = pv.id
   WHERE cvp.composer_version_id = ?
   ```
10. For unpinned refs (`prompt_version_id IS NULL`), also fetch latest published version's tokens:
    ```sql
    SELECT id, last_output_tokens, last_system_input_tokens,
           last_user_input_tokens, config
    FROM prompt_version
    WHERE prompt_id = ? AND published_at IS NOT NULL
    ORDER BY major DESC, minor DESC, patch DESC LIMIT 1
    ```
11. Return full loader data including `referencedPrompts` array

### Action (two intents)

**`saveConfig`**: Reads `config` JSON (schema + inputData + inputDataRootName). Same draft upsert pattern: no version → INSERT, draft → UPDATE, published → INSERT new draft (copy content).

**Default (content save)**: Reads `content`. Same draft upsert pattern: no version → INSERT, draft → UPDATE, published → INSERT new draft (copy config).

### Component

- Store initialization via `needsInit` check (synchronous, not useEffect)
- `usePresence(composerId)` for collaboration
- `useDebouncedCallback(1000ms)` for auto-save → `fetcher.submit({ content })`
- `useComposerUndoRedo()` for keyboard shortcuts

**Version not found UI**: Same 404-style card with available version badges.

**Old version banner**: "Viewing version X.X.X (read-only)" + "Back to latest" button.

**Main render**:
- `<ComposerEditorMenubar>` + `<PublishComposerDialog>` in header (desktop)
- Composer name `<h1>`, version display (Draft or vX.X.X), description
- `<Separator>`
- Single `<PromptEditor title="Content">` with:
  - `value={content}`, `onChange={handleContentChange}`
  - `onTest={triggerTest}` (from outlet context)
  - `costCalculator={<ComposerCostCalculatorPopover />}`
  - `data-managed-undo` attribute
  - `<RemoteCursorsOverlay>` for collaboration
- `canPublish = hasDraft && hasContentChanges && !isReadOnly`
- `suggestedVersion`: major bump if schema changed, else minor bump

---

## 6. Right Sidebar — `app/components/composer-sidebar-right.tsx`

### Handle interface
```typescript
interface ComposerSidebarRightHandle {
  triggerTest: () => void;
  isStreaming: boolean;
}
```

### Props
```typescript
type ComposerSidebarRightProps = ComponentProps<typeof Sidebar> & {
  versions?: Version[];
  schema?: SchemaField[];
  inputData?: unknown;
  inputDataRootName?: string | null;
  isReadonly?: boolean;
  referencedPrompts?: ReferencedPrompt[];
};
```

### State from store
- `schemaFields`, `inputData`, `inputDataRootName`, `testVersionOverride`
- Actions: `setSchemaFields`, `setInputData`, `setTestVersionOverride`

### Config auto-save
`debouncedSaveConfig` (1000ms) — on schema or inputData change, submits `{ intent: 'saveConfig', config: JSON.stringify({ schema, inputData, inputDataRootName }) }`.

### Section 1 — Versions (defaultOpen=true)
Shared `<VersionsTable versions={versions} />`. Same row click → `setSearchParams`.

### Section 2 — Referenced Prompts (defaultOpen=false)
`<ComposerReferencedPrompts prompts={referencedPrompts} />`. Per prompt:
- Name as `<NavLink to="/prompts/{id}">`
- Version badge: pinned version string (e.g., "v1.2.3") or "auto-update" label
- Empty state: "No prompts referenced yet. Add ${prompt:id} references in the editor."

### Section 3 — Schema Builder (defaultOpen=false)
Reuse existing `<SchemaBuilder>` from `~/components/schema-builder.tsx`. Same `onFieldsChange` → `handleSchemaChange`. Disabled when `isReadonly`.

**No "Generate test data" button** for composers (no model configured at the composer level to use for generation). **Actually** — the generate test data calls a prompt directly, so it should work. Keep it if it works without a composer-level model. If the generation requires a model, disable the button.

### Section 4 — Generated Code (defaultOpen=false)
Reuse `<CodePreview fields={schemaFields} />` from `~/components/code-preview.tsx`.

### Section 5 — Test (controlled open)

**Input Data**: `<JsonEditor>` with light/dark themes (same as prompt sidebar).

**Composer Version**: `<Select>` with "Draft (current)" group + "Published Versions" group. Bound to `testVersionOverride`.

**Run button**: Full-width, gradient styling. Disabled while streaming or if version hasn't been selected.

**Response**: `<ComposerStreamingResponse>` (new component — see below).

### `handleRunComposer`
1. Reset stream state
2. POST FormData to `/api/composers/run` with `composerId`, `version`, `inputData`, `inputDataRootName`
3. Read response as NDJSON stream (line-by-line)
4. Parse each line as JSON, dispatch to `ComposerStreamingResponse` state
5. On `complete` message: check for errors

### `triggerTest`
Same pattern: open test collapsible, scroll into view, call `handleRunComposer` after 100ms.

---

## 7. Streaming Response — `app/components/composer-streaming-response.tsx`

New component that handles NDJSON assembled document display.

### Props
```typescript
type ComposerStreamingResponseProps = {
  segments: ComposerResponseSegment[];  // Document structure (from static + prompt_ref messages)
  promptOutputs: Map<string, string>;   // promptId → accumulated text
  isStreaming: boolean;
  isComplete: boolean;
  errors: Array<{ promptId: string; error: string }>;
};
```

### Rendering
- **Idle**: "Click Test to execute your composer..." (same empty state pattern as `StreamingResponse`)
- **Streaming/Complete**: Render segments in document order:
  - `static` segments: render interpolated text directly
  - `prompt_ref` segments: render the corresponding text from `promptOutputs.get(promptId)` — shows blinking cursor if that prompt is still streaming
- **Seamless**: No visual distinction between static and prompt-generated text. The assembled output looks like one continuous document.
- **Complete with errors**: Show error summary below the assembled text (subtle destructive styling)
- **Copy button**: Available when complete (copies full assembled text)

### State management (in parent sidebar)
The parent sidebar component manages the NDJSON parsing:
```typescript
const [segments, setSegments] = useState<ComposerResponseSegment[]>([]);
const [promptOutputs, setPromptOutputs] = useState<Map<string, string>>(new Map());
const [errors, setErrors] = useState<Array<{ promptId: string; error: string }>>([]);
```

NDJSON line handler:
- `static` → append to segments array
- `prompt_ref` → append to segments array
- `prompt_chunk` → update `promptOutputs` map (accumulate)
- `prompt_done` → mark prompt as done (for cursor removal)
- `complete` → set errors, mark streaming complete

---

## 8. Cost Calculator — `app/components/composer-cost-calculator-popover.tsx`

### Data source
The `referencedPromptTokens` array in the store (initialized from loader data). Each entry has:
- `promptId`, `promptName`, `model`
- `lastOutputTokens`, `lastSystemInputTokens`, `lastUserInputTokens`

### Calculation
For each referenced prompt:
1. Look up the model's pricing from `MODEL_PRICING` (`~/lib/model-pricing.ts`)
2. Calculate input cost: `(systemTokens + userTokens) / 1M * inputPrice`
3. Calculate output cost: `outputTokens / 1M * outputPrice`
4. Sum across all referenced prompts

### UI
Mirror prompt cost calculator popover pattern:
- Show total estimated cost (sum of all referenced prompts)
- Currency conversion via Frankfurter API (same `useSyncExternalStore` pattern)
- "Run individual prompt tests for accurate token counts" hint when some prompts have null tokens
- Simpler than prompt calculator — no cached input toggle, no per-prompt breakdown needed

---

## 9. Dialogs

### `create-composer-dialog.tsx`
Mirror `create-snippet-dialog.tsx`. Form with name + description inputs. POSTs to `/api/composers/create`. Redirects on success.

### `publish-composer-dialog.tsx`
Mirror `publish-snippet-dialog.tsx`. `<VersionInput>`, suggested version, POSTs to `/api/composers/publish` with `composerId` + `version`. Description says "Publishing makes this version available via the API."

### `delete-composer-dialog.tsx`
Mirror `delete-snippet-dialog.tsx`. Owner-only confirmation dialog. POSTs to `/api/composers/delete`.

### `edit-composer-details-dialog.tsx`
Mirror `edit-snippet-details-dialog.tsx`. Name + description inputs. POSTs to `/api/composers/update`.

---

## 10. Menubar — `app/components/composer-editor-menubar.tsx`

Mirror `snippet-editor-menubar.tsx`:
- **File** → Share (Copy link, Copy Composer ID) → Delete (owner-only, opens `<DeleteComposerDialog>`)
- **Edit** → Undo, Redo (via `useComposerUndoRedo`) → Edit Details (opens `<EditComposerDetailsDialog>`)

---

## 11. Recents Integration

### `app/hooks/use-recents.ts` modifications

**`parseResourceUrl`**: Add composer pattern:
```typescript
const composerMatch = pathname.match(/^\/composers\/([^/]+)$/);
if (composerMatch) return { id: composerMatch[1], type: 'composer' };
```

**`fetchComposerInfo`**: New function mirroring `fetchSnippetInfo`:
```typescript
const fetchComposerInfo = async (composerId: string): Promise<PromptInfo | null> => {
  const response = await fetch(`/api/composer-info?composerId=${composerId}`);
  // ... map to PromptInfo shape with type: 'composer'
};
```

**`setupNavigationListener`**: Add `'composer'` branch to `fetchFn` selection.

### `app/components/nav-documents.tsx` modifications
Add `IconFileMusic` icon for items with `type === 'composer'`.

### `app/routes/api/composer-info.ts` (new)
Mirror `app/routes/api/snippet-info.ts`. GET endpoint that returns:
```typescript
{ composerId, composerName, folderId, folderName, version, url }
```

---

## 12. Route Registration — `app/routes.ts`

### Add page routes
Inside `layout('./routes/layouts/app.tsx', [...])`:
```typescript
route('composers', './routes/composers.tsx'),
```

### Add detail layout + route
After the snippet detail layout block:
```typescript
layout('./routes/layouts/composer-detail.tsx', [
  route('composers/:composerId', './routes/composers.composerId.tsx', {
    id: 'composer-detail',
  }),
]),
```

### Add API route
```typescript
route('api/composer-info', './routes/api/composer-info.ts'),
```

---

## 13. Sidebar Nav — `app/components/sidebar-left.tsx`

Add to `navMain` array **before** Prompts:
```typescript
{ title: 'Composers', url: '/composers', icon: IconFileMusic },
```

Import `IconFileMusic` from `@tabler/icons-react`.

---

## Existing Components Reused (no modifications needed)

| Component | File | Used for |
|-----------|------|----------|
| `VersionsTable` | `app/components/versions-table.tsx` | Versions section |
| `SchemaBuilder` | `app/components/schema-builder.tsx` | Schema section |
| `CodePreview` | `app/components/code-preview.tsx` | Generated code section |
| `PromptEditor` | `app/components/prompt-editor.tsx` | Main content editor |
| `RemoteCursorsOverlay` | `app/components/remote-cursors-overlay.tsx` | Collaboration |
| `VersionInput` | `app/components/ui/version-input.tsx` | Publish dialog |
| `SelectScrollable` | `app/components/ui/select-scrollable.tsx` | N/A (no model selector needed) |
| `NoLlmApiKeysModal` | `app/components/no-llm-api-keys-modal.tsx` | Run requires API keys for prompts |
| `SidebarSlider` | `app/components/sidebar-slider.tsx` | N/A (no temperature) |

---

## Implementation Order

| Phase | Files | Dependencies |
|-------|-------|-------------|
| 1. Store + hooks | `composer-editor-store.ts`, `use-composer-undo-redo.ts` | None |
| 2. Dialogs | `create-composer-dialog.tsx`, `publish-composer-dialog.tsx`, `delete-composer-dialog.tsx`, `edit-composer-details-dialog.tsx` | None |
| 3. Streaming component | `composer-streaming-response.tsx` | None |
| 4. Cost calculator | `composer-cost-calculator-popover.tsx` | None |
| 5. Referenced prompts | `composer-referenced-prompts.tsx` | None |
| 6. Menubar | `composer-editor-menubar.tsx` | Phase 1 (undo/redo), Phase 2 (delete/edit dialogs) |
| 7. Right sidebar | `composer-sidebar-right.tsx` | Phase 1-5 |
| 8. List page | `composers.tsx` | Phase 2 (create dialog) |
| 9. Detail page + layout | `composers.composerId.tsx`, `composer-detail.tsx` | Phase 1, 6, 7 |
| 10. Navigation + recents | `sidebar-left.tsx`, `use-recents.ts`, `nav-documents.tsx`, `composer-info.ts` | None |
| 11. Route registration | `routes.ts` | Phase 8-10 |
| 12. Verify | Lint, typecheck, e2e, Chrome DevTools MCP | Phase 11 |

---

## Verification

1. `bun run lint:fix` — no lint errors
2. `bun run typecheck` — no type errors
3. `bun run test:e2e` — existing tests still pass
4. **Chrome DevTools MCP** (both light and dark modes):
   - Navigate to `/composers` — see empty state with `IconFileMusic`
   - Create a composer via dialog — redirects to `/composers/{id}`
   - Type content with `${prompt:id}` references in the editor
   - Verify auto-save (debounced) — content persists on reload
   - Open Schema Builder — add fields, verify config saves
   - Open Referenced Prompts section — verify prompt names and version pins display
   - Open Test panel — add input data, select version, run test
   - Verify NDJSON streaming assembles into seamless document
   - Publish a version — verify semver dialog and version table update
   - Edit name/description via Edit menu
   - Delete via File menu (owner-only)
   - Verify composer appears in left sidebar Recents
   - Open cost calculator — verify aggregated cost from referenced prompts
   - Test undo/redo (Cmd+Z / Cmd+Shift+Z)
   - Test collaboration: open two tabs, verify remote cursors and content sync
   - Test version browsing: click old version in table, verify read-only banner
5. Mobile responsive check at 375px width — sidebar stacks below editor
