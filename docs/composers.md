# Composers Feature

Composers are rich-text documents that orchestrate multiple prompts into a single assembled output. Unlike prompts (system/user message pairs for a single LLM call), a composer is a free-form TipTap HTML document where you embed **prompt references** and **variable references** as inline badges. Running a composer executes all referenced prompts in parallel, then streams back the assembled document with static HTML and LLM-generated output interleaved.

## Architecture Overview

| Aspect | Prompts | Composers |
|--------|---------|-----------|
| Editor | Plain `<textarea>` | TipTap rich text (WYSIWYG) |
| Content format | Plain text templates | HTML with custom `<span>` node embeddings |
| Variables | `{{variable}}` mustache syntax | `VariableRefNode` — draggable inline badges |
| Prompt refs | N/A | `PromptRefNode` — inline badges linking to other prompts |
| Undo/redo | Zundo only | Dual: ProseMirror history for content; Zundo for schema/inputData |
| Right sidebar | Config, model, tokens, versions, test | Schema Builder, Input Data (JSON), Generated Code, Versions, Test |

## Database Schema

Migration: `migrations/drizzle/0019_add_composer_tables.sql`

| Table | Purpose |
|-------|---------|
| `composer_folder` | Org-scoped folder grouping (mirrors `snippet_folder`) |
| `composer` | Top-level record: name, description, folder_id, organization_id, deleted_at |
| `composer_version` | Versioned content: `content` (HTML), `config` (JSON), semver fields, published_at |
| `composer_version_prompt` | Junction: links version → prompt. `auto_update` flag, `prompt_version_id` (NULL=latest, pinned on publish) |

Key invariants:
- Only one draft per composer (where `published_at IS NULL`)
- Saving to a published version auto-creates a new draft
- Publishing pins all prompt version references to their current latest published version
- `prompt_id` FK is `ON DELETE RESTRICT` — can't delete a prompt referenced by a composer

## Directory Structure

```
app/components/composer-editor/
├── composer-editor.tsx         # Main TipTap editor component
├── composer-toolbar.tsx        # Overflow-responsive toolbar with priority system
├── extensions/
│   ├── index.ts                # getComposerExtensions() — all extension config
│   ├── prompt-ref-extension.ts # Custom inline atom: data-prompt-ref spans
│   ├── variable-ref-extension.ts # Custom inline atom: data-variable-ref spans
│   └── atom-gap-extension.ts   # ProseMirror plugin: drop targets between atoms
├── prompt-ref-badge.tsx        # NodeView renderer for prompt references
├── variable-ref-badge.tsx      # NodeView renderer for variable references
├── prompt-ref-picker.tsx       # Command popover to insert prompt refs
├── variable-ref-picker.tsx     # Command popover to insert variable refs
├── toolbar-*.tsx               # Toolbar sub-components (heading, list, marks, etc.)
└── index.ts                    # Re-exports ComposerEditor

app/stores/composer-editor-store.ts  # Zustand + Zundo temporal
app/hooks/use-composer-undo-redo.ts  # Keyboard undo/redo delegation
app/lib/validations/composer.ts      # Zod schemas
app/lib/composer-content-parser.ts   # Regex HTML parser (no DOM — Workers-safe)
app/lib/composer-junction-sync.server.ts # Syncs junction table on content save
```

## API Routes

All under `/api/composers/`:

| Route file | Purpose |
|------------|---------|
| `composers.create.ts` | Create composer + initial empty draft; redirect to `/composers/:id` |
| `composers.update.ts` | Update name/description |
| `composers.delete.ts` | Soft delete (owner-only) |
| `composers.save-content.ts` | Auto-save HTML; creates new draft if current is published; syncs junction table |
| `composers.save-config.ts` | Auto-save config JSON (schema + inputData); same draft logic |
| `composers.publish.ts` | Publish draft with semver; pins prompt version refs |
| `composers.run.ts` | Execute composer — resolve prompts, run LLMs in parallel, stream NDJSON |
| `composer-info.ts` | GET loader — name, folder, latest published version |

