import { ArrowLeft, GitBranch, RssIcon } from 'lucide-react';
import { nanoid } from 'nanoid';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  data,
  useFetcher,
  useLocation,
  useNavigate,
  useOutletContext,
  useSearchParams,
} from 'react-router';
import { useDebouncedCallback } from 'use-debounce';
import { PromptEditor } from '~/components/prompt-editor';
import { PublishSnippetDialog } from '~/components/publish-snippet-dialog';
import { RemoteCursorsOverlay } from '~/components/remote-cursors-overlay';
import { SnippetCostCalculatorPopover } from '~/components/snippet-cost-calculator-popover';
import { SnippetEditorMenubar } from '~/components/snippet-editor-menubar';
import { Badge } from '~/components/ui/badge';
import { Button } from '~/components/ui/button';
import { Separator } from '~/components/ui/separator';
import type { Version } from '~/components/versions-table';
import { authContext, orgContext, sessionContext } from '~/context';
import {
  type CursorPosition,
  type PresenceEventCallbacks,
  usePresence,
} from '~/hooks/use-presence';
import { useSnippetUndoRedo } from '~/hooks/use-snippet-undo-redo';
import { useSnippetEditorStore } from '~/stores/snippet-editor-store';
import type { Route } from './+types/snippets.snippetId';

type SnippetDetailContext = {
  triggerTest: () => void;
};

type OrgMember = {
  userId: string;
  role: 'member' | 'admin' | 'owner';
};

type FullOrganization = {
  members?: OrgMember[];
};

// biome-ignore lint/correctness/noEmptyPattern: react router default
export const meta = ({}: Route.MetaArgs) => [
  { title: 'Snippet | Promptly' },
  {
    name: 'description',
    content: 'The CMS for building AI at scale',
  },
];

