import type { Editor } from '@tiptap/react';
import { ArrowLeft, GitBranch, RssIcon } from 'lucide-react';
import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  useFetcher,
  useLocation,
  useNavigate,
  useOutletContext,
  useSearchParams,
} from 'react-router';
import { useDebouncedCallback } from 'use-debounce';
import { Skeleton } from '~/components/ui/skeleton';
import { useVariableSyncModal } from '~/hooks/use-variable-sync-modal';
import { usePromptSchemaCacheStore } from '~/stores/prompt-schema-cache';

const ComposerEditor = lazy(() =>
  import('~/components/composer-editor').then((m) => ({
    default: m.ComposerEditor,
  })),
);
const ComposerEditorMenubar = lazy(() =>
  import('~/components/composer-editor-menubar').then((m) => ({
    default: m.ComposerEditorMenubar,
  })),
);
const PublishComposerDialog = lazy(() =>
  import('~/components/publish-composer-dialog').then((m) => ({
    default: m.PublishComposerDialog,
  })),
);
const AddPromptVariablesModal = lazy(() =>
  import('~/components/composer-editor/add-prompt-variables-modal').then(
    (m) => ({ default: m.AddPromptVariablesModal }),
  ),
);
const RemovePromptVariablesModal = lazy(() =>
  import('~/components/composer-editor/remove-prompt-variables-modal').then(
    (m) => ({ default: m.RemovePromptVariablesModal }),
  ),
);

import { Badge } from '~/components/ui/badge';
import { Button } from '~/components/ui/button';
import { Separator } from '~/components/ui/separator';
import type { Version } from '~/components/versions-table';
import { authContext, orgContext, sessionContext } from '~/context';
import { useComposerUndoRedo } from '~/hooks/use-composer-undo-redo';
import {
  type CursorPosition,
  type PresenceEventCallbacks,
  usePresence,
} from '~/hooks/use-presence';
import type { SchemaField } from '~/lib/schema-types';
import { useComposerEditorStore } from '~/stores/composer-editor-store';
import type { Route } from './+types/composers.composerId';

type ComposerDetailContext = {
  triggerTest: () => void;
};

type OrgMember = {
  userId: string;
  role: 'member' | 'admin' | 'owner';
};

type FullOrganization = {
  members?: OrgMember[];
};

const sortByName = (fields: SchemaField[]) =>
  [...fields].sort((a, b) => a.name.localeCompare(b.name));