## Page Routes

| Route | File | Purpose |
|-------|------|---------|
| `/composers` | `composers.tsx` | List page with cards grid + folders |
| `/composers/:composerId` | `composers.composerId.tsx` | Detail page with editor |
| Layout | `layouts/composer-detail.tsx` | Resizable two-panel layout (editor + right sidebar) |

## TipTap Extensions

`getComposerExtensions()` in `extensions/index.ts` configures:

StarterKit (H1-H3, bold, italic, strike, code, blockquote, lists, hr, code block), Underline, TextStyle + Color, Highlight (multicolor), TextAlign, Link (openOnClick: false), Table + Row + Cell + Header (resizable), TaskList + TaskItem (nested), Placeholder, **PromptRefNode** (custom), **VariableRefNode** (custom), **AtomGap** (custom ProseMirror plugin)

### Custom Nodes

- **PromptRefNode**: Inline atom → `<span data-prompt-ref data-prompt-id="..." data-prompt-name="...">`. Command: `editor.commands.insertPromptRef({ promptId, promptName })`
- **VariableRefNode**: Inline atom → `<span data-variable-ref data-field-id="..." data-field-path="...">`. Command: `editor.commands.insertVariableRef({ fieldId, fieldPath })`
- **AtomGap**: ProseMirror `Decoration.widget` — inserts invisible spans between adjacent atoms for drag-and-drop targets

## Store (`composer-editor-store.ts`)

Zustand with Zundo temporal middleware. Key state: `content` (HTML), `schemaFields`, `inputData`, `inputDataRootName`, `testVersionOverride`.

Design decisions:
- `content` is **excluded from Zundo snapshots** — TipTap's ProseMirror history handles editor undo/redo
- `setContentFromRemote()` pauses temporal tracking to avoid WebSocket updates polluting undo history
- Temporal snapshots throttled at 500ms
- `initialize()` clears temporal history when navigating to a new composer

## Content Serialization

Content is stored as **HTML strings** (via `editor.getHTML()`). On the server, `composer-content-parser.ts` uses regex parsing (no DOM — Workers have no DOM API):
- `parseComposerContent(html)` → splits into `ComposerSegment[]` (`static` | `prompt`) at `data-prompt-ref` boundaries
- `replaceVariableRefs(html, inputData, rootName)` → interpolates variable spans with values from input data
- `extractPromptIds(html)` / `extractVariableIds(html)` — used for junction table sync

## Execution Flow (`composers.run.ts`)

1. Parse HTML into ordered segments (static / prompt)
2. Resolve each prompt's version (pinned > latest published > latest draft)
3. Run all prompts **in parallel** via `generateText()` from AI SDK
4. Stream assembled document as NDJSON in document order:
   - `{type:'static', content, index}` — HTML with variable refs already replaced
   - `{type:'prompt_ref', promptId, promptName, index}` — signals a prompt slot
   - `{type:'prompt_start', promptId}` → `{type:'prompt_chunk', promptId, chunk}` → `{type:'prompt_done', promptId}`
   - `{type:'complete', errors: []}`

Duplicate prompt IDs in the document share the same output (de-duplicated by `streamedPrompts` set).

## Toolbar Overflow System

The toolbar uses `useToolbarOverflow` (ResizeObserver-based) with priority levels. Items with `overflowPriority: Infinity` are pinned; others cascade into a `ToolbarOverflowMenu` (`...` button). "Add prompt" and "Add variable" buttons progressively collapse: text disappears → merge into single `ToolbarInsertPicker` sparkles button → overflow entirely.

## Version Suggestion Logic

When publishing, the suggested version auto-increments based on change type: schema changed → major bump (e.g., `2.0.0`), only content changed → minor bump (e.g., `1.1.0`).