export const loader = async ({
  params,
  request,
  context,
}: Route.LoaderArgs) => {
  const org = context.get(orgContext);
  if (!org) {
    throw new Response('Unauthorized', { status: 403 });
  }

  const auth = context.get(authContext);
  const session = context.get(sessionContext);
  let isOwner = false;
  if (session?.user) {
    const orgResponse = await auth.api.getFullOrganization({
      query: { organizationId: org.organizationId },
      headers: request.headers,
      asResponse: true,
    });
    const fullOrg = (await orgResponse.json()) as FullOrganization | null;
    const currentUserMember = fullOrg?.members?.find(
      (m) => m.userId === session.user.id,
    );
    isOwner = currentUserMember?.role === 'owner';
  }

  const { snippetId } = params;
  const db = context.cloudflare.env.promptly;

  const url = new URL(request.url);
  const versionParam = url.searchParams.get('version');
  let requestedMajor: number | null = null;
  let requestedMinor: number | null = null;
  let requestedPatch: number | null = null;

  if (versionParam) {
    const match = versionParam.match(/^(\d+)\.(\d+)\.(\d+)$/);
    if (match) {
      requestedMajor = Number.parseInt(match[1], 10);
      requestedMinor = Number.parseInt(match[2], 10);
      requestedPatch = Number.parseInt(match[3], 10);
    }
  }

  const snippet = await db
    .prepare(
      'SELECT id, name, description, folder_id FROM snippet WHERE id = ? AND organization_id = ? AND deleted_at IS NULL',
    )
    .bind(snippetId, org.organizationId)
    .first<{
      id: string;
      name: string;
      description: string;
      folder_id: string;
    }>();

  if (!snippet) {
    throw new Response('Snippet not found', { status: 404 });
  }

  const folder = await db
    .prepare(
      'SELECT id, name FROM snippet_folder WHERE id = ? AND organization_id = ?',
    )
    .bind(snippet.folder_id, org.organizationId)
    .first<{ id: string; name: string }>();

  if (!folder) {
    throw new Response('Folder not found', { status: 404 });
  }

  const versionsResult = await db
    .prepare(
      `SELECT sv.major, sv.minor, sv.patch, sv.updated_at, u_updated.name as updated_by, sv.published_at, u_published.name as published_by, u_created.name as created_by
       FROM snippet_version sv
       LEFT JOIN user u_created ON sv.created_by = u_created.id
       LEFT JOIN user u_updated ON sv.updated_by = u_updated.id
       LEFT JOIN user u_published ON sv.published_by = u_published.id
       WHERE sv.snippet_id = ?
       ORDER BY (sv.published_at IS NULL) DESC, sv.major DESC, sv.minor DESC, sv.patch DESC`,
    )
    .bind(snippetId)
    .all<{
      major: number | null;
      minor: number | null;
      patch: number | null;
      updated_at: number | null;
      updated_by: string | null;
      published_at: number | null;
      published_by: string | null;
      created_by: string | null;
    }>();

  let versionNotFound = false;
  let isViewingOldVersion = false;
  let requestedVersion: string | null = null;

  let targetVersion: {
    id: string;
    content: string | null;
    config: string;
    major: number | null;
    minor: number | null;
    patch: number | null;
    last_output_tokens: number | null;
    last_system_input_tokens: number | null;
    published_at: number | null;
    published_by: string | null;
    created_by: string | null;
    updated_at: number | null;
    updated_by: string | null;
  } | null = null;

  if (
    versionParam &&
    requestedMajor !== null &&
    requestedMinor !== null &&
    requestedPatch !== null
  ) {
    requestedVersion = versionParam;
    targetVersion = await db
      .prepare(
        'SELECT id, content, config, major, minor, patch, last_output_tokens, last_system_input_tokens, published_at, published_by, created_by, updated_at, updated_by FROM snippet_version WHERE snippet_id = ? AND major = ? AND minor = ? AND patch = ?',
      )
      .bind(snippetId, requestedMajor, requestedMinor, requestedPatch)
      .first();

    if (!targetVersion) {
      versionNotFound = true;
    } else {
      isViewingOldVersion = true;
    }
  } else if (versionParam) {
    requestedVersion = versionParam;
    versionNotFound = true;
  }

  if (!targetVersion) {
    targetVersion = await db
      .prepare(
        'SELECT id, content, config, major, minor, patch, last_output_tokens, last_system_input_tokens, published_at, published_by, created_by, updated_at, updated_by FROM snippet_version WHERE snippet_id = ? ORDER BY (published_at IS NULL) DESC, created_at DESC LIMIT 1',
      )
      .bind(snippetId)
      .first();
  }

  const lastPublishedResult = await db
    .prepare(
      'SELECT major, minor, patch, content FROM snippet_version WHERE snippet_id = ? AND published_at IS NOT NULL ORDER BY major DESC, minor DESC, patch DESC LIMIT 1',
    )
    .bind(snippetId)
    .first<{
      major: number;
      minor: number;
      patch: number;
      content: string | null;
    }>();

  let model: string | null = null;
  let testUserMessage = '';

  try {
    if (targetVersion?.config) {
      const parsed = JSON.parse(targetVersion.config);
      model = parsed.model ?? null;
      testUserMessage = parsed.testUserMessage ?? '';
    }
  } catch {
    // Keep defaults
  }

  const hasDraft =
    versionsResult.results?.some((v) => v.published_at === null) ?? false;

  const currentVersionString =
    targetVersion &&
    targetVersion.major !== null &&
    targetVersion.minor !== null &&
    targetVersion.patch !== null
      ? `${targetVersion.major}.${targetVersion.minor}.${targetVersion.patch}`
      : null;

  const lastPublishedVersionString = lastPublishedResult
    ? `${lastPublishedResult.major}.${lastPublishedResult.minor}.${lastPublishedResult.patch}`
    : null;

  return {
    folder,
    snippet,
    currentVersion: currentVersionString,
    versions: versionsResult.results,
    content: targetVersion?.content ?? '',
    model,
    testUserMessage,
    lastOutputTokens: targetVersion?.last_output_tokens ?? null,
    lastSystemInputTokens: targetVersion?.last_system_input_tokens ?? null,
    lastPublishedVersion: lastPublishedVersionString,
    lastPublishedContent: lastPublishedResult?.content ?? null,
    hasDraft,
    isViewingOldVersion,
    versionNotFound,
    requestedVersion,
    isOwner,
  };
};

