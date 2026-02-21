'use client';

import { IconKeyOff, IconX } from '@tabler/icons-react';
import { ChevronRight } from 'lucide-react';
import type * as React from 'react';
import {
  Fragment,
  forwardRef,
  useCallback,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import { NavLink, useNavigate, useParams, useSearchParams } from 'react-router';
import { toast } from 'sonner';
import { NoLlmApiKeysModal } from '~/components/no-llm-api-keys-modal';
import { NoModelsWarning } from '~/components/no-models-warning';
import { SelectScrollable } from '~/components/select-scrollable';
import { SnippetTestCombobox } from '~/components/snippet-test-combobox';
import { StreamingResponse } from '~/components/streaming-response';
import { Badge } from '~/components/ui/badge';
import { Button } from '~/components/ui/button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '~/components/ui/collapsible';
import { Label } from '~/components/ui/label';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarSeparator,
} from '~/components/ui/sidebar';
import { type Version, VersionsTable } from '~/components/versions-table';
import { useCanManageBilling } from '~/hooks/use-can-manage-billing';
import { useEnabledModels } from '~/hooks/use-enabled-models';
import { useIsMobile } from '~/hooks/use-mobile';
import { cn } from '~/lib/utils';
import { useSnippetEditorStore } from '~/stores/snippet-editor-store';

export interface SnippetSidebarRightHandle {
  triggerTest: () => void;
  isStreaming: boolean;
}

type SnippetSidebarRightProps = React.ComponentProps<typeof Sidebar> & {
  versions?: Version[];
  usedByPrompts?: Array<{
    promptId: string;
    promptName: string;
    snippetVersion: string | null;
  }>;
  isReadonly?: boolean;
};

export const SnippetSidebarRight = forwardRef<
  SnippetSidebarRightHandle,
  SnippetSidebarRightProps
