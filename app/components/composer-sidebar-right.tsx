'use client';

import { IconAlertTriangle } from '@tabler/icons-react';
import { JsonEditor, type Theme } from 'json-edit-react';
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
import { useFetcher, useParams, useSearchParams } from 'react-router';
import { toast } from 'sonner';
import { useDebouncedCallback } from 'use-debounce';
import { CodePreview } from '~/components/code-preview';
import {
  ComposerStreamingResponse,
  type DocumentSegment,
} from '~/components/composer-streaming-response';
import { SchemaBuilder } from '~/components/schema-builder';
import { Button } from '~/components/ui/button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '~/components/ui/collapsible';
import {
  Item,
  ItemContent,
  ItemDescription,
  ItemMedia,
} from '~/components/ui/item';
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
import { useTheme } from '~/hooks/use-dark-mode';
import { useEnabledModels } from '~/hooks/use-enabled-models';
import { useIsMobile } from '~/hooks/use-mobile';
import { extractPromptIds } from '~/lib/composer-content-parser';
import type { SchemaField } from '~/lib/schema-types';
import { cn } from '~/lib/utils';
import { useComposerEditorStore } from '~/stores/composer-editor-store';

const DEFAULT_INPUT_DATA: unknown = {};

const sidebarLightTheme: Theme = {
  styles: {
    container: {
      backgroundColor: 'transparent',
      fontFamily: 'inherit',
    },
    property: 'oklch(0.554 0.046 257.417)',
    itemCount: 'oklch(0.554 0.046 257.417)',
    bracket: 'oklch(0.704 0.04 256.788)',
    string: 'oklch(0.65 0.19 50)',
    number: 'oklch(0.65 0.19 50)',
    boolean: 'oklch(0.65 0.19 50)',
    null: 'oklch(0.65 0.19 50)',
    iconEdit: 'oklch(0.488 0.243 264.376)',
    iconDelete: 'oklch(0.577 0.245 27.325)',
    iconAdd: 'oklch(0.6 0.118 184.704)',
    iconCopy: 'oklch(0.554 0.046 257.417)',
    iconOk: 'oklch(0.6 0.118 184.704)',
    iconCancel: 'oklch(0.577 0.245 27.325)',
    input: {
      backgroundColor: 'oklch(0.968 0.007 247.896)',
      color: 'oklch(0.129 0.042 264.695)',
      border: '1px solid oklch(0.929 0.013 255.508)',
      borderRadius: '0.375rem',
      padding: '0.25rem 0.5rem',
      fontSize: '0.75rem',
    },
  },
};

const sidebarDarkTheme: Theme = {
  styles: {
    container: {
      backgroundColor: 'transparent',
      fontFamily: 'inherit',
    },
    property: 'lab(66.128% 0 0)',
    itemCount: 'lab(74% 0 0)',
    bracket: 'lab(48.496% 0 0)',
    string: 'lab(70% 45 65)',
    number: 'lab(70% 45 65)',
    boolean: 'lab(70% 45 65)',
    null: 'lab(70% 45 65)',
    iconEdit: 'lab(36.9089% 35.0961 -85.6872)',
    iconDelete: 'lab(63.7053% 60.745 31.3109)',
    iconAdd: 'lab(65% -35 30)',
    iconCopy: 'lab(66.128% 0 0)',
    iconOk: 'lab(65% -35 30)',
    iconCancel: 'lab(63.7053% 60.745 31.3109)',
    input: {
      backgroundColor: 'lab(15.204% 0 0)',
      color: 'lab(98.26% 0 0)',
      border: '1px solid lab(100% 0 0 / 15%)',
      borderRadius: '0.375rem',
      padding: '0.25rem 0.5rem',
      fontSize: '0.75rem',
    },
  },
};

export interface ComposerSidebarRightHandle {
  triggerTest: () => void;
  isStreaming: boolean;
}

type ComposerSidebarRightProps = React.ComponentProps<typeof Sidebar> & {
  versions?: Version[];
  isReadonly?: boolean;
};

export const ComposerSidebarRight = forwardRef<
  ComposerSidebarRightHandle,
  ComposerSidebarRightProps
