# Plan 1: Snippets — Database & API Integration

## Overview

This plan covers the database migration, API routes, validation schemas, and route registration for the Snippets feature. All patterns mirror the existing Prompts implementation exactly, with adjustments for the simpler snippet data model (single `content` field instead of `system_message` + `user_message`).

---

## 1. Database Migration

### File: `migrations/drizzle/0018_add_snippet_tables.sql`

Creates four tables: `snippet_folder`, `snippet`, `snippet_version`, and `prompt_version_snippet`.

```sql
-- Snippet folders (mirrors prompt_folder exactly)
CREATE TABLE snippet_folder (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  organization_id TEXT NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
  created_by TEXT NOT NULL REFERENCES user(id) ON DELETE SET NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);

CREATE INDEX snippet_folder_organizationId_idx ON snippet_folder(organization_id);
CREATE UNIQUE INDEX snippet_folder_org_name_uidx ON snippet_folder(organization_id, name);

-- Snippets (mirrors prompt, adds description field)
CREATE TABLE snippet (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  folder_id TEXT REFERENCES snippet_folder(id) ON DELETE SET NULL,
  organization_id TEXT NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
  created_by TEXT NOT NULL REFERENCES user(id) ON DELETE SET NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  deleted_at INTEGER
);

CREATE INDEX snippet_organizationId_idx ON snippet(organization_id);
CREATE INDEX snippet_folderId_idx ON snippet(folder_id);
CREATE UNIQUE INDEX snippet_org_name_uidx ON snippet(organization_id, name) WHERE deleted_at IS NULL;

-- Snippet versions (mirrors prompt_version, single 'content' field instead of system_message + user_message)
CREATE TABLE snippet_version (
  id TEXT PRIMARY KEY NOT NULL,
  snippet_id TEXT NOT NULL REFERENCES snippet(id) ON DELETE CASCADE,
  major INTEGER,
  minor INTEGER,
  patch INTEGER,
  content TEXT,
  config TEXT NOT NULL DEFAULT '{}',
  labels TEXT,
  created_by TEXT NOT NULL REFERENCES user(id) ON DELETE SET NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  updated_at INTEGER,
  updated_by TEXT REFERENCES user(id) ON DELETE SET NULL,
  published_at INTEGER,
  published_by TEXT REFERENCES user(id) ON DELETE SET NULL,
  last_output_tokens INTEGER,
  last_system_input_tokens INTEGER
);

CREATE INDEX snippet_version_snippetId_idx ON snippet_version(snippet_id);
CREATE UNIQUE INDEX snippet_version_snippet_semver_uidx
  ON snippet_version(snippet_id, major, minor, patch)
  WHERE major IS NOT NULL;

-- Junction table: which snippets are attached to which prompt versions
CREATE TABLE prompt_version_snippet (
  id TEXT PRIMARY KEY NOT NULL,
  prompt_version_id TEXT NOT NULL REFERENCES prompt_version(id) ON DELETE CASCADE,
  snippet_id TEXT NOT NULL REFERENCES snippet(id) ON DELETE RESTRICT,
  snippet_version_id TEXT REFERENCES snippet_version(id) ON DELETE SET NULL,
  auto_update INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);

CREATE INDEX pvs_prompt_version_idx ON prompt_version_snippet(prompt_version_id);
CREATE INDEX pvs_snippet_idx ON prompt_version_snippet(snippet_id);
CREATE UNIQUE INDEX pvs_unique_ref ON prompt_version_snippet(prompt_version_id, snippet_id);
```

### Key differences from `prompt_version`
- `content` replaces `system_message` + `user_message` (single field)
- No `last_user_input_tokens` column (snippets only have system content)
- References `snippet(id)` not `prompt(id)`

### Junction table design notes
- `snippet_version_id` is nullable — when `auto_update = 1`, resolves to latest published at runtime
- `ON DELETE RESTRICT` on `snippet_id` prevents hard-deleting a snippet while references exist (we use soft delete, so this is a safety net)
- `ON DELETE SET NULL` on `snippet_version_id` handles edge case of a snippet version being removed
- Unique constraint on `(prompt_version_id, snippet_id)` — a prompt version references a snippet at most once

### Application step
```bash
bunx wrangler d1 migrations apply promptly --local
```

---

## 2. Validation Schemas

### File: `app/lib/validations/snippet.ts`

Mirrors `app/lib/validations/prompt.ts` exactly in structure.

