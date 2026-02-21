# Plan 2: Snippets — UI Integration & Implementation

## Overview

This plan covers all frontend components, stores, routes, and modifications needed for the Snippets feature. Every component mirrors its Prompts counterpart with adjustments for the simpler snippet data model.

---

## 1. Zustand Store

### File: `app/stores/snippet-editor-store.ts`

**Based on**: `app/stores/prompt-editor-store.ts`

#### State shape

```typescript
interface SnippetEditorState {
  // Content (single field, tracked for undo)
  content: string;

  // Config (persisted to snippet_version.config JSON)
  model: string | null;
  testUserMessage: string;

  // Test overrides (not persisted)
  testModel: string | null;
  testVersionOverride: string | null;

  // Token tracking
  lastOutputTokens: number | null;
  lastSystemInputTokens: number | null;

  // Internal (excluded from undo history via partialize)
  _snippetId: string | null;
  _initialized: boolean;
}
```

**Removed from prompt store**: `systemMessage`, `userMessage` (replaced by single `content`), `schemaFields`, `temperature`, `inputData`, `inputDataRootName`, `testTemperature`, `lastUserInputTokens`

**Added**: `testUserMessage` (persisted test phrase, stored in config JSON)

#### Actions

```typescript
interface SnippetEditorActions {
  // Initialization
  initialize: (data: InitializeData) => void;
  reset: () => void;

  // Content (tracked in undo history)
  setContent: (value: string) => void;

  // Content from remote (pauses Zundo history)
  setContentFromRemote: (value: string) => void;

  // Config
  setModel: (model: string | null) => void;
  setTestUserMessage: (message: string) => void;

  // Test overrides
  setTestModel: (model: string | null) => void;
  setTestVersionOverride: (version: string | null) => void;

  // Token tracking
  setLastOutputTokens: (tokens: number | null) => void;
  setLastSystemInputTokens: (tokens: number | null) => void;
}
```

#### InitializeData type

```typescript
interface InitializeData {
  snippetId: string;
  content: string;
  model: string | null;
  testUserMessage: string;
  lastOutputTokens: number | null;
  lastSystemInputTokens: number | null;
}
```

#### Zundo temporal middleware config

Same pattern as prompt store:

```typescript
export const useSnippetEditorStore = create<SnippetEditorStore>()(
  temporal(
    (set, get) => ({ ... }),
    {
      partialize: (state) => ({
        content: state.content,
        model: state.model,
        testUserMessage: state.testUserMessage,
        testModel: state.testModel,
        testVersionOverride: state.testVersionOverride,
        lastOutputTokens: state.lastOutputTokens,
        lastSystemInputTokens: state.lastSystemInputTokens,
        // _snippetId and _initialized EXCLUDED
      }),
      limit: 100,
      handleSet: (handleSet) =>
        createThrottle<typeof handleSet>((state) => {
          handleSet(state);
        }, 500),
      equality: (pastState, currentState) =>
        JSON.stringify(pastState) === JSON.stringify(currentState),
    },
  ),
);
```