>(({ versions = [], isReadonly = false, ...props }, ref) => {
  const content = useComposerEditorStore((s) => s.content);
  const schemaFields = useComposerEditorStore((s) => s.schemaFields);
  const inputData = useComposerEditorStore((s) => s.inputData);
  const inputDataRootName = useComposerEditorStore((s) => s.inputDataRootName);
  const testVersionOverride = useComposerEditorStore(
    (s) => s.testVersionOverride,
  );

  const setSchemaFields = useComposerEditorStore((s) => s.setSchemaFields);
  const setInputData = useComposerEditorStore((s) => s.setInputData);
  const setTestVersionOverride = useComposerEditorStore(
    (s) => s.setTestVersionOverride,
  );

  const [isGeneratingInputData, setIsGeneratingInputData] = useState(false);
  const [testOpen, setTestOpen] = useState(true);
  const testSectionRef = useRef<HTMLDivElement>(null);

  const configFetcher = useFetcher();
  const [searchParams] = useSearchParams();
  const params = useParams();
  const isMobile = useIsMobile();
  const enabledModels = useEnabledModels();
  const hasNoModels = enabledModels.length === 0;

  const [segments, setSegments] = useState<DocumentSegment[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [streamErrors, setStreamErrors] = useState<
    Array<{ promptId: string; error: string }>
  >([]);
  const bufferRef = useRef('');

  const promptRefCount = extractPromptIds(content).length;
  const hasNoPromptRefs = promptRefCount === 0;

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

  const debouncedSaveConfig = useDebouncedCallback(() => {
    const { composerId } = params;
    if (!composerId) return;
    const state = useComposerEditorStore.getState();
    const config = {
      schema: state.schemaFields,
      inputData: state.inputData,
      inputDataRootName: state.inputDataRootName,
    };
    configFetcher.submit(
      { composerId, config: JSON.stringify(config) },
      { action: '/api/composers/save-config', method: 'post' },
    );
  }, 1000);

  const handleSchemaChange = useCallback(
    (fields: SchemaField[]) => {
      setSchemaFields(fields);
      debouncedSaveConfig();
    },
    [debouncedSaveConfig, setSchemaFields],
  );

  const handleInputDataChange = useCallback(
    (value: unknown) => {
      setInputData(value);
      debouncedSaveConfig();
    },
    [debouncedSaveConfig, setInputData],
  );

  const handleGenerateInputData = useCallback(async () => {
    if (schemaFields.length === 0) return;

    setIsGeneratingInputData(true);
    try {
      const response = await fetch('/api/generate-input-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ schema: schemaFields }),
      });

      if (!response.ok) {
        const errorData = (await response.json().catch(() => ({}))) as {
          error?: string;
          errorType?: string;
        };
        if (errorData.errorType === 'NO_API_KEY') {
          toast.error('No API key configured', {
            description:
              'Add an LLM API key in settings to generate test data.',
          });
          return;
        }
        toast.error('Failed to generate test data', {
          description: errorData.error || `HTTP ${response.status}`,
        });
        return;
      }

      const result = (await response.json()) as {
        inputData?: unknown;
        rootName?: string | null;
      };
      if (result.inputData !== undefined) {
        setInputData(result.inputData, result.rootName ?? null);
        debouncedSaveConfig();
      }
    } catch (error) {
      console.error('Failed to generate input data:', error);
      toast.error('Failed to generate test data', {
        description: 'An unexpected error occurred. Please try again.',
      });
    } finally {
      setIsGeneratingInputData(false);
    }
  }, [schemaFields, debouncedSaveConfig, setInputData]);

  const processNdjsonLine = useCallback((line: string) => {
    try {
      const msg = JSON.parse(line);
      switch (msg.type) {
        case 'static':
          setSegments((prev) => {
            const existing = prev.findIndex((s) => s.index === msg.index);
            const segment: DocumentSegment = {
              index: msg.index,
              type: 'static',
              content: msg.content,
              status: 'done',
            };
            if (existing >= 0) {
              const updated = [...prev];
              updated[existing] = segment;
              return updated;
            }
            return [...prev, segment].sort((a, b) => a.index - b.index);
          });
          break;
        case 'prompt_ref':
          setSegments((prev) =>
            [
              ...prev,
              {
                index: msg.index,
                type: 'prompt_ref' as const,
                content: '',
                promptId: msg.promptId,
                promptName: msg.promptName,
                status: 'pending' as const,
              },
            ].sort((a, b) => a.index - b.index),
          );
          break;
        case 'html_block':
          setSegments((prev) => {
            const existing = prev.findIndex((s) => s.index === msg.index);
            const segment: DocumentSegment = {
              index: msg.index,
              type: 'html_block',
              content: msg.plainText ?? '',
              innerHtml: msg.innerHtml,
              status: 'done',
            };
            if (existing >= 0) {
              const updated = [...prev];
              updated[existing] = segment;
              return updated;
            }
            return [...prev, segment].sort((a, b) => a.index - b.index);
          });
          break;
        case 'prompt_start':
          setSegments((prev) =>
            prev.map((s) =>
              s.promptId === msg.promptId
                ? { ...s, status: 'streaming' as const }
                : s,
            ),
          );
          break;
        case 'prompt_chunk':
          setSegments((prev) =>
            prev.map((s) =>
              s.promptId === msg.promptId
                ? { ...s, content: s.content + msg.chunk }
                : s,
            ),
          );
          break;
        case 'prompt_done':
          setSegments((prev) =>
            prev.map((s) =>
              s.promptId === msg.promptId && s.status !== 'error'
                ? { ...s, status: 'done' as const }
                : s,
            ),
          );
          break;
        case 'complete': {
          setIsComplete(true);
          const errors = (msg.errors || []) as Array<{
            promptId: string;
            error: string;
          }>;
          setStreamErrors(errors);
          if (errors.length > 0) {
            setSegments((prev) =>
              prev.map((s) => {
                const matchingError = errors.find(
                  (e) => e.promptId === s.promptId,
                );
                if (matchingError && s.status !== 'done') {
                  return {
                    ...s,
                    status: 'error' as const,
                    error: matchingError.error,
                  };
                }
                return s;
              }),
            );
          }
          break;
        }
      }
    } catch {
      // Ignore malformed JSON lines
    }
  }, []);

  const handleRunComposer = useCallback(async () => {
    const { composerId } = params;
    if (!composerId) return;

    setSegments([]);
    setIsStreaming(true);
    setIsComplete(false);
    setStreamErrors([]);
    bufferRef.current = '';

    try {
      const formData = new FormData();
      formData.set('composerId', composerId);
      if (testVersionToUse) formData.set('version', testVersionToUse);
      if (inputData !== null) {
        formData.set('inputData', JSON.stringify(inputData));
      }
      if (inputDataRootName) {
        formData.set('inputDataRootName', inputDataRootName);
      }

      const response = await fetch('/api/composers/run', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = (await response.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      if (!response.body) {
        throw new Error('No response body');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const text = decoder.decode(value, { stream: true });
        bufferRef.current += text;

        const lines = bufferRef.current.split('\n');
        bufferRef.current = lines.pop() ?? '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed) {
            processNdjsonLine(trimmed);
          }
        }
      }

      if (bufferRef.current.trim()) {
        processNdjsonLine(bufferRef.current.trim());
        bufferRef.current = '';
      }
    } catch (err) {
      setStreamErrors([
        {
          promptId: '',
          error: err instanceof Error ? err.message : 'An error occurred',
        },
      ]);
      setIsComplete(true);
    } finally {
      setIsStreaming(false);
    }
  }, [
    params,
    testVersionToUse,
    inputData,
    inputDataRootName,
    processNdjsonLine,
  ]);

  const triggerTest = useCallback(() => {
    setTestOpen(true);
    testSectionRef.current?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    });
    setTimeout(handleRunComposer, 100);
  }, [handleRunComposer]);

  useImperativeHandle(
    ref,
    () => ({
      triggerTest,
      isStreaming,
    }),
    [triggerTest, isStreaming],
  );

  const { isDark: isDarkMode } = useTheme();
  const jsonEditorTheme = isDarkMode ? sidebarDarkTheme : sidebarLightTheme;

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

        <Fragment key={1}>
          <SidebarGroup className="py-1">
            <Collapsible defaultOpen={false} className="group/collapsible">
              <SidebarGroupLabel
                asChild
                className="group/label text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground w-full text-sm"
              >
                <CollapsibleTrigger>
                  Schema Builder
                  <ChevronRight className="ml-auto transition-transform group-data-[state=open]/collapsible:rotate-90" />
                </CollapsibleTrigger>
              </SidebarGroupLabel>
              <CollapsibleContent>
                <SidebarGroupContent>
                  <div className="px-2 py-4">
                    <SchemaBuilder
                      fields={schemaFields}
                      onChange={isReadonly ? undefined : handleSchemaChange}
                      onGenerateTestData={handleGenerateInputData}
                      isGeneratingTestData={isGeneratingInputData}
                      hasApiKeys={!hasNoModels}
                      disabled={isReadonly}
                    />
                  </div>
                </SidebarGroupContent>
              </CollapsibleContent>
            </Collapsible>
          </SidebarGroup>
          <SidebarSeparator className="mx-0" />
        </Fragment>

        <Fragment key={2}>
          <SidebarGroup className="py-1">
            <Collapsible defaultOpen={false} className="group/collapsible">
              <SidebarGroupLabel
                asChild
                className="group/label text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground w-full text-sm"
              >
                <CollapsibleTrigger>
                  Generated Code
                  <ChevronRight className="ml-auto transition-transform group-data-[state=open]/collapsible:rotate-90" />
                </CollapsibleTrigger>
              </SidebarGroupLabel>
              <CollapsibleContent>
                <SidebarGroupContent>
                  <div className="px-2 py-4">
                    <CodePreview fields={schemaFields} />
                  </div>
                </SidebarGroupContent>
              </CollapsibleContent>
            </Collapsible>
          </SidebarGroup>
          <SidebarSeparator className="mx-0" />
        </Fragment>

        <Fragment key={3}>
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
                    <div className="space-y-1.5">
                      <Label className="text-xs">Input data</Label>
                      <div className="rounded-md border border-sidebar-border bg-sidebar/50 p-2 overflow-x-auto">
                        <JsonEditor
                          data={inputData ?? DEFAULT_INPUT_DATA}
                          setData={handleInputDataChange}
                          theme={jsonEditorTheme}
                          rootFontSize={11}
                          collapse={1}
                          showCollectionCount={true}
                          indent={2}
                          maxWidth="100%"
                          rootName={inputDataRootName ?? undefined}
                        />
                      </div>
                    </div>

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
                              !hasDraftVersion && publishedVersions.length === 0
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

                    {hasNoPromptRefs && (
                      <Item
                        variant="outline"
                        size="sm"
                        className="border-amber-500/40 bg-amber-500/5"
                      >
                        <ItemMedia
                          variant="icon"
                          className="border-amber-500/30 bg-amber-500/10"
                        >
                          <IconAlertTriangle className="size-4 text-amber-600 dark:text-amber-400" />
                        </ItemMedia>
                        <ItemContent>
                          <ItemDescription className="line-clamp-none text-amber-700 dark:text-amber-300">
                            No prompt references found. Use the prompt reference
                            button in the editor toolbar to insert prompt
                            references.
                          </ItemDescription>
                        </ItemContent>
                      </Item>
                    )}

                    <Button
                      className={cn(
                        'w-full font-medium transition-all duration-200',
                        isStreaming
                          ? 'bg-primary/80'
                          : 'bg-linear-to-r from-primary to-primary/90 hover:from-primary/95 hover:to-primary/85 shadow-sm hover:shadow-md',
                      )}
                      onClick={handleRunComposer}
                      disabled={isStreaming || hasNoPromptRefs}
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

                    <div className="pt-3">
                      <div className="text-xs font-medium text-sidebar-foreground mb-2 block">
                        Response
                      </div>
                      <ComposerStreamingResponse
                        segments={segments}
                        isStreaming={isStreaming}
                        isComplete={isComplete}
                        errors={streamErrors}
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
    </Sidebar>
  );
});

ComposerSidebarRight.displayName = 'ComposerSidebarRight';