>(
  (
    { versions = [], usedByPrompts = [], isReadonly = false, ...props },
    ref,
  ) => {
    const enabledModels = useEnabledModels();
    const hasNoModels = enabledModels.length === 0;
    const [showNoApiKeysModal, setShowNoApiKeysModal] = useState(false);

    // Get state from the snippet store
    const model = useSnippetEditorStore((s) => s.model);
    const testModel = useSnippetEditorStore((s) => s.testModel);
    const testUserMessage = useSnippetEditorStore((s) => s.testUserMessage);
    const testVersionOverride = useSnippetEditorStore(
      (s) => s.testVersionOverride,
    );
    // Get actions from the store
    const setTestModel = useSnippetEditorStore((s) => s.setTestModel);
    const setTestUserMessage = useSnippetEditorStore(
      (s) => s.setTestUserMessage,
    );
    const setTestVersionOverride = useSnippetEditorStore(
      (s) => s.setTestVersionOverride,
    );
    const setLastOutputTokens = useSnippetEditorStore(
      (s) => s.setLastOutputTokens,
    );
    const setLastSystemInputTokens = useSnippetEditorStore(
      (s) => s.setLastSystemInputTokens,
    );

    const [testOpen, setTestOpen] = useState(true);
    const testSectionRef = useRef<HTMLDivElement>(null);

    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const params = useParams();
    const isMobile = useIsMobile();
    const { canManageBilling } = useCanManageBilling();

    // Streaming state
    const [streamText, setStreamText] = useState('');
    const [isStreaming, setIsStreaming] = useState(false);
    const [isComplete, setIsComplete] = useState(false);
    const [streamError, setStreamError] = useState<string | null>(null);

    // Version selector logic
    const versionParam = searchParams.get('version');
    const publishedVersions = versions.filter(
      (v): v is typeof v & { major: number; minor: number; patch: number } =>
        v.major !== null && v.minor !== null && v.patch !== null,
    );
    const hasDraftVersion = versions.some((v) => v.published_at === null);
    const formatSemver = (v: { major: number; minor: number; patch: number }) =>
      `${v.major}.${v.minor}.${v.patch}`;
    const latestPublishedVersion = publishedVersions[0]
      ? formatSemver(publishedVersions[0])
      : null;
    const selectedVersion =
      versionParam || (hasDraftVersion ? 'draft' : latestPublishedVersion);
    const testVersionToUse = testVersionOverride ?? selectedVersion;

    const testModelToUse = testModel || model || '';

    // Show a user-friendly toast for API key errors
    const showApiKeyErrorToast = useCallback(async () => {
      let description: string;
      let actionLabel: string | null = null;
      let actionOnClick: (() => void) | null = null;

      if (canManageBilling) {
        description =
          'Your API key is invalid or expired. Update it in settings to continue testing.';
        actionLabel = 'Update API Key';
        actionOnClick = () => navigate('/settings?tab=llm-api-keys');
      } else {
        try {
          const formData = new FormData();
          formData.append('context', 'invalid-api-key');
          const res = await fetch('/api/request-upgrade', {
            method: 'POST',
            body: formData,
          });
          const result = (await res.json()) as { alreadyNotified?: boolean };
          description = result.alreadyNotified
            ? 'Your API key is invalid or expired. Your admin was already notified.'
            : 'Your API key is invalid or expired. Your admin has been notified.';
        } catch {
          description =
            'Your API key is invalid or expired. Please contact your admin.';
        }
      }

      toast.custom(
        (id) => (
          <div className="w-[388px] rounded-lg border border-border bg-popover p-4 shadow-lg">
            <div className="flex items-start gap-3">
              <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-destructive/10">
                <IconKeyOff className="size-4 text-destructive" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-popover-foreground">
                  API key error
                </p>
                <p className="mt-1 text-sm leading-snug text-muted-foreground">
                  {description}
                </p>
              </div>
              <button
                type="button"
                onClick={() => toast.dismiss(id)}
                className="shrink-0 cursor-pointer rounded-md p-1 text-muted-foreground/50 transition-colors hover:text-muted-foreground"
              >
                <IconX className="size-3.5" />
              </button>
            </div>
            {actionLabel && actionOnClick && (
              <div className="mt-3 flex justify-end">
                <Button
                  size="sm"
                  onClick={() => {
                    actionOnClick();
                    toast.dismiss(id);
                  }}
                >
                  {actionLabel}
                </Button>
              </div>
            )}
          </div>
        ),
        { duration: 12000 },
      );
    }, [canManageBilling, navigate]);

    const handleTestUserMessageChange = useCallback(
      (value: string) => {
        setTestUserMessage(value);
      },
      [setTestUserMessage],
    );

    // Handle running the snippet test
    const handleRunSnippet = useCallback(async () => {
      const { snippetId } = params;
      if (!snippetId) return;

      if (enabledModels.length === 0) {
        setShowNoApiKeysModal(true);
        return;
      }

      setStreamText('');
      setIsStreaming(true);
      setIsComplete(false);
      setStreamError(null);

      try {
        const formData = new FormData();
        formData.set('snippetId', snippetId);
        formData.set('userMessage', testUserMessage);
        if (testModelToUse) formData.set('model', testModelToUse);
        if (testVersionToUse) formData.set('version', testVersionToUse);

        const response = await fetch('/api/snippets/run', {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
          const errorData = (await response.json().catch(() => ({}))) as {
            error?: string;
            errorType?: string;
          };
          if (errorData.errorType === 'AUTH_ERROR') {
            showApiKeyErrorToast();
            return;
          }
          throw new Error(errorData.error || `HTTP ${response.status}`);
        }

        if (!response.body) {
          throw new Error('No response body');
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let fullText = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          fullText += chunk;
          setStreamText(fullText);
        }

        // Check for error markers in stream
        const errorMatch = fullText.match(/\[Error:(?:(\w+):)?(.+)\]$/);
        if (errorMatch) {
          const errorType = errorMatch[1] || 'STREAM_ERROR';
          const errorMessage = errorMatch[2];
          setStreamText('');
          if (errorType === 'AUTH_ERROR') {
            showApiKeyErrorToast();
            return;
          }
          throw new Error(errorMessage);
        }

        setIsComplete(true);

        // Fetch token usage
        try {
          const usageParams = new URLSearchParams({ snippetId });
          if (testVersionToUse) {
            usageParams.set('version', testVersionToUse);
          }
          const usageRes = await fetch(
            `/api/snippets/usage?${usageParams.toString()}`,
          );
          if (usageRes.ok) {
            const usageData = (await usageRes.json()) as {
              outputTokens?: number | null;
              systemInputTokens?: number | null;
            };
            if (usageData.outputTokens != null) {
              setLastOutputTokens(usageData.outputTokens);
            }
            if (usageData.systemInputTokens != null) {
              setLastSystemInputTokens(usageData.systemInputTokens);
            }
          }
        } catch {
          // Ignore usage fetch errors
        }
      } catch (err) {
        setStreamError(
          err instanceof Error ? err.message : 'An error occurred',
        );
      } finally {
        setIsStreaming(false);
      }
    }, [
      params,
      enabledModels,
      testUserMessage,
      testModelToUse,
      testVersionToUse,
      showApiKeyErrorToast,
      setLastOutputTokens,
      setLastSystemInputTokens,
    ]);

    const triggerTest = useCallback(() => {
      setTestOpen(true);
      testSectionRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
      setTimeout(handleRunSnippet, 100);
    }, [handleRunSnippet]);

    useImperativeHandle(
      ref,
      () => ({
        triggerTest,
        isStreaming,
      }),
      [triggerTest, isStreaming],
    );

    return (
      <Sidebar
        collapsible="none"
        className={cn(
          isMobile
            ? 'relative border-t bg-sidebar w-full overflow-x-hidden'
            : 'border-l',
        )}
        {...props}
      >
        <SidebarContent>
          {/* Versions section */}
          <Fragment key={0}>
            <SidebarGroup className="py-1">
              <Collapsible defaultOpen={true} className="group/collapsible">
                <SidebarGroupLabel
                  asChild
                  className="group/label text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground w-full text-sm"
                >
                  <CollapsibleTrigger>
                    Versions
                    <ChevronRight className="ml-auto transition-transform group-data-[state=open]/collapsible:rotate-90" />
                  </CollapsibleTrigger>
                </SidebarGroupLabel>
                <CollapsibleContent>
                  <SidebarGroupContent>
                    <VersionsTable versions={versions} />
                  </SidebarGroupContent>
                </CollapsibleContent>
              </Collapsible>
            </SidebarGroup>
            <SidebarSeparator className="mx-0" />
          </Fragment>

          {/* Used by section */}
          <Fragment key={1}>
            <SidebarGroup className="py-1">
              <Collapsible defaultOpen={false} className="group/collapsible">
                <SidebarGroupLabel
                  asChild
                  className="group/label text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground w-full text-sm"
                >
                  <CollapsibleTrigger>
                    Used by
                    <ChevronRight className="ml-auto transition-transform group-data-[state=open]/collapsible:rotate-90" />
                  </CollapsibleTrigger>
                </SidebarGroupLabel>
                <CollapsibleContent>
                  <SidebarGroupContent>
                    {usedByPrompts.length === 0 ? (
                      <p className="text-xs text-muted-foreground px-2 py-3">
                        No prompts are using this snippet yet.
                      </p>
                    ) : (
                      <div className="space-y-1 px-2 py-2">
                        {usedByPrompts.map((p) => (
                          <NavLink
                            key={p.promptId}
                            to={`/prompts/${p.promptId}`}
                            className="flex items-center justify-between px-2 py-1.5 text-xs hover:bg-accent rounded"
                          >
                            <span className="truncate font-medium">
                              {p.promptName}
                            </span>
                            {p.snippetVersion && (
                              <Badge
                                variant="outline"
                                className="text-[10px] font-mono ml-2"
                              >
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
            <SidebarSeparator className="mx-0" />
          </Fragment>

          {/* Test section */}
          <Fragment key={2}>
            <SidebarGroup ref={testSectionRef} className="py-0">
              <Collapsible
                open={testOpen}
                onOpenChange={setTestOpen}
                className="group/collapsible"
              >
                <SidebarGroupLabel
                  asChild
                  className="group/label text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground w-full text-sm"
                >
                  <CollapsibleTrigger>
                    Test
                    <ChevronRight className="ml-auto transition-transform group-data-[state=open]/collapsible:rotate-90" />
                  </CollapsibleTrigger>
                </SidebarGroupLabel>
                <CollapsibleContent>
                  <SidebarGroupContent>
                    <div className="flex flex-col gap-y-3 px-2 py-3">
                      {/* Test phrase */}
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
                        {hasNoModels ? (
                          <NoModelsWarning />
                        ) : (
                          <SelectScrollable
                            value={testModelToUse}
                            onChange={setTestModel}
                            enabledModels={enabledModels}
                          />
                        )}
                      </div>

                      {/* Version select */}
                      <div className="space-y-1.5">
                        <Label className="text-xs">Version</Label>
                        <Select
                          value={testVersionToUse ?? ''}
                          onValueChange={setTestVersionOverride}
                          disabled={
                            !hasDraftVersion && publishedVersions.length === 0
                          }
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue
                              placeholder={
                                !hasDraftVersion &&
                                publishedVersions.length === 0
                                  ? 'No versions available'
                                  : 'Select version'
                              }
                            />
                          </SelectTrigger>
                          <SelectContent>
                            {hasDraftVersion && (
                              <SelectGroup>
                                <SelectLabel>Current</SelectLabel>
                                <SelectItem value="draft">
                                  Draft (current)
                                </SelectItem>
                              </SelectGroup>
                            )}
                            {publishedVersions.length > 0 && (
                              <SelectGroup>
                                <SelectLabel>Published Versions</SelectLabel>
                                {publishedVersions.map((v) => {
                                  const ver = formatSemver(v);
                                  return (
                                    <SelectItem key={ver} value={ver}>
                                      v{ver}
                                      {ver === latestPublishedVersion
                                        ? ' (latest)'
                                        : ''}
                                    </SelectItem>
                                  );
                                })}
                              </SelectGroup>
                            )}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Run button */}
                      <Button
                        className={cn(
                          'w-full font-medium transition-all duration-200',
                          isStreaming
                            ? 'bg-primary/80'
                            : 'bg-linear-to-r from-primary to-primary/90 hover:from-primary/95 hover:to-primary/85 shadow-sm hover:shadow-md',
                        )}
                        onClick={handleRunSnippet}
                        disabled={isStreaming || !testUserMessage.trim()}
                      >
                        {isStreaming ? (
                          <span className="flex items-center gap-2">
                            <span className="size-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                            Running...
                          </span>
                        ) : (
                          'Test'
                        )}
                      </Button>

                      {/* Response */}
                      <div className="pt-3">
                        <div className="text-xs font-medium text-sidebar-foreground mb-2 block">
                          Response
                        </div>
                        <StreamingResponse
                          text={streamText}
                          isStreaming={isStreaming}
                          isComplete={isComplete}
                          error={streamError}
                        />
                      </div>
                    </div>
                  </SidebarGroupContent>
                </CollapsibleContent>
              </Collapsible>
            </SidebarGroup>
            <SidebarSeparator className="mx-0" />
          </Fragment>
        </SidebarContent>
        <NoLlmApiKeysModal
          open={showNoApiKeysModal}
          onOpenChange={setShowNoApiKeysModal}
        />
      </Sidebar>
    );
  },
);

SnippetSidebarRight.displayName = 'SnippetSidebarRight';