```typescript
import { z } from 'zod';

export const updateSnippetSchema = z.object({
  snippetId: z.string().min(1, 'Snippet ID is required'),
  name: z.string().min(2, 'Name must be at least 2 characters'),
  description: z.string().optional(),
});
export type UpdateSnippetInput = z.infer<typeof updateSnippetSchema>;

export const deleteSnippetSchema = z.object({
  snippetId: z.string().min(1, 'Snippet ID is required'),
});
export type DeleteSnippetInput = z.infer<typeof deleteSnippetSchema>;
```

Note: The create schema is defined inline in `snippets.create.ts` (same pattern as `prompts.create.ts`).

---

## 3. API Routes

### 3.1 `app/routes/api/snippets.create.ts`

**Based on**: `app/routes/api/prompts.create.ts`
**Method**: POST
**Endpoint**: `/api/snippets/create`

```typescript
import { nanoid } from 'nanoid';
import { data, redirect } from 'react-router';
import { z } from 'zod';
import { orgContext } from '~/context';
import { getAuth } from '~/lib/auth.server';
import type { Route } from './+types/snippets.create';
```

**Flow (mirrors prompts.create.ts):**
1. Parse FormData, validate with inline Zod schema:
   ```typescript
   const createSnippetSchema = z.object({
     name: z.string().min(2, 'Name must be at least 2 characters'),
     description: z.string().optional(),
   });
   ```
2. On validation failure: return `data({ errors: z.flattenError(result.error).fieldErrors }, { status: 400 })`
3. Auth check: `getAuth(context)` + `auth.api.getSession({ headers: request.headers })`
4. Org resolution: `context.get(orgContext)` — if missing, call `auth.api.createOrganization(...)` (same fallback pattern)
5. **No subscription limit check** — snippets are unlimited for Pro/Enterprise. Skip the `getSubscriptionStatus` + count check entirely.
6. Folder upsert (uses `snippet_folder` table):
   ```sql
   SELECT id FROM snippet_folder WHERE organization_id = ? AND name = ?
   -- If not found:
   INSERT INTO snippet_folder (id, name, organization_id, created_by) VALUES (?, ?, ?, ?)
   ```
   Default folder name: `'Untitled'`
7. INSERT snippet:
   ```sql
   INSERT INTO snippet (id, name, description, folder_id, organization_id, created_by)
   VALUES (?, ?, ?, ?, ?, ?)
   ```
8. INSERT initial draft snippet_version (empty content):
   ```sql
   INSERT INTO snippet_version (id, snippet_id, content, config, created_by, updated_at, updated_by)
   VALUES (?, ?, '', '{}', ?, ?, ?)
   ```
9. `return redirect(`/snippets/${snippetId}`)`

**Key difference from prompts.create.ts**: No `getSubscriptionStatus` import, no limit count query, no `limitExceeded` return path.

---

### 3.2 `app/routes/api/snippets.publish.ts`

**Based on**: `app/routes/api/prompts.publish.ts`
**Method**: POST
**Endpoint**: `/api/snippets/publish`

```typescript
import { data } from 'react-router';
import { orgContext } from '~/context';
import { getAuth } from '~/lib/auth.server';
import type { Route } from './+types/snippets.publish';
```

**Flow (mirrors prompts.publish.ts):**
1. `context.get(orgContext)` — if missing, 403
2. Session auth — if missing, 401
3. Parse `snippetId` and `version` from FormData
4. Validate version regex: `/^(\d+)\.(\d+)\.(\d+)$/`
5. Verify snippet ownership:
   ```sql
   SELECT id FROM snippet WHERE id = ? AND organization_id = ?
   ```
6. Find current draft:
   ```sql
   SELECT id FROM snippet_version WHERE snippet_id = ? AND published_at IS NULL ORDER BY created_at DESC LIMIT 1
   ```
7. Find last published for semver comparison:
   ```sql
   SELECT major, minor, patch FROM snippet_version WHERE snippet_id = ? AND published_at IS NOT NULL ORDER BY major DESC, minor DESC, patch DESC LIMIT 1
   ```
8. Semver comparison guard (new version must be strictly greater)
9. UPDATE draft row:
   ```sql
   UPDATE snippet_version
     SET major = ?, minor = ?, patch = ?, published_at = ?, published_by = ?, updated_at = ?, updated_by = ?
     WHERE id = ?
   ```
10. UPDATE snippet.updated_at:
    ```sql
    UPDATE snippet SET updated_at = ? WHERE id = ?
    ```
11. Return `{ success: true, version: 'X.Y.Z' }`