// biome-ignore lint/correctness/noEmptyPattern: react router default
export const meta = ({}: Route.MetaArgs) => [
  { title: 'Composer | Promptly' },
  {
    name: 'description',
    content: 'Orchestrate multiple prompts into a single output',
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

  const { composerId } = params;
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

  const composer = await db
    .prepare(
      'SELECT id, name, description, folder_id FROM composer WHERE id = ? AND organization_id = ? AND deleted_at IS NULL',
    )
    .bind(composerId, org.organizationId)
    .first<{
      id: string;
      name: string;
      description: string;
      folder_id: string;
    }>();

  if (!composer) {
    throw new Response('Composer not found', { status: 404 });
  }

  const folder = await db
    .prepare(
      'SELECT id, name FROM composer_folder WHERE id = ? AND organization_id = ?',
    )
    .bind(composer.folder_id, org.organizationId)
    .first<{ id: string; name: string }>();

  if (!folder) {
    throw new Response('Folder not found', { status: 404 });
  }

  const versionsResult = await db
    .prepare(
      `SELECT cv.major, cv.minor, cv.patch, cv.updated_at, u_updated.name as updated_by, cv.published_at, u_published.name as published_by, u_created.name as created_by
       FROM composer_version cv
       LEFT JOIN user u_created ON cv.created_by = u_created.id
       LEFT JOIN user u_updated ON cv.updated_by = u_updated.id
       LEFT JOIN user u_published ON cv.published_by = u_published.id
       WHERE cv.composer_id = ?
       ORDER BY (cv.published_at IS NULL) DESC, cv.major DESC, cv.minor DESC, cv.patch DESC`,
    )
    .bind(composerId)
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
        'SELECT id, content, config, major, minor, patch, published_at, published_by, created_by, updated_at, updated_by FROM composer_version WHERE composer_id = ? AND major = ? AND minor = ? AND patch = ?',
      )
      .bind(composerId, requestedMajor, requestedMinor, requestedPatch)
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
        'SELECT id, content, config, major, minor, patch, published_at, published_by, created_by, updated_at, updated_by FROM composer_version WHERE composer_id = ? ORDER BY (published_at IS NULL) DESC, created_at DESC LIMIT 1',
      )
      .bind(composerId)
      .first();
  }

  let schemaFields: SchemaField[] = [];
  let inputData: unknown = null;
  let inputDataRootName: string | null = null;
  try {
    if (targetVersion?.config) {
      const parsed = JSON.parse(targetVersion.config);
      schemaFields = parsed.schema ?? [];
      inputData = parsed.inputData ?? null;
      inputDataRootName = parsed.inputDataRootName ?? null;
    }
  } catch {
    // Keep defaults
  }

  const lastPublishedResult = await db
    .prepare(
      'SELECT major, minor, patch, content, config FROM composer_version WHERE composer_id = ? AND published_at IS NOT NULL ORDER BY major DESC, minor DESC, patch DESC LIMIT 1',
    )
    .bind(composerId)
    .first<{
      major: number;
      minor: number;
      patch: number;
      content: string | null;
      config: string | null;
    }>();

  let lastPublishedSchema: SchemaField[] | null = null;
  try {
    if (lastPublishedResult?.config) {
      const parsed = JSON.parse(lastPublishedResult.config);
      lastPublishedSchema = parsed.schema ?? null;
    }
  } catch {
    // Keep null
  }

  // Fetch available prompts for the prompt ref picker
  const promptsResult = await db
    .prepare(
      'SELECT id, name FROM prompt WHERE organization_id = ? AND deleted_at IS NULL ORDER BY name ASC',
    )
    .bind(org.organizationId)
    .all<{ id: string; name: string }>();

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
    composer,
    currentVersion: currentVersionString,
    versions: versionsResult.results,
    content: targetVersion?.content ?? '',
    schemaFields,
    inputData,
    inputDataRootName,
    lastPublishedVersion: lastPublishedVersionString,
    lastPublishedContent: lastPublishedResult?.content ?? null,
    lastPublishedSchema,
    hasDraft,
    isViewingOldVersion,
    versionNotFound,
    requestedVersion,
    isOwner,
    prompts: promptsResult.results ?? [],
  };
};