export const action = async ({
  request,
  params,
  context,
}: Route.ActionArgs) => {
  const org = context.get(orgContext);
  if (!org) {
    return data({ error: 'Unauthorized' }, { status: 403 });
  }

  const { snippetId } = params;
  const db = context.cloudflare.env.promptly;

  const session = context.get(sessionContext);

  if (!session?.user) {
    return data({ error: 'Not authenticated' }, { status: 401 });
  }

  const snippetOwnership = await db
    .prepare(
      'SELECT id FROM snippet WHERE id = ? AND organization_id = ? AND deleted_at IS NULL',
    )
    .bind(snippetId, org.organizationId)
    .first();

  if (!snippetOwnership) {
    return data({ error: 'Snippet not found' }, { status: 404 });
  }

  const formData = await request.formData();
  const intent = formData.get('intent') as string | null;

  if (intent === 'saveConfig') {
    const configJson = (formData.get('config') as string) ?? '{}';

    const currentVersion = await db
      .prepare(
        'SELECT id, published_at, content FROM snippet_version WHERE snippet_id = ? ORDER BY (published_at IS NULL) DESC, created_at DESC LIMIT 1',
      )
      .bind(snippetId)
      .first<{
        id: string;
        published_at: number | null;
        content: string | null;
      }>();

    const now = Date.now();
    if (!currentVersion) {
      await db
        .prepare(
          'INSERT INTO snippet_version (id, snippet_id, config, created_by, updated_at, updated_by) VALUES (?, ?, ?, ?, ?, ?)',
        )
        .bind(
          nanoid(),
          snippetId,
          configJson,
          session.user.id,
          now,
          session.user.id,
        )
        .run();
    } else if (currentVersion.published_at === null) {
      await db
        .prepare(
          'UPDATE snippet_version SET config = ?, updated_at = ?, updated_by = ? WHERE id = ?',
        )
        .bind(configJson, now, session.user.id, currentVersion.id)
        .run();
    } else {
      await db
        .prepare(
          'INSERT INTO snippet_version (id, snippet_id, config, content, created_by, updated_at, updated_by) VALUES (?, ?, ?, ?, ?, ?, ?)',
        )
        .bind(
          nanoid(),
          snippetId,
          configJson,
          currentVersion.content,
          session.user.id,
          now,
          session.user.id,
        )
        .run();
    }

    return { success: true, savedAt: Date.now(), intent: 'saveConfig' };
  }

  const content = (formData.get('content') as string)?.trim() ?? '';

  const currentVersion = await db
    .prepare(
      'SELECT id, published_at, config FROM snippet_version WHERE snippet_id = ? ORDER BY (published_at IS NULL) DESC, created_at DESC LIMIT 1',
    )
    .bind(snippetId)
    .first<{
      id: string;
      published_at: number | null;
      config: string | null;
    }>();

  const now = Date.now();
  if (!currentVersion) {
    await db
      .prepare(
        'INSERT INTO snippet_version (id, snippet_id, content, created_by, updated_at, updated_by) VALUES (?, ?, ?, ?, ?, ?)',
      )
      .bind(nanoid(), snippetId, content, session.user.id, now, session.user.id)
      .run();
  } else if (currentVersion.published_at === null) {
    await db
      .prepare(
        'UPDATE snippet_version SET content = ?, updated_at = ?, updated_by = ? WHERE id = ?',
      )
      .bind(content, now, session.user.id, currentVersion.id)
      .run();
  } else {
    await db
      .prepare(
        'INSERT INTO snippet_version (id, snippet_id, content, config, created_by, updated_at, updated_by) VALUES (?, ?, ?, ?, ?, ?, ?)',
      )
      .bind(
        nanoid(),
        snippetId,
        content,
        currentVersion.config,
        session.user.id,
        now,
        session.user.id,
      )
      .run();
  }

  await db
    .prepare('UPDATE snippet SET updated_at = ? WHERE id = ?')
    .bind(now, snippetId)
    .run();

  return { success: true, savedAt: Date.now() };
};