**Key difference from prompts.publish.ts**: No KV cache invalidation (`cachePublishedVersion`) — external API support for snippets is deferred.

---

### 3.3 `app/routes/api/snippets.update.ts`

**Based on**: `app/routes/api/prompts.update.ts`
**Method**: POST
**Endpoint**: `/api/snippets/update`

```typescript
import { data } from 'react-router';
import { orgContext } from '~/context';
import { getAuth } from '~/lib/auth.server';
import { updateSnippetSchema } from '~/lib/validations/snippet';
import type { Route } from './+types/snippets.update';
```

**Flow (mirrors prompts.update.ts):**
1. Org context check -> 403
2. Session check -> 401
3. Parse FormData; validate with imported `updateSnippetSchema`
4. On validation failure: return first error string (same pattern as prompts)
   ```typescript
   const firstError = fieldErrors.name?.[0] || fieldErrors.snippetId?.[0] || 'Invalid input';
   return data({ error: firstError }, { status: 400 });
   ```
5. Verify ownership:
   ```sql
   SELECT id FROM snippet WHERE id = ? AND organization_id = ?
   ```
6. UPDATE:
   ```sql
   UPDATE snippet SET name = ?, description = ?, updated_at = ? WHERE id = ?
   ```
7. Return `{ success: true }`

**Key difference from prompts.update.ts**: No KV cache invalidation.

---

### 3.4 `app/routes/api/snippets.delete.ts`

**Based on**: `app/routes/api/prompts.delete.ts`
**Method**: POST
**Endpoint**: `/api/snippets/delete`

```typescript
import { data } from 'react-router';
import { orgContext } from '~/context';
import { getAuth } from '~/lib/auth.server';
import { deleteSnippetSchema } from '~/lib/validations/snippet';
import type { Route } from './+types/snippets.delete';
```

**Flow (mirrors prompts.delete.ts):**
1. Org context check -> 403
2. Session check -> 401
3. **Owner-only role gate** (same pattern): call `auth.api.getFullOrganization(...)`, check current user is `'owner'`
4. Parse FormData; validate with `deleteSnippetSchema`
5. Verify ownership:
   ```sql
   SELECT id FROM snippet WHERE id = ? AND organization_id = ?
   ```
6. Soft delete:
   ```sql
   UPDATE snippet SET deleted_at = ? WHERE id = ?
   ```
7. Return `{ success: true }`

**Local types needed (same as prompts.delete.ts):**
```typescript
type Member = { userId: string; role: 'member' | 'admin' | 'owner' };
type FullOrganization = { members?: Member[] };
```

**Key difference from prompts.delete.ts**: No KV cache invalidation (`invalidatePromptAndVersions`).

---

### 3.5 `app/routes/api/snippets.run.ts`

**Based on**: `app/routes/api/prompts.run.ts` (simplified)
**Method**: POST
**Endpoint**: `/api/snippets/run`

```typescript
import { streamText } from 'ai';
import { data } from 'react-router';
import { orgContext } from '~/context';
import { getAuth } from '~/lib/auth.server';
import { resolveModelForOrg } from '~/lib/resolve-model.server';
import type { Route } from './+types/snippets.run';
```

**FormData params:**
- `snippetId` (string, required)
- `version` (string | null) — `'draft'`, a semver string, or omitted
- `model` (string | null) — last-used test model
- `userMessage` (string | null) — the test phrase

**No `temperature`, `inputData`, or `inputDataRootName` params** — temperature is hardcoded to 0, no variable interpolation.

**Flow:**
1. Auth + org check (same pattern)
2. Validate `snippetId` present
3. Verify snippet ownership:
   ```sql
   SELECT id FROM snippet WHERE id = ? AND organization_id = ?
   ```
4. Resolve snippet version (three branches, mirrors prompts.run.ts):
   ```sql
   -- draft
   SELECT id, content FROM snippet_version WHERE snippet_id = ? AND published_at IS NULL ORDER BY created_at DESC LIMIT 1

   -- specific semver
   SELECT id, content FROM snippet_version WHERE snippet_id = ? AND major = ? AND minor = ? AND patch = ?

   -- latest published
   SELECT id, content FROM snippet_version WHERE snippet_id = ? AND published_at IS NOT NULL ORDER BY major DESC, minor DESC, patch DESC LIMIT 1
   ```
   Type: `{ id: string; content: string | null }`