export default function ComposerDetail({ loaderData }: Route.ComponentProps) {
  const fetcher = useFetcher();
  const { triggerTest } = useOutletContext<ComposerDetailContext>();
  const location = useLocation();
  const navigate = useNavigate();

  const { isViewingOldVersion, versionNotFound, requestedVersion } = loaderData;
  const isReadOnly = isViewingOldVersion;

  useComposerUndoRedo();

  const getEditorHtml = useCallback(
    () =>
      editorRef.current?.getHTML() ?? useComposerEditorStore.getState().content,
    [],
  );

  const {
    addModal,
    removeModal,
    setAddModalOpen,
    setRemoveModalOpen,
    handlePromptAdded,
    handlePromptRemoved,
    handleAddSelected,
    handleRemoveSelected,
  } = useVariableSyncModal(getEditorHtml);

  const { sendContentUpdate, subscribeToEvents, sendCursorUpdate, cursors } =
    usePresence(isReadOnly ? undefined : loaderData.composer.id);

  const [_remoteCursors, setRemoteCursors] = useState<CursorPosition[]>([]);
  const editorRef = useRef<Editor | null>(null);

  const setContentFromRemote = useComposerEditorStore(
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
          // Sync Tiptap editor with remote content (without adding to history)
          if (editorRef.current) {
            editorRef.current.commands.setContent(value, {
              emitUpdate: false,
            });
          }
        }
      },
      onContentState: (state) => {
        if (state.version > 0) {
          localVersionRef.current = state.version;

          const currentContent = useComposerEditorStore.getState().content;
          if (state.systemMessage !== currentContent) {
            setContentFromRemote(state.systemMessage);
            if (editorRef.current) {
              editorRef.current.commands.setContent(state.systemMessage, {
                emitUpdate: false,
              });
            }
          }
        }
      },
      onCursorSync: (cursor) => {
        setRemoteCursors((prev) => {
          const filtered = prev.filter((c) => c.userId !== cursor.userId);
          return [...filtered, cursor];
        });
      },
      onCursorState: (cursorState) => {
        setRemoteCursors(cursorState);
      },
      onUserJoined: () => {
        if (lastCursorRef.current && sendCursorUpdate) {
          const { field, position } = lastCursorRef.current;
          sendCursorUpdate(field, position, 0);
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
    composerId: string;
    version: string | null;
  } | null>(null);

  const currentKey = `${loaderData.composer.id}:${loaderData.currentVersion}`;
  const lastKey = lastInitializedRef.current
    ? `${lastInitializedRef.current.composerId}:${lastInitializedRef.current.version}`
    : null;
  const needsInit =
    lastKey !== currentKey ||
    useComposerEditorStore.getState()._composerId !== loaderData.composer.id;

  if (needsInit) {
    lastInitializedRef.current = {
      composerId: loaderData.composer.id,
      version: loaderData.currentVersion,
    };
    initialContentRef.current = loaderData.content;
    usePromptSchemaCacheStore.getState().clear();

    useComposerEditorStore.getState().initialize({
      composerId: loaderData.composer.id,
      content: loaderData.content,
      schemaFields: loaderData.schemaFields,
      inputData: loaderData.inputData,
      inputDataRootName: loaderData.inputDataRootName,
    });
  }

  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);

  // Note: Using useEffect here is acceptable — reacting to fetcher completion is external state sync
  const prevFetcherStateRef = useRef(fetcher.state);
  useEffect(() => {
    const wasActive = prevFetcherStateRef.current !== 'idle';
    prevFetcherStateRef.current = fetcher.state;
    if (wasActive && fetcher.state === 'idle') {
      setLastSavedAt(Date.now());
    }
  }, [fetcher.state]);

  const debouncedSave = useDebouncedCallback(() => {
    const state = useComposerEditorStore.getState();

    fetcher.submit(
      { composerId: loaderData.composer.id, content: state.content },
      { method: 'post', action: '/api/composers/save-content' },
    );
  }, 1000);

  const handleContentChange = useCallback(
    (value: string) => {
      useComposerEditorStore.getState().setContent(value);
      sendContentUpdate?.('systemMessage', value);
      debouncedSave();
    },
    [sendContentUpdate, debouncedSave],
  );

  const handleEditorReady = useCallback((editor: Editor) => {
    editorRef.current = editor;
  }, []);

  const isContentDirty = useComposerEditorStore(
    (state) => state.content !== state._initialContent,
  );

  const schemasEqual = useMemo(() => {
    if (!loaderData.lastPublishedSchema) return true;
    return (
      JSON.stringify(sortByName(loaderData.schemaFields)) ===
      JSON.stringify(sortByName(loaderData.lastPublishedSchema))
    );
  }, [loaderData.schemaFields, loaderData.lastPublishedSchema]);

  const suggestedVersion = useMemo(() => {
    if (!loaderData.lastPublishedVersion) return '1.0.0';
    const [major, minor, patch] = loaderData.lastPublishedVersion
      .split('.')
      .map(Number);
    return schemasEqual ? `${major}.${minor + 1}.${patch}` : `${major + 1}.0.0`;
  }, [loaderData.lastPublishedVersion, schemasEqual]);

  const hasContentChanges = useMemo(() => {
    if (!loaderData.lastPublishedVersion) return true;
    const contentChanged =
      loaderData.content !== (loaderData.lastPublishedContent ?? '');
    return contentChanged || !schemasEqual;
  }, [
    loaderData.lastPublishedVersion,
    loaderData.content,
    loaderData.lastPublishedContent,
    schemasEqual,
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
                {loaderData.composer.name}
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
          <Suspense
            fallback={
              <div className="px-4 lg:px-6 flex flex-col gap-y-4">
                <Skeleton className="h-10 w-full rounded-md" />
                <Skeleton className="h-[400px] w-full rounded-xl" />
              </div>
            }
          >
            {!isReadOnly && (
              <div className="hidden md:flex px-4 lg:px-6 items-center justify-between gap-2">
                <ComposerEditorMenubar
                  composer={loaderData.composer}
                  isOwner={loaderData.isOwner}
                />
                <PublishComposerDialog
                  composerId={loaderData.composer.id}
                  suggestedVersion={suggestedVersion}
                  lastPublishedVersion={loaderData.lastPublishedVersion}
                  isSchemaChanged={!schemasEqual}
                  disabled={!canPublish}
                >
                  <Button className="cursor-pointer" disabled={!canPublish}>
                    Publish <RssIcon />
                  </Button>
                </PublishComposerDialog>
              </div>
            )}
            <div className="px-4 lg:px-6 flex flex-col gap-y-4">
              <h1 className="text-3xl">{loaderData.composer.name}</h1>
              <div className="text-muted-foreground text-sm -mt-2">
                {loaderData.currentVersion
                  ? `v${loaderData.currentVersion}`
                  : 'Draft'}
              </div>
              {loaderData.composer.description && (
                <p className="text-secondary-foreground">
                  {loaderData.composer.description}
                </p>
              )}
              <Separator className="my-4" />
              <ComposerEditor
                content={initialContentRef.current}
                onChange={isReadOnly ? undefined : handleContentChange}
                isDirty={isContentDirty}
                isPendingSave={fetcher.state === 'submitting'}
                isSaving={fetcher.state === 'loading'}
                lastSavedAt={lastSavedAt}
                onTest={triggerTest}
                disabled={isReadOnly}
                prompts={loaderData.prompts}
                onEditorReady={handleEditorReady}
                onPromptAdded={isReadOnly ? undefined : handlePromptAdded}
                onPromptRefRemoved={
                  isReadOnly ? undefined : handlePromptRemoved
                }
              />
              {!isReadOnly && (
                <div className="mt-4 md:hidden">
                  <PublishComposerDialog
                    composerId={loaderData.composer.id}
                    suggestedVersion={suggestedVersion}
                    lastPublishedVersion={loaderData.lastPublishedVersion}
                    isSchemaChanged={!schemasEqual}
                    disabled={!canPublish}
                  >
                    <Button
                      className="cursor-pointer w-full"
                      disabled={!canPublish}
                    >
                      Publish <RssIcon />
                    </Button>
                  </PublishComposerDialog>
                </div>
              )}
            </div>
          </Suspense>
        </div>
      </div>
      {addModal.open && (
        <Suspense fallback={null}>
          <AddPromptVariablesModal
            open={addModal.open}
            onOpenChange={setAddModalOpen}
            promptName={addModal.promptName}
            variables={addModal.variables}
            existingFields={addModal.existingFields}
            onAddSelected={handleAddSelected}
          />
        </Suspense>
      )}
      {removeModal.open && (
        <Suspense fallback={null}>
          <RemovePromptVariablesModal
            open={removeModal.open}
            onOpenChange={setRemoveModalOpen}
            promptName={removeModal.promptName}
            variables={removeModal.variables}
            onRemoveSelected={handleRemoveSelected}
          />
        </Suspense>
      )}
    </div>
  );
}