Copy the `createThrottle` helper function from `prompt-editor-store.ts` (it's defined locally at the top of that file).

#### Key behaviors
- `initialize()` calls `temporal.getState().clear()` at the end (baseline for undo)
- `setContentFromRemote()` calls `temporal.pause()` before set and `temporal.resume()` after (skips undo)
- Store is a singleton — navigation between snippets calls `initialize()` / `reset()`

---

## 2. Route Pages

### 2.1 List Page: `app/routes/snippets.tsx`

**Based on**: `app/routes/prompts.tsx`

#### Imports

```typescript
import { IconPuzzle } from '@tabler/icons-react';
import { ArrowUpRightIcon, PlusIcon } from 'lucide-react';
import { Suspense } from 'react';
import { Await, NavLink } from 'react-router';
import { CreateSnippetDialog } from '~/components/create-snippet-dialog';
import { Button } from '~/components/ui/button';
import {
  Empty, EmptyContent, EmptyDescription,
  EmptyHeader, EmptyMedia, EmptyTitle,
} from '~/components/ui/empty';
import { Folder } from '~/components/ui/folder';
import { Paper } from '~/components/ui/paper';
import { orgContext } from '~/context';
import type { Route } from './+types/snippets';
```

#### Loader

Same pattern as prompts.tsx but queries snippet tables:

```sql
-- Fetch snippet folders
SELECT id, name FROM snippet_folder WHERE organization_id = ?

-- Find Untitled folder
-- (filter in JS: folder.name === 'Untitled')

-- Fetch snippets from Untitled folder (deferred)
SELECT id, name, description, updated_at
  FROM snippet
  WHERE folder_id = ? AND organization_id = ? AND deleted_at IS NULL
  ORDER BY updated_at DESC
```

Returns: `{ folders, snippets (deferred), untitledFolderId }`

#### Component

Same layout as prompts.tsx:

- **Empty state**: `IconPuzzle` icon, title "No Snippets Yet", description about reusable system prompt content, `CreateSnippetDialog` wrapping a "Create Snippet" button
- **List state**: Folder grid (non-"Untitled" folders) + snippet cards grid
  - Cards show: name, description (truncated via `line-clamp-4`), last updated timestamp
  - Each card is a `NavLink` to `/snippets/${snippet.id}`
  - "New Snippet" add card at end triggers `CreateSnippetDialog`

---

### 2.2 Detail Page: `app/routes/snippets.snippetId.tsx`

**Based on**: `app/routes/prompts.promptId.tsx`

#### Imports

```typescript
import { ArrowLeft, GitBranch, RssIcon } from 'lucide-react';
import { nanoid } from 'nanoid';
import { useCallback, useMemo, useRef, useState } from 'react';
import {
  data, useFetcher, useLocation, useNavigate,
  useOutletContext, useSearchParams,
} from 'react-router';
import { useDebouncedCallback } from 'use-debounce';
import { PromptEditor } from '~/components/prompt-editor';
import { SnippetEditorMenubar } from '~/components/snippet-editor-menubar';
import { PublishSnippetDialog } from '~/components/publish-snippet-dialog';
import { ReadOnlyPlanBanner } from '~/components/read-only-plan-banner';
import { RemoteCursorsOverlay } from '~/components/remote-cursors-overlay';
import { Badge, Button, Separator } from '~/components/ui/...';
import type { Version } from '~/components/versions-table';
import { orgContext } from '~/context';
import { usePresence } from '~/hooks/use-presence';
import { useUndoRedo } from '~/hooks/use-undo-redo';
import { getAuth } from '~/lib/auth.server';
import { useSnippetEditorStore } from '~/stores/snippet-editor-store';
import type { Route } from './+types/snippets.snippetId';
```

#### Outlet Context Type

```typescript
type SnippetDetailContext = {
  triggerTest: () => void;
  getIsTestRunning: () => boolean;
};
```

#### Loader

Same structure as prompts.promptId.tsx loader but with snippet tables:

```sql
-- Snippet lookup
SELECT id, name, description, folder_id FROM snippet WHERE id = ? AND organization_id = ? AND deleted_at IS NULL

-- Folder lookup
SELECT id, name FROM snippet_folder WHERE id = ?

-- All versions
SELECT id, major, minor, patch, updated_at, updated_by, published_at, published_by, created_by
  FROM snippet_version WHERE snippet_id = ? ORDER BY created_at DESC

-- Target version content
SELECT id, content, config, major, minor, patch, last_output_tokens, last_system_input_tokens,
       published_at, published_by, created_by, updated_at, updated_by
  FROM snippet_version WHERE snippet_id = ? AND ...  -- (version resolution)

-- Last published version (for comparison)
SELECT id, content, major, minor, patch
  FROM snippet_version WHERE snippet_id = ? AND published_at IS NOT NULL
  ORDER BY major DESC, minor DESC, patch DESC LIMIT 1
```

Config JSON parsing extracts: `model`, `testUserMessage`

**No `isReadOnlyDueToLimit` check** — snippets are unlimited, no plan gating.

Returns:
```typescript
{
  folder, snippet, currentVersion, versions, content,
  model, testUserMessage,
  lastOutputTokens, lastSystemInputTokens,
  lastPublishedVersion, lastPublishedContent,
  hasDraft, isViewingOldVersion,
  versionNotFound, requestedVersion, isOwner,
}
```

#### Action

Two intents:

1. **`intent === 'saveConfig'`** — saves model + testUserMessage to `snippet_version.config`
   - Check if draft exists; if published, create new draft copying content
   - Build config JSON: `{ model, testUserMessage }`
   - UPDATE `snippet_version SET config = ? WHERE id = ?`

2. **Default (no intent)** — saves `content` to `snippet_version.content`
   - Check if draft exists; if published, create new draft
   - UPDATE `snippet_version SET content = ?, updated_at = ?, updated_by = ? WHERE id = ?`
   - UPDATE `snippet SET updated_at = ? WHERE id = ?`

Returns: `{ success: true, savedAt: Date.now(), intent?: 'saveConfig' }`

#### Component

Same initialization pattern as prompts detail:
```typescript
const needsInit = lastKey !== currentKey || useSnippetEditorStore.getState()._snippetId !== loaderData.snippet.id;
if (needsInit) {
  useSnippetEditorStore.getState().initialize({ ... });
}
```

**Auto-save**: `useDebouncedCallback` with 1000ms delay, submits `{ content }` via fetcher.

**Version suggestion**: Always suggest minor bump (no schema change detection):
```typescript
const suggestedVersion = useMemo(() => {
  if (!lastVersion) return '1.0.0';
  return `${lastVersion.major}.${lastVersion.minor + 1}.0`;
}, [loaderData.lastPublishedVersion]);
```

**JSX layout** (key differences from prompts detail):
- Version-not-found state: same pattern but with snippet name
- **Single PromptEditor** with title `"System Prompt Snippet"`:
  ```tsx
  <PromptEditor
    title="System Prompt Snippet"
    value={content}
    onChange={isReadOnly ? undefined : handleContentChange}
    isDirty={isContentDirty}
    isPendingSave={isPendingContentSaveRef.current}
    lastSavedAt={lastContentSavedAtRef.current}
    onTest={triggerTest}
    textareaRef={...}
    onSelectionChange={...}
    cursorOverlay={<RemoteCursorsOverlay />}
    disabled={isReadOnly}
  />
  ```
- **No second editor** (no User Prompt section)
- **No `TrialExpiredModal`** (no plan gating for snippets)
- **No `ReadOnlyPlanBanner`** (no plan gating)
- Menubar: `SnippetEditorMenubar` instead of `PromptEditorMenubar`
- Publish dialog: `PublishSnippetDialog` instead of `PublishPromptDialog`

---

### 2.3 Layout: `app/routes/layouts/snippet-detail.tsx`

**Based on**: `app/routes/layouts/prompt-detail.tsx`

#### Imports

```typescript
import { useMemo, useRef } from 'react';
import { Outlet, useParams, useRouteLoaderData } from 'react-router';
import { SidebarAutoHide } from '~/components/sidebar-auto-hide';
import { SidebarLeft } from '~/components/sidebar-left';
import { SnippetSidebarRight, type SnippetSidebarRightHandle } from '~/components/snippet-sidebar-right';
import { SiteHeader } from '~/components/site-header';
import { TrialBanner } from '~/components/trial-banner';
import {
  type LayoutStorage, ResizableHandle, ResizablePanel,
  ResizablePanelGroup, useDefaultLayout,
} from '~/components/ui/resizable';
import { SidebarInset, SidebarProvider } from '~/components/ui/sidebar';
import type { Version } from '~/components/versions-table';
import { useIsMobile } from '~/hooks/use-mobile';
import type { loader as rootLoader } from '~/root';
```

#### Loader data type

```typescript
type SnippetDetailLoaderData = {
  versions: Version[];
  model: string | null;
  testUserMessage: string;
  isViewingOldVersion?: boolean;
};
```

**Removed from prompt layout type**: `schema`, `temperature`, `inputData`, `inputDataRootName`, `isReadOnlyDueToLimit`

#### Cookie persistence

Same `LAYOUT_COOKIE_NAME` pattern (`'panel-layout'`) — shares the same cookie as prompts since the layout proportions are the same.

#### Outlet context

```typescript
{
  triggerTest: () => sidebarRightRef.current?.triggerTest(),
  getIsTestRunning: () => sidebarRightRef.current?.isStreaming ?? false,
}
```

#### JSX

Same `ResizablePanelGroup` structure:
- Main content panel (75% default, 50% min)
- Resizable handle
- Sidebar right panel (25% default, 25% min)

Desktop: `<SnippetSidebarRight ref={sidebarRightRef} versions={...} ... />`
Mobile: Same stacked layout with sidebar below content

---

## 3. Components

### 3.1 `app/components/snippet-sidebar-right.tsx`

**Based on**: `app/components/sidebar-right.tsx` (heavily stripped down)

#### Exported interface

```typescript
export interface SnippetSidebarRightHandle {
  triggerTest: () => void;
  isStreaming: boolean;
}
```

#### Props

```typescript
type SnippetSidebarRightProps = React.ComponentProps<typeof Sidebar> & {
  versions?: Version[];
  model?: string | null;
  testUserMessage?: string;
  isReadonly?: boolean;
};
```

#### Component signature

```typescript
export const SnippetSidebarRight = forwardRef<SnippetSidebarRightHandle, SnippetSidebarRightProps>(
  ({ versions = [], isReadonly = false, ...props }, ref) => { ... }
);
SnippetSidebarRight.displayName = 'SnippetSidebarRight';
```

#### Zustand store subscriptions (from `useSnippetEditorStore`)

```typescript
const model = useSnippetEditorStore((s) => s.model);
const testModel = useSnippetEditorStore((s) => s.testModel);
const testUserMessage = useSnippetEditorStore((s) => s.testUserMessage);
const testVersionOverride = useSnippetEditorStore((s) => s.testVersionOverride);
const setTestModel = useSnippetEditorStore((s) => s.setTestModel);
const setTestUserMessage = useSnippetEditorStore((s) => s.setTestUserMessage);
const setTestVersionOverride = useSnippetEditorStore((s) => s.setTestVersionOverride);
const setLastOutputTokens = useSnippetEditorStore((s) => s.setLastOutputTokens);
const setLastSystemInputTokens = useSnippetEditorStore((s) => s.setLastSystemInputTokens);
```

#### Collapsible sections (3 total, vs 6 in prompt sidebar)

| Fragment key | Section | defaultOpen | Content |
|---|---|---|---|
| 0 | Versions | true | `<VersionsTable versions={...} />` |
| 1 | Used by | false | Prompts referencing this snippet (new) |
| 2 | Test | controlled (`testOpen`) | Test phrase + model + run + response |

#### "Used by" section (new)

Fetches data from a loader or inline query. Displays a table:

```tsx
<SidebarGroup>
  <Collapsible defaultOpen={false}>
    <SidebarGroupLabel asChild>
      <CollapsibleTrigger>Used by <ChevronRight /></CollapsibleTrigger>
    </SidebarGroupLabel>
    <CollapsibleContent>
      <SidebarGroupContent>
        {usedByPrompts.length === 0 ? (
          <p className="text-xs text-muted-foreground px-2 py-3">
            No prompts are using this snippet yet.
          </p>
        ) : (
          <div className="space-y-1">
            {usedByPrompts.map((p) => (
              <NavLink key={p.promptId} to={`/prompts/${p.promptId}`}
                className="flex items-center justify-between px-2 py-1.5 text-xs hover:bg-accent rounded">
                <span className="truncate font-medium">{p.promptName}</span>
                {p.snippetVersion && (
                  <Badge variant="outline" className="text-[10px] font-mono">
                    v{p.snippetVersion}
                  </Badge>
                )}
              </NavLink>
            ))}
          </div>
        )}
      </SidebarGroupContent>
    </CollapsibleContent>
  </Collapsible>
</SidebarGroup>
```

Data source: The snippet detail loader fetches "used by" data:
```sql
SELECT p.id as prompt_id, p.name as prompt_name,
       pvs.snippet_version_id,
       sv.major, sv.minor, sv.patch
  FROM prompt_version_snippet pvs
  JOIN prompt_version pv ON pvs.prompt_version_id = pv.id
  JOIN prompt p ON pv.prompt_id = p.id
  LEFT JOIN snippet_version sv ON pvs.snippet_version_id = sv.id
  WHERE pvs.snippet_id = ?
    AND p.deleted_at IS NULL
  GROUP BY p.id
  ORDER BY p.name
```

#### Test section

```tsx
<SidebarGroup ref={testSectionRef}>
  <Collapsible open={testOpen} onOpenChange={setTestOpen}>
    <SidebarGroupLabel asChild>
      <CollapsibleTrigger>Test <ChevronRight /></CollapsibleTrigger>
    </SidebarGroupLabel>
    <CollapsibleContent>
      <SidebarGroupContent className="flex flex-col gap-3 px-2">
        {/* Test phrase combobox */}
        <div className="space-y-1.5">
          <Label className="text-xs">Test phrase</Label>
          <SnippetTestCombobox
            value={testUserMessage}
            onChange={handleTestUserMessageChange}
          />
        </div>

        {/* Model select */}
        <div className="space-y-1.5">
          <Label className="text-xs">Model</Label>
          <SelectScrollable
            value={testModelToUse}
            onValueChange={setTestModel}
          />
        </div>

        {/* Run button */}
        <Button
          onClick={handleRunSnippet}
          disabled={isStreaming || !testUserMessage.trim()}
          className="w-full"
        >
          {isStreaming ? 'Running...' : 'Test'}
        </Button>

        {/* Streaming response */}
        <StreamingResponse
          text={streamText}
          isStreaming={isStreaming}
          isComplete={isComplete}
          error={streamError}
        />
      </SidebarGroupContent>
    </CollapsibleContent>
  </Collapsible>
</SidebarGroup>
```

**Removed from prompt sidebar test section:**
- Input data JSON editor
- Prompt version selector
- Temperature slider
- "Save config" button

#### `handleRunSnippet` function

```typescript
const handleRunSnippet = useCallback(async () => {
  // Check for API keys (same pattern as prompt sidebar)
  // Reset stream state
  setStreamText('');
  setIsStreaming(true);
  setIsComplete(false);
  setStreamError(null);

  const formData = new FormData();
  formData.set('snippetId', snippetId);
  formData.set('userMessage', testUserMessage);
  if (testModelToUse) formData.set('model', testModelToUse);
  if (testVersionOverride) formData.set('version', testVersionOverride);

  const response = await fetch('/api/snippets/run', {
    method: 'POST',
    body: formData,
  });

  // Same streaming reader pattern as prompt sidebar
  const reader = response.body?.getReader();
  const decoder = new TextDecoder();
  // ... read chunks, update streamText, check for [Error:...] markers
  // ... on complete: setIsComplete(true), fetch usage, update token store

  // Fetch usage after stream completes
  const usageRes = await fetch(`/api/snippets/usage?snippetId=${snippetId}&version=draft`);
  const usage = await usageRes.json();
  setLastOutputTokens(usage.outputTokens);
  setLastSystemInputTokens(usage.systemInputTokens);
}, [snippetId, testUserMessage, testModelToUse, testVersionOverride]);
```

#### `useImperativeHandle`

```typescript
useImperativeHandle(ref, () => ({
  triggerTest: handleRunSnippet,
  isStreaming,
}), [handleRunSnippet, isStreaming]);
```

---

### 3.2 `app/components/snippet-test-combobox.tsx` (New)

Shadcn Combobox pattern (Popover + Command).

```typescript
import { IconCheck, IconChevronDown } from '@tabler/icons-react';
import { useState } from 'react';
import { Button } from '~/components/ui/button';
import {
  Command, CommandEmpty, CommandGroup,
  CommandInput, CommandItem, CommandList,
} from '~/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '~/components/ui/popover';
import { cn } from '~/lib/utils';
```

#### Suggested phrases (hardcoded constant)

```typescript
const SUGGESTED_PHRASES = [
  'Write a short welcome message for a new customer',
  'Explain a delivery delay to a frustrated customer',
  'Write a pricing summary for a £49.99 product',
  'Summarise three benefits of using our service',
  'Draft a short disclaimer about data usage',
];
```

#### Props

```typescript
interface SnippetTestComboboxProps {
  value: string;
  onChange: (value: string) => void;
}
```

#### Component

```typescript
export const SnippetTestCombobox = ({ value, onChange }: SnippetTestComboboxProps) => {
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState('');

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" className="w-full justify-between text-left h-auto min-h-9">
          <span className="truncate text-xs">
            {value || 'Select or type a test phrase...'}
          </span>
          <IconChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command>
          <CommandInput
            placeholder="Type a custom phrase..."
            value={inputValue}
            onValueChange={setInputValue}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && inputValue.trim()) {
                onChange(inputValue.trim());
                setOpen(false);
              }
            }}
          />
          <CommandList>
            <CommandEmpty>
              {inputValue.trim() ? (
                <button onClick={() => { onChange(inputValue.trim()); setOpen(false); }}
                  className="w-full text-left px-2 py-1.5 text-xs">
                  Use "{inputValue.trim()}"
                </button>
              ) : (
                'Type a test phrase...'
              )}
            </CommandEmpty>
            <CommandGroup heading="Suggested">
              {SUGGESTED_PHRASES.map((phrase) => (
                <CommandItem
                  key={phrase}
                  value={phrase}
                  onSelect={() => { onChange(phrase); setOpen(false); }}
                  className="text-xs"
                >
                  <IconCheck className={cn('mr-2 h-4 w-4', value === phrase ? 'opacity-100' : 'opacity-0')} />
                  {phrase}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};
```

---

### 3.3 `app/components/create-snippet-dialog.tsx`

**Based on**: `app/components/create-prompt-dialog.tsx`

#### Key differences from create-prompt-dialog
- Form action: `/api/snippets/create`
- Dialog title: "Create a new snippet"
- Dialog description: "Create a reusable system prompt snippet that can be composed into multiple prompts."
- **No subscription limit check** — no `useResourceLimits`, no `UpgradeGateModal`, no `canCreatePrompt` gate
- No `useOnboardingStore` integration

#### Types

```typescript
type ActionData = {
  errors?: { name?: string[]; description?: string[] };
};

interface CreateSnippetDialogProps {
  children: React.ReactNode;
}
```

#### Component

```typescript
export const CreateSnippetDialog = ({ children }: CreateSnippetDialogProps) => {
  const actionData = useActionData<ActionData>();
  const navigation = useNavigation();
  const location = useLocation();
  const [dialogOpen, setDialogOpen] = useState(false);
  const isSubmitting = navigation.state === 'submitting';

  return (
    <Dialog key={location.key} open={dialogOpen} onOpenChange={setDialogOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-106.25">
        <Form method="post" action="/api/snippets/create">
          <DialogHeader>
            <DialogTitle>Create a new snippet</DialogTitle>
            <DialogDescription>
              Create a reusable system prompt snippet that can be composed into multiple prompts.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" name="name" placeholder="e.g. Brand Voice Guidelines" autoFocus />
              {actionData?.errors?.name && (
                <p className="text-sm text-destructive">{actionData.errors.name[0]}</p>
              )}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="description">Description (optional)</Label>
              <Textarea id="description" name="description" rows={3}
                placeholder="What does this snippet do?" />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Creating...' : 'Create'}
            </Button>
          </DialogFooter>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
```

---

### 3.4 `app/components/edit-snippet-details-dialog.tsx`

**Based on**: `app/components/edit-prompt-details-dialog.tsx`

Same pattern with these changes:
- Form action: `/api/snippets/update`
- Hidden field: `snippetId` instead of `promptId`
- Dialog title: "Edit snippet details"
- Props: `snippet: { id: string; name: string; description: string }`

---

### 3.5 `app/components/publish-snippet-dialog.tsx`

**Based on**: `app/components/publish-prompt-dialog.tsx`

Same pattern with these changes:
- Form action: `/api/snippets/publish`
- Hidden field: `snippetId` instead of `promptId`
- Dialog title: "Publish version"
- **No `isSchemaChanged` prop** — snippets have no schema
- Version description: always "Minor version bump — content updated" or "Initial release"
- Props:
  ```typescript
  type PublishSnippetDialogProps = {
    children: React.ReactNode;
    snippetId: string;
    suggestedVersion: string;
    lastPublishedVersion: string | null;
    disabled?: boolean;
  };
  ```

---

### 3.6 `app/components/delete-snippet-dialog.tsx`

**Based on**: `app/components/delete-prompt-dialog.tsx`

Same pattern with these changes:
- Form action: `/api/snippets/delete`
- Hidden field: `snippetId` instead of `promptId`
- Dialog title: "Delete snippet"
- Success redirect: `navigate('/snippets')` instead of `/prompts`
- Props: `snippet: { id: string; name: string }`

---

### 3.7 `app/components/snippet-editor-menubar.tsx`

**Based on**: `app/components/prompt-editor-menubar.tsx`

#### Props

```typescript
type SnippetEditorMenubarProps = {
  snippet: { id: string; name: string; description: string };
  isOwner: boolean;
};
```

#### Changes from prompt menubar
- Uses `DeleteSnippetDialog` and `EditSnippetDetailsDialog`
- "Copy Snippet ID" instead of "Copy Prompt ID":
  ```typescript
  const handleCopySnippetId = async () => {
    await navigator.clipboard.writeText(snippet.id);
    toast.success('Snippet ID copied to clipboard', { position: 'bottom-center' });
  };
  ```
- `useUndoRedo` hook works the same (reads from the temporal store, which is `useSnippetEditorStore` when on a snippet page — need to verify the undo/redo hook is store-agnostic or create a snippet-specific version)

**Important**: Check if `useUndoRedo` is hardcoded to `usePromptEditorStore`. If so, either:
- Make it accept a store parameter
- Create `useSnippetUndoRedo` that reads from `useSnippetEditorStore`
- Best approach: check the `useUndoRedo` implementation

---

## 4. Sidebar Left Changes

### File: `app/components/sidebar-left.tsx`

#### Changes

1. **Add `IconPuzzle` import**:
   ```typescript
   import {
     IconCamera, IconChartBar, IconFileAi, IconFileDescription,
     IconFileText, IconNote, IconHelp, IconPuzzle, IconSearch,
     IconSettings, IconUsers,
   } from '@tabler/icons-react';
   ```

2. **Add Snippets to `navMain` array** (after Prompts, before Team):
   ```typescript
   const data = {
     navMain: [
       { title: 'Analytics', url: '/analytics', icon: IconChartBar },
       { title: 'Prompts', url: '/prompts', icon: IconNote },
       { title: 'Snippets', url: '/snippets', icon: IconPuzzle },  // <-- new
       { title: 'Team', url: '/team', icon: IconUsers },
     ],
     // ... rest unchanged
   };
   ```

3. **Update recents icon mapping** — recents need to show `IconPuzzle` for snippets and `IconFileText` for prompts:
   ```typescript
   const recentItems = recents.map((r) => ({
     promptId: r.promptId,              // keep as 'promptId' for backward compat
     name: r.promptName ?? r.snippetName,
     url: r.url,
     icon: r.type === 'snippet' ? IconPuzzle : IconFileText,  // <-- conditional icon
     folderName: r.folderName,
     version: r.version,
   }));
   ```

### Create Button — Split-Button Dropdown

The current codebase does NOT have a Create button in the sidebar itself (the Create button lives on the `/prompts` list page). Per the plan, we need to add a split-button Create dropdown to the sidebar.

**Location**: Add after the `NavMain` component in `SidebarContent`, before the recents section.

**Implementation option**: Add a new `CreateMenu` component inline in sidebar-left or as a separate file.

```tsx
import { IconChevronDown, IconNote, IconPuzzle } from '@tabler/icons-react';
import { PlusIcon } from 'lucide-react';
import { CreatePromptDialog } from '~/components/create-prompt-dialog';
import { CreateSnippetDialog } from '~/components/create-snippet-dialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuTrigger,
} from '~/components/ui/dropdown-menu';

// In SidebarContent, after NavMain:
<SidebarGroup>
  <div className="flex px-2">
    <CreatePromptDialog>
      <Button variant="outline" size="sm" className="flex-1 rounded-r-none border-r-0">
        <PlusIcon className="h-4 w-4 mr-1" /> Create
      </Button>
    </CreatePromptDialog>
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="rounded-l-none px-2">
          <IconChevronDown className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <CreatePromptDialog>
          <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
            <IconNote className="h-4 w-4 mr-2" /> Create Prompt
          </DropdownMenuItem>
        </CreatePromptDialog>
        <CreateSnippetDialog>
          <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
            <IconPuzzle className="h-4 w-4 mr-2" /> Create Snippet
          </DropdownMenuItem>
        </CreateSnippetDialog>
      </DropdownMenuContent>
    </DropdownMenu>
  </div>
</SidebarGroup>
```

**Note on dialog-in-dropdown pattern**: The `onSelect={(e) => e.preventDefault()}` on `DropdownMenuItem` prevents the dropdown from closing before the dialog opens. This is a standard Radix pattern for nesting dialogs in dropdown menus.

---

## 5. Recents System Extension

### File: `app/hooks/use-recents.ts`

#### Changes

1. **Extend `RecentPrompt` type** to include a `type` discriminator:
   ```typescript
   export interface RecentPrompt {
     promptId: string;            // Keep name for backward compat with localStorage
     promptName: string;          // Keep name for backward compat
     snippetName?: string;        // New (optional for backward compat)
     type?: 'prompt' | 'snippet'; // New (optional, defaults to 'prompt' for old data)
     folderId: string;
     folderName: string;
     version: string | null;
     url: string;
     lastSeenAt: number;
   }
   ```

   **Backward compatibility**: Existing localStorage entries won't have `type` or `snippetName`. The sidebar mapping defaults `type` to `'prompt'` when missing.

2. **Update `parsePromptUrl`** to also match `/snippets/:snippetId`:
   ```typescript
   const parseResourceUrl = (url: string): { id: string; type: 'prompt' | 'snippet' } | null => {
     try {
       const { pathname } = new URL(url);
       const promptMatch = pathname.match(/^\/prompts\/([^/]+)$/);
       if (promptMatch) return { id: promptMatch[1], type: 'prompt' };
       const snippetMatch = pathname.match(/^\/snippets\/([^/]+)$/);
       if (snippetMatch) return { id: snippetMatch[1], type: 'snippet' };
       return null;
     } catch {
       return null;
     }
   };
   ```

3. **Add `fetchSnippetInfo`**:
   ```typescript
   const fetchSnippetInfo = async (snippetId: string): Promise<PromptInfo | null> => {
     try {
       const response = await fetch(`/api/snippet-info?snippetId=${snippetId}`);
       if (!response.ok) return null;
       const info = await response.json();
       return {
         promptId: info.snippetId,
         promptName: info.snippetName,
         snippetName: info.snippetName,
         type: 'snippet' as const,
         folderId: info.folderId,
         folderName: info.folderName,
         version: info.version,
         url: info.url,
       };
     } catch {
       return null;
     }
   };
   ```

4. **Update navigation listener** to dispatch to the right fetch function:
   ```typescript
   nav.addEventListener('currententrychange', (event) => {
     const fromUrl = event.from?.url;
     if (!fromUrl) return;

     const parsed = parseResourceUrl(fromUrl);
     if (!parsed) return;

     const fetchFn = parsed.type === 'snippet' ? fetchSnippetInfo : fetchPromptInfo;
     fetchFn(parsed.id).then((info) => {
       if (info) addRecentToStorage(info);
     });
   });
   ```

5. **Update `addRecentToStorage`** — deduplicate by `url` instead of `promptId` to avoid collisions between prompts and snippets with the same ID:
   ```typescript
   const addRecentToStorage = (prompt: PromptInfo) => {
     const current = getRecentsFromStorage();
     const filtered = current.filter((r) => r.url !== prompt.url);
     // ... rest same
   };
   ```

6. **Update `removeRecentFromStorage`** — also accept `url` for deduplication:
   ```typescript
   const removeRecentFromStorage = (url: string) => {
     const current = getRecentsFromStorage();
     const updated = current.filter((r) => r.url !== url);
     // ... rest same
   };
   ```

   Update the public API:
   ```typescript
   const removeRecent = (url: string) => {
     removeRecentFromStorage(url);
   };
   ```

### File: `app/context/recents-context.tsx`

No changes needed — it just re-exports the hook's return type.

### File: `app/components/nav-documents.tsx`

Update the item type to accept the conditional icon:
```typescript
export interface NavDocumentItem {
  promptId: string;
  name: string;
  url: string;
  icon: React.ComponentType<{ className?: string }>;  // Already flexible
  folderName?: string;
  version?: string | null;
}
```

The existing implementation already renders `<item.icon />` dynamically, so no changes needed to the rendering logic.

---

## 6. useUndoRedo Hook Investigation

### File: `app/hooks/use-undo-redo.ts`

Need to check if this hook is hardcoded to `usePromptEditorStore`. If so, options:

**Option A (preferred)**: Make the hook accept a store parameter:
```typescript
export const useUndoRedo = (store = usePromptEditorStore) => {
  const canUndo = store.temporal.getState().pastStates.length > 0;
  // ...
};
```

**Option B**: Create `useSnippetUndoRedo` that mirrors `useUndoRedo` but reads from `useSnippetEditorStore`.

**Option C**: If the hook uses `usePromptEditorStore` indirectly through a generic Zundo API, it may already work. Check the implementation.

---

## 7. Cost Calculator (Simplified)

The snippet sidebar right should include a simplified cost display. When token counts are available after a test run, show:

```tsx
{lastSystemInputTokens && lastOutputTokens && (
  <div className="text-xs text-muted-foreground px-2 pt-2 space-y-1">
    <div className="flex justify-between">
      <span>System input</span>
      <span>{lastSystemInputTokens.toLocaleString()} tokens</span>
    </div>
    <div className="flex justify-between">
      <span>Output</span>
      <span>{lastOutputTokens.toLocaleString()} tokens</span>
    </div>
  </div>
)}
```

This goes below the `StreamingResponse` component in the test section. No full `CostCalculatorPopover` — just a simple token count display.

---

## 8. Collaboration (usePresence)

The snippet detail page should use the same `usePresence` hook for real-time collaboration:

```typescript
const { cursors, broadcastCursorPosition, broadcastTextEdit } = usePresence({
  resourceId: snippet.id,
  resourceType: 'snippet',  // Check if usePresence supports this
  userId: session.user.id,
  userName: session.user.name,
});
```

**Investigation needed**: Check if `usePresence` is hardcoded to `'prompt'` resource type or if it's generic. If hardcoded, extend to accept `'snippet'`.

---

## 9. Files Summary

### Files to create

| File | Based on |
|------|----------|
| `app/stores/snippet-editor-store.ts` | `prompt-editor-store.ts` |
| `app/routes/snippets.tsx` | `prompts.tsx` |
| `app/routes/snippets.snippetId.tsx` | `prompts.promptId.tsx` |
| `app/routes/layouts/snippet-detail.tsx` | `layouts/prompt-detail.tsx` |
| `app/components/snippet-sidebar-right.tsx` | `sidebar-right.tsx` |
| `app/components/create-snippet-dialog.tsx` | `create-prompt-dialog.tsx` |
| `app/components/edit-snippet-details-dialog.tsx` | `edit-prompt-details-dialog.tsx` |
| `app/components/publish-snippet-dialog.tsx` | `publish-prompt-dialog.tsx` |
| `app/components/delete-snippet-dialog.tsx` | `delete-prompt-dialog.tsx` |
| `app/components/snippet-editor-menubar.tsx` | `prompt-editor-menubar.tsx` |
| `app/components/snippet-test-combobox.tsx` | New |

### Files to modify

| File | Change |
|------|--------|
| `app/components/sidebar-left.tsx` | Add `IconPuzzle`, Snippets nav item, split-button Create dropdown, conditional recents icons |
| `app/hooks/use-recents.ts` | Extend types, parse snippet URLs, fetch snippet info, deduplicate by URL |
| `app/routes.ts` | Register all new routes (see Plan 1) |

### Files to investigate

| File | Question |
|------|----------|
| `app/hooks/use-undo-redo.ts` | Is it hardcoded to `usePromptEditorStore`? |
| `app/hooks/use-presence.ts` | Does it support a generic `resourceType`? |
| `app/components/nav-documents.tsx` | Does removing by `promptId` need to change to by `url`? |

---

## 10. Verification Checklist

### Automated checks
1. `bun run lint:fix`
2. `bun run typecheck`
3. `bun run test:e2e`

### Manual browser testing (Chrome DevTools MCP)

1. **Sidebar**: Navigate to `http://localhost:5173`, log in. Verify:
   - Snippets nav item appears after Prompts with puzzle icon
   - Split-button Create dropdown works (both options)

2. **List page**: Click Snippets. Verify:
   - Empty state shows with "No Snippets Yet" and Create button
   - Create a snippet via the button
   - Verify redirect to `/snippets/{id}`
   - Navigate back — verify snippet card appears

3. **Detail page**: On the snippet detail page, verify:
   - Title shows snippet name
   - Single "System Prompt Snippet" editor (no user prompt)
   - Menubar shows File > Share > Copy Snippet ID
   - Type content, verify auto-save (check save indicator)
   - Undo/Redo works (Cmd+Z / Shift+Cmd+Z)

4. **Publishing**: Verify:
   - Publish button appears when content changes
   - Publish dialog suggests version (1.0.0 for first, minor bump after)
   - Published version appears in Versions table
   - After publish, editing creates new draft

5. **Version viewing**: Navigate to `?version=1.0.0`. Verify:
   - Read-only banner shows
   - Editor is disabled
   - "Back to latest" button works

6. **Testing**: In the sidebar right:
   - Select a suggested phrase from combobox
   - Select a model
   - Click Test, verify streaming response
   - Verify token counts display after stream completes

7. **Used by**: Verify empty state message in "Used by" section

8. **Recents**: Navigate away from snippet, then check sidebar:
   - Snippet appears in Recents with puzzle icon
   - Clicking it navigates back to the snippet

9. **Delete**: Via menubar, delete the snippet (owner only). Verify:
   - Confirmation dialog shows
   - Redirects to `/snippets`
   - Snippet no longer appears in list

10. **Dark mode**: Toggle dark mode via user dropdown:
    - Verify all snippet UI components render correctly
    - Check contrast on snippet cards, editors, sidebar sections

11. **Mobile viewport**: Resize to 375px:
    - Verify sidebar right stacks below content
    - No horizontal overflow
    - Test combobox works on mobile