5. Resolve model: `resolveModelForOrg(...)` (same pattern, default `'claude-haiku-4.5'`)
6. Call `streamText()`:
   ```typescript
   const result = streamText({
     model: modelInstance,
     system: snippetContent,       // snippet content as system message
     prompt: userMessage || '',     // test phrase as user message
     temperature: 0,               // hardcoded
     onError: ({ error }) => { ... }, // same error extraction pattern
   });
   ```
7. Token tracking via `waitUntil()`:
   ```sql
   UPDATE snippet_version
     SET last_output_tokens = ?, last_system_input_tokens = ?
     WHERE id = ?
   ```
   **Simplified**: `last_system_input_tokens = inputTokens` (no proportional split needed — all input tokens are system tokens since the user message is just a test phrase, not tracked)
8. Stream response with error wrapping (same `TransformStream` + `pumpStream` pattern)
9. **No `X-Unused-Fields` header** (no variable interpolation)
10. **No `preparePrompts` import** (no interpolation needed)

**Key differences from prompts.run.ts:**
- No `preparePrompts` / `prompt-interpolation` import
- No `inputData` / `inputDataRootName` handling
- Temperature hardcoded to `0`
- Token update only sets `last_output_tokens` and `last_system_input_tokens` (no `last_user_input_tokens`)
- No `X-Unused-Fields` response header
- Fetches `content` instead of `system_message` + `user_message`

---

### 3.6 `app/routes/api/snippets.usage.ts`

**Based on**: `app/routes/api/prompts.usage.ts`
**Method**: GET (loader, not action)
**Endpoint**: `/api/snippets/usage`

```typescript
import { data } from 'react-router';
import { orgContext } from '~/context';
import { getAuth } from '~/lib/auth.server';
import type { Route } from './+types/snippets.usage';
```

**Query params (from URL searchParams):**
- `snippetId`
- `version` — `'draft'`, semver, or omitted

**Flow (mirrors prompts.usage.ts):**
1. Auth + org check
2. Validate `snippetId` present
3. Verify snippet ownership:
   ```sql
   SELECT id FROM snippet WHERE id = ? AND organization_id = ?
   ```
4. Resolve token counts (three branches):
   ```sql
   -- draft
   SELECT last_output_tokens, last_system_input_tokens
     FROM snippet_version WHERE snippet_id = ? AND published_at IS NULL
     ORDER BY created_at DESC LIMIT 1

   -- specific semver
   SELECT last_output_tokens, last_system_input_tokens
     FROM snippet_version WHERE snippet_id = ? AND major = ? AND minor = ? AND patch = ?

   -- latest
   SELECT last_output_tokens, last_system_input_tokens
     FROM snippet_version WHERE snippet_id = ?
     ORDER BY (published_at IS NULL) DESC, created_at DESC LIMIT 1
   ```
   Type: `{ last_output_tokens: number | null; last_system_input_tokens: number | null }`
5. Return:
   ```typescript
   return data({
     outputTokens: result?.last_output_tokens ?? null,
     systemInputTokens: result?.last_system_input_tokens ?? null,
   });
   ```

**Key difference from prompts.usage.ts**: No `last_user_input_tokens` / `userInputTokens` in query or response.

---

### 3.7 `app/routes/api/snippet-info.ts`

**Based on**: `app/routes/api/prompt-info.ts`
**Method**: GET (loader)
**Endpoint**: `/api/snippet-info`

```typescript
import { orgContext } from '~/context';
import { getAuth } from '~/lib/auth.server';
import type { Route } from './+types/snippet-info';
```

**Query params**: `snippetId` (URL searchParam)

**Flow (mirrors prompt-info.ts):**
1. Auth + org check
2. Validate `snippetId` present
3. Fetch snippet:
   ```sql
   SELECT id, name, folder_id FROM snippet WHERE id = ? AND organization_id = ?
   ```
4. Parallel queries:
   ```sql
   -- Folder lookup
   SELECT id, name FROM snippet_folder WHERE id = ? AND organization_id = ?

   -- Latest published version
   SELECT major, minor, patch FROM snippet_version
     WHERE snippet_id = ? AND published_at IS NOT NULL
     ORDER BY major DESC, minor DESC, patch DESC LIMIT 1
   ```
5. Return (uses `Response.json()`, same pattern as `prompt-info.ts`):
   ```typescript
   return Response.json({
     snippetId: snippet.id,
     snippetName: snippet.name,
     folderId: folder.id,
     folderName: folder.name,
     version: versionResult
       ? `${versionResult.major}.${versionResult.minor}.${versionResult.patch}`
       : null,
     url: `/snippets/${snippetId}`,
   });
   ```

---

## 4. Route Registration