export default function SnippetDetail({ loaderData }: Route.ComponentProps) {
  const fetcher = useFetcher<typeof action>();
  const { triggerTest } = useOutletContext<SnippetDetailContext>();
  const location = useLocation();
  const navigate = useNavigate();

  const { isViewingOldVersion, versionNotFound, requestedVersion } = loaderData;
  const isReadOnly = isViewingOldVersion;

  useSnippetUndoRedo();

  const { sendContentUpdate, subscribeToEvents, sendCursorUpdate, cursors } =
    usePresence(isReadOnly ? undefined : loaderData.snippet.id);

  const [remoteCursors, setRemoteCursors] = useState<CursorPosition[]>([]);
  const systemTextareaRef = useRef<HTMLTextAreaElement | null>(null);

  const setContentFromRemote = useSnippetEditorStore(
    (state) => state.setContentFromRemote,
  );

  const localVersionRef = useRef(0);

  const lastCursorRef = useRef<{
    field: 'systemMessage' | 'userMessage';
    position: number;
  } | null>(null);

  // Note: Using useEffect here is acceptable because this is for external state sync (WebSocket)
  // and not for DOM-related side effects which the CLAUDE.md guidelines warn against
  useEffect(() => {
    if (!subscribeToEvents || isReadOnly) return;

    const callbacks: PresenceEventCallbacks = {
      onContentSync: (field, value, version) => {
        localVersionRef.current = version;
        if (field === 'systemMessage') {
          setContentFromRemote(value);
        }
      },
      onContentState: (state) => {
        if (state.version > 0) {
          localVersionRef.current = state.version;

          const currentContent = useSnippetEditorStore.getState().content;
          if (state.systemMessage !== currentContent) {
            setContentFromRemote(state.systemMessage);
          }
        }
      },
      onCursorSync: (cursor) => {
        setRemoteCursors((prev) => {
          const filtered = prev.filter((c) => c.userId !== cursor.userId);
          return [...filtered, cursor];
        });
      },
      onCursorState: (cursors) => {
        setRemoteCursors(cursors);
      },
      onUserJoined: () => {
        if (lastCursorRef.current && sendCursorUpdate) {
          const { field, position } = lastCursorRef.current;
          const textarea = systemTextareaRef.current;
          const width = textarea?.clientWidth ?? 0;
          sendCursorUpdate(field, position, width);
        }
      },
    };

    return subscribeToEvents(callbacks);
  }, [subscribeToEvents, isReadOnly, setContentFromRemote, sendCursorUpdate]);

  useEffect(() => {
    if (!cursors) return;
    const cursorArray = Array.from(cursors.values());
    setRemoteCursors(cursorArray);
  }, [cursors]);

  const initialContentRef = useRef(loaderData.content);

  const lastInitializedRef = useRef<{
    snippetId: string;
    version: string | null;
  } | null>(null);

  const currentKey = `${loaderData.snippet.id}:${loaderData.currentVersion}`;
  const lastKey = lastInitializedRef.current
    ? `${lastInitializedRef.current.snippetId}:${lastInitializedRef.current.version}`
    : null;
  const needsInit =
    lastKey !== currentKey ||
    useSnippetEditorStore.getState()._snippetId !== loaderData.snippet.id;

  if (needsInit) {
    lastInitializedRef.current = {
      snippetId: loaderData.snippet.id,
      version: loaderData.currentVersion,
    };
    initialContentRef.current = loaderData.content;

    useSnippetEditorStore.getState().initialize({
      snippetId: loaderData.snippet.id,
      content: loaderData.content,
      model: loaderData.model,
      testUserMessage: loaderData.testUserMessage,
      lastOutputTokens: loaderData.lastOutputTokens,
      lastSystemInputTokens: loaderData.lastSystemInputTokens,
    });
  }

  const content = useSnippetEditorStore((state) => state.content);
  const setContent = useSnippetEditorStore((state) => state.setContent);

  const isPendingSaveRef = useRef(false);
  const lastSavedAtRef = useRef<number | null>(null);

  const debouncedSave = useDebouncedCallback(() => {
    const state = useSnippetEditorStore.getState();
    const now = Date.now();

    if (isPendingSaveRef.current) {
      lastSavedAtRef.current = now;
    }

    fetcher.submit({ content: state.content }, { method: 'post' });

    isPendingSaveRef.current = false;
  }, 1000);

  const handleContentChange = useCallback(
    (value: string) => {
      setContent(value);
      sendContentUpdate?.('systemMessage', value);
      isPendingSaveRef.current = true;
      debouncedSave();
    },
    [setContent, sendContentUpdate, debouncedSave],
  );

  const debouncedCursorUpdate = useDebouncedCallback((position: number) => {
    const width = systemTextareaRef.current?.clientWidth ?? 0;
    sendCursorUpdate?.('systemMessage', position, width);
  }, 50);

  const handleSelectionChange = useCallback(
    (position: number) => {
      lastCursorRef.current = { field: 'systemMessage', position };
      debouncedCursorUpdate(position);
    },
    [debouncedCursorUpdate],
  );

  const isContentDirty = content !== initialContentRef.current;

  const suggestedVersion = useMemo(() => {
    if (!loaderData.lastPublishedVersion) return '1.0.0';
    const [major, minor, patch] = loaderData.lastPublishedVersion
      .split('.')
      .map(Number);
    return `${major}.${minor + 1}.${patch}`;
  }, [loaderData.lastPublishedVersion]);

  const hasContentChanges = useMemo(() => {
    if (!loaderData.lastPublishedVersion) return true;
    return loaderData.content !== (loaderData.lastPublishedContent ?? '');
  }, [
    loaderData.lastPublishedVersion,
    loaderData.content,
    loaderData.lastPublishedContent,
  ]);

  const canPublish = loaderData.hasDraft && hasContentChanges && !isReadOnly;

  const handleBackToLatest = useCallback(() => {
    navigate(location.pathname);
  }, [navigate, location.pathname]);

  const [, setSearchParams] = useSearchParams();
  const publishedVersions = loaderData.versions.filter(
    (v: Version) => v.major !== null && v.minor !== null && v.patch !== null,
  );

  const handleVersionClick = (v: Version) => {
    if (v.major !== null && v.minor !== null && v.patch !== null) {
      setSearchParams({ version: `${v.major}.${v.minor}.${v.patch}` });
    }
  };

  if (versionNotFound) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center p-8 animate-in fade-in duration-300">
        <div className="max-w-md w-full">
          <div className="relative mx-auto w-16 h-16 mb-6">
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-muted to-muted/50 rotate-6" />
            <div className="absolute inset-0 rounded-2xl bg-card border border-border flex items-center justify-center shadow-sm">
              <GitBranch className="w-7 h-7 text-muted-foreground" />
            </div>
          </div>

          <div className="text-center mb-8">
            <h2 className="text-xl font-semibold tracking-tight mb-2">
              Version not found
            </h2>
            <p className="text-muted-foreground text-sm leading-relaxed">
              <span className="font-mono text-foreground bg-muted px-1.5 py-0.5 rounded text-xs">
                v{requestedVersion}
              </span>{' '}
              doesn't exist for{' '}
              <span className="font-medium text-foreground">
                {loaderData.snippet.name}
              </span>
            </p>
          </div>

          {publishedVersions.length > 0 && (
            <div className="mb-8">
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium mb-3 text-center">
                Available versions
              </p>
              <div className="flex flex-wrap gap-2 justify-center">
                {publishedVersions.slice(0, 8).map((v: Version) => {
                  const versionString = `${v.major}.${v.minor}.${v.patch}`;
                  return (
                    <button
                      key={versionString}
                      type="button"
                      onClick={() => handleVersionClick(v)}
                      className="group relative"
                    >
                      <Badge
                        variant="outline"
                        className="font-mono text-xs px-2.5 py-1 cursor-pointer transition-all duration-150 hover:bg-primary hover:text-primary-foreground hover:border-primary"
                      >
                        v{versionString}
                      </Badge>
                    </button>
                  );
                })}
                {publishedVersions.length > 8 && (
                  <Badge
                    variant="secondary"
                    className="text-xs px-2.5 py-1 text-muted-foreground"
                  >
                    +{publishedVersions.length - 8} more
                  </Badge>
                )}
              </div>
            </div>
          )}

          <div className="flex justify-center">
            <Button
              onClick={handleBackToLatest}
              className="gap-2 px-6 shadow-sm"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to latest
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col">
      {isViewingOldVersion && (
        <div className="bg-muted border-b px-4 pl-6 py-2 flex items-center justify-between">
          <span className="text-sm text-muted-foreground">
            Viewing version {requestedVersion} (read-only)
          </span>
          <Button variant="outline" size="sm" onClick={handleBackToLatest}>
            Back to latest
          </Button>
        </div>
      )}
      <div className="@container/main flex flex-1 flex-col gap-2">
        <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
          {!isReadOnly && (
            <div className="hidden md:flex px-4 lg:px-6 items-center justify-between gap-2">
              <SnippetEditorMenubar
                snippet={loaderData.snippet}
                isOwner={loaderData.isOwner}
              />
              <PublishSnippetDialog
                snippetId={loaderData.snippet.id}
                suggestedVersion={suggestedVersion}
                lastPublishedVersion={loaderData.lastPublishedVersion}
                disabled={!canPublish}
              >
                <Button className="cursor-pointer" disabled={!canPublish}>
                  Publish <RssIcon />
                </Button>
              </PublishSnippetDialog>
            </div>
          )}
          <div className="px-4 lg:px-6 flex flex-col gap-y-4">
            <h1 className="text-3xl">{loaderData.snippet.name}</h1>
            <div className="text-muted-foreground text-sm -mt-2">
              {loaderData.currentVersion
                ? `v${loaderData.currentVersion}`
                : 'Draft'}
            </div>
            {loaderData.snippet.description && (
              <p className="text-secondary-foreground">
                {loaderData.snippet.description}
              </p>
            )}
            <Separator className="my-4" />
            <PromptEditor
              title="System Prompt Snippet"
              value={content}
              onChange={isReadOnly ? undefined : handleContentChange}
              isDirty={isContentDirty}
              isPendingSave={isPendingSaveRef.current}
              isSaving={false}
              lastSavedAt={lastSavedAtRef.current}
              onTest={triggerTest}
              textareaRef={(el) => {
                systemTextareaRef.current = el;
              }}
              onSelectionChange={isReadOnly ? undefined : handleSelectionChange}
              cursorOverlay={
                !isReadOnly && (
                  <RemoteCursorsOverlay
                    cursors={remoteCursors}
                    textareaRef={systemTextareaRef.current}
                    field="systemMessage"
                  />
                )
              }
              disabled={isReadOnly}
              costCalculator={<SnippetCostCalculatorPopover />}
            />
            {!isReadOnly && (
              <div className="mt-4 md:hidden">
                <PublishSnippetDialog
                  snippetId={loaderData.snippet.id}
                  suggestedVersion={suggestedVersion}
                  lastPublishedVersion={loaderData.lastPublishedVersion}
                  disabled={!canPublish}
                >
                  <Button
                    className="cursor-pointer w-full"
                    disabled={!canPublish}
                  >
                    Publish <RssIcon />
                  </Button>
                </PublishSnippetDialog>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