### File: `app/routes.ts`

Add snippet API routes after the existing prompt API routes (line 22, after `route('api/prompt-info', ...)`):

```typescript
// Snippet API routes
route('api/snippets/create', './routes/api/snippets.create.ts'),
route('api/snippets/run', './routes/api/snippets.run.ts'),
route('api/snippets/usage', './routes/api/snippets.usage.ts'),
route('api/snippets/publish', './routes/api/snippets.publish.ts'),
route('api/snippets/update', './routes/api/snippets.update.ts'),
route('api/snippets/delete', './routes/api/snippets.delete.ts'),
route('api/snippet-info', './routes/api/snippet-info.ts'),
```

Add `snippets` page route inside the `layout('./routes/layouts/app.tsx', [...])` block (after `route('prompts', ...)`):

```typescript
route('snippets', './routes/snippets.tsx'),
```

Add snippet detail layout block after the prompt detail layout block (after line 74):

```typescript
layout('./routes/layouts/snippet-detail.tsx', [
  route('snippets/:snippetId', './routes/snippets.snippetId.tsx', {
    id: 'snippet-detail',
  }),
]),
```

### Final routes.ts structure (relevant section):

```typescript
// ... existing API routes ...
route('api/prompt-info', './routes/api/prompt-info.ts'),
// Snippet API routes
route('api/snippets/create', './routes/api/snippets.create.ts'),
route('api/snippets/run', './routes/api/snippets.run.ts'),
route('api/snippets/usage', './routes/api/snippets.usage.ts'),
route('api/snippets/publish', './routes/api/snippets.publish.ts'),
route('api/snippets/update', './routes/api/snippets.update.ts'),
route('api/snippets/delete', './routes/api/snippets.delete.ts'),
route('api/snippet-info', './routes/api/snippet-info.ts'),
// ... existing routes ...
layout('./routes/layouts/app.tsx', [
  route('dashboard', './routes/dashboard.tsx'),
  route('home', './routes/home.tsx'),
  route('logout', './routes/logout.tsx'),
  route('prompts', './routes/prompts.tsx'),
  route('snippets', './routes/snippets.tsx'),  // <-- new
  route('analytics', './routes/analytics.tsx'),
  route('team', './routes/team.tsx'),
  route('settings', './routes/settings.tsx'),
]),
layout('./routes/layouts/prompt-detail.tsx', [
  route('prompts/:promptId', './routes/prompts.promptId.tsx', {
    id: 'prompt-detail',
  }),
]),
layout('./routes/layouts/snippet-detail.tsx', [   // <-- new
  route('snippets/:snippetId', './routes/snippets.snippetId.tsx', {
    id: 'snippet-detail',
  }),
]),
```

---

## 5. Files Summary

### Files to create

| File | Based on | Key difference |
|------|----------|---------------|
| `migrations/drizzle/0018_add_snippet_tables.sql` | New | 4 tables |
| `app/lib/validations/snippet.ts` | `app/lib/validations/prompt.ts` | `snippetId` instead of `promptId` |
| `app/routes/api/snippets.create.ts` | `prompts.create.ts` | No subscription limit check |
| `app/routes/api/snippets.publish.ts` | `prompts.publish.ts` | No KV cache invalidation |
| `app/routes/api/snippets.update.ts` | `prompts.update.ts` | No KV cache invalidation |
| `app/routes/api/snippets.delete.ts` | `prompts.delete.ts` | No KV cache invalidation |
| `app/routes/api/snippets.run.ts` | `prompts.run.ts` | No interpolation, temp=0, single content field |
| `app/routes/api/snippets.usage.ts` | `prompts.usage.ts` | No `last_user_input_tokens` |
| `app/routes/api/snippet-info.ts` | `prompt-info.ts` | Snippet tables instead of prompt tables |

### Files to modify

| File | Change |
|------|--------|
| `app/routes.ts` | Add 7 API routes + 1 page route + 1 layout block |

---

## 6. Verification Checklist

1. Apply migration locally: `bunx wrangler d1 migrations apply promptly --local`
2. Verify all 4 tables created with correct columns and indexes
3. Verify unique constraints work (try inserting duplicate snippet name in same org)
4. `bun run lint:fix` — all new files pass
5. `bun run typecheck` — all route types generate correctly (check `./+types/` auto-generation)
6. Create a snippet via the API manually (curl or browser) and verify redirect
7. Publish a version and verify semver validation
8. Run the snippet test endpoint and verify streaming response
9. Verify soft delete works and doesn't break junction table references
