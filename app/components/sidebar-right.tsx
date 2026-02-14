'use client';

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
import {
  useFetcher,
  useLocation,
  useParams,
  useSearchParams,
} from 'react-router';
import { toast } from 'sonner';
import { useDebouncedCallback } from 'use-debounce';
import { CodePreview } from '~/components/code-preview';
import { NoLlmApiKeysModal } from '~/components/no-llm-api-keys-modal';
import { OnboardingTestWatcher } from '~/components/onboarding/onboarding-test-watcher';
import { SchemaBuilder } from '~/components/schema-builder';
import { SelectScrollable } from '~/components/select-scrollable';
import { SidebarSlider } from '~/components/sidebar-slider';
import { StreamingResponse } from '~/components/streaming-response';
import { Button } from '~/components/ui/button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '~/components/ui/collapsible';
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
import { removeFieldsFromInputData } from '~/lib/input-data-utils';
import type { SchemaField } from '~/lib/schema-types';
import { cn } from '~/lib/utils';
import { useOnboardingStore } from '~/stores/onboarding-store';
import { usePromptEditorStore } from '~/stores/prompt-editor-store';

const DEFAULT_INPUT_DATA: unknown = {};

const sidebarLightTheme: Theme = {
  styles: {
    container: {
      backgroundColor: 'transparent',
      fontFamily: 'inherit',
    },
    property: 'oklch(0.554 0.046 257.417)', // muted-foreground
    bracket: 'oklch(0.704 0.04 256.788)', // ring color
    string: 'oklch(0.65 0.19 50)', // #ED7117 orange
    number: 'oklch(0.65 0.19 50)', // #ED7117 orange
    boolean: 'oklch(0.65 0.19 50)', // #ED7117 orange
    null: 'oklch(0.65 0.19 50)', // #ED7117 orange
    iconEdit: 'oklch(0.488 0.243 264.376)',
    iconDelete: 'oklch(0.577 0.245 27.325)', // destructive
    iconAdd: 'oklch(0.6 0.118 184.704)', // chart-2
    iconCopy: 'oklch(0.554 0.046 257.417)',
    iconOk: 'oklch(0.6 0.118 184.704)',
    iconCancel: 'oklch(0.577 0.245 27.325)',
    input: {
      backgroundColor: 'oklch(0.968 0.007 247.896)', // muted
      color: 'oklch(0.129 0.042 264.695)', // foreground
      border: '1px solid oklch(0.929 0.013 255.508)', // border
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
    property: 'lab(66.128% 0 0)', // muted-foreground (zinc)
    bracket: 'lab(48.496% 0 0)', // ring (zinc)
    string: 'lab(70% 45 65)', // warm orange (consistent with number)
    number: 'lab(70% 45 65)', // warm orange
    boolean: 'lab(70% 45 65)', // warm orange (consistent with number)
    null: 'lab(70% 45 65)', // warm orange (consistent with number)
    iconEdit: 'lab(36.9089% 35.0961 -85.6872)', // sidebar-primary (blue)
    iconDelete: 'lab(63.7053% 60.745 31.3109)', // destructive (red)
    iconAdd: 'lab(65% -35 30)', // chart-2 (teal)
    iconCopy: 'lab(66.128% 0 0)',
    iconOk: 'lab(65% -35 30)',
    iconCancel: 'lab(63.7053% 60.745 31.3109)',
    input: {
      backgroundColor: 'lab(15.204% 0 0)', // muted (zinc)
      color: 'lab(98.26% 0 0)', // foreground (zinc)
      border: '1px solid lab(100% 0 0 / 15%)', // input (zinc)
      borderRadius: '0.375rem',
      padding: '0.25rem 0.5rem',
      fontSize: '0.75rem',
    },
  },
};

export interface SidebarRightHandle {
  triggerTest: () => void;
  isStreaming: boolean;
}

type SidebarRightProps = React.ComponentProps<typeof Sidebar> & {
  versions?: Version[];
  schema?: SchemaField[];
  model?: string | null;
  temperature?: number;
  inputData?: unknown;
  inputDataRootName?: string | null;
  isReadonly?: boolean;
};

export const SidebarRight = forwardRef<SidebarRightHandle, SidebarRightProps>(
  ({ versions = [], isReadonly = false, ...props }, ref) => {
    const isOnboardingActive = useOnboardingStore((s) => s.isActive);
    const enabledModels = useEnabledModels();
    const [showNoApiKeysModal, setShowNoApiKeysModal] = useState(false);

    // Get state from the store
    const schemaFields = usePromptEditorStore((state) => state.schemaFields);
    const model = usePromptEditorStore((state) => state.model);
    const temperature = usePromptEditorStore((state) => state.temperature);
    const inputData = usePromptEditorStore((state) => state.inputData);
    const inputDataRootName = usePromptEditorStore(
      (state) => state.inputDataRootName,
    );
    const testModel = usePromptEditorStore((state) => state.testModel);
    const testTemperature = usePromptEditorStore(
      (state) => state.testTemperature,
    );
    const testVersionOverride = usePromptEditorStore(
      (state) => state.testVersionOverride,
    );

    // Get actions from the store
    const setSchemaFields = usePromptEditorStore(
      (state) => state.setSchemaFields,
    );
    const setModel = usePromptEditorStore((state) => state.setModel);
    const setTemperature = usePromptEditorStore(
      (state) => state.setTemperature,
    );
    const setInputData = usePromptEditorStore((state) => state.setInputData);
    const setTestModel = usePromptEditorStore((state) => state.setTestModel);
    const setTestTemperature = usePromptEditorStore(
      (state) => state.setTestTemperature,
    );
    const setTestVersionOverride = usePromptEditorStore(
      (state) => state.setTestVersionOverride,
    );
    const setLastOutputTokens = usePromptEditorStore(
      (state) => state.setLastOutputTokens,
    );
    const setLastSystemInputTokens = usePromptEditorStore(
      (state) => state.setLastSystemInputTokens,
    );
    const setLastUserInputTokens = usePromptEditorStore(
      (state) => state.setLastUserInputTokens,
    );

    const [isGeneratingInputData, setIsGeneratingInputData] = useState(false);

    // Test section open state and ref for external control
    const [testOpen, setTestOpen] = useState(true);
    const testSectionRef = useRef<HTMLDivElement>(null);

    const configFetcher = useFetcher();
    const location = useLocation();
    const [searchParams] = useSearchParams();
    const params = useParams();
    const isMobile = useIsMobile();

    // Streaming response state
    const [streamText, setStreamText] = useState('');
    const [isStreaming, setIsStreaming] = useState(false);
    const [isComplete, setIsComplete] = useState(false);
    const [streamError, setStreamError] = useState<string | null>(null);

    // Check if test config differs from main config
    const hasTestConfigChanges =
      testModel !== model || testTemperature !== temperature;

    const debouncedSaveConfig = useDebouncedCallback(() => {
      const state = usePromptEditorStore.getState();
      const config = {
        schema: state.schemaFields,
        model: state.model,
        temperature: state.temperature,
        inputData: state.inputData,
        inputDataRootName: state.inputDataRootName,
      };
      configFetcher.submit(
        { intent: 'saveConfig', config: JSON.stringify(config) },
        { method: 'post', action: location.pathname },
      );
    }, 1000);

    // Generate input data for the current schema
    const handleGenerateInputData = useCallback(async () => {
      if (schemaFields.length === 0) return;

      setIsGeneratingInputData(true);
      try {
        const response = await fetch('/api/generate-input-data', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ schema: schemaFields }),
        });

        if (response.ok) {
          const result = (await response.json()) as {
            inputData?: unknown;
            rootName?: string | null;
          };
          if (result.inputData !== undefined) {
            setInputData(result.inputData, result.rootName ?? null);
            debouncedSaveConfig();
          }
        }
      } catch (error) {
        console.error('Failed to generate input data:', error);
      } finally {
        setIsGeneratingInputData(false);
      }
    }, [schemaFields, debouncedSaveConfig, setInputData]);

    const handleSchemaChange = useCallback(
      (fields: SchemaField[]) => {
        setSchemaFields(fields);
        debouncedSaveConfig();
      },
      [debouncedSaveConfig, setSchemaFields],
    );

    const handleModelChange = useCallback(
      (value: string | null) => {
        setModel(value);
        debouncedSaveConfig();
      },
      [debouncedSaveConfig, setModel],
    );

    const handleTemperatureChange = useCallback(
      (value: number) => {
        setTemperature(value);
        debouncedSaveConfig();
      },
      [debouncedSaveConfig, setTemperature],
    );

    const handleInputDataChange = useCallback(
      (value: unknown) => {
        setInputData(value);
        debouncedSaveConfig();
      },
      [debouncedSaveConfig, setInputData],
    );

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

    // Allow test panel to override version selection
    const testVersionToUse = testVersionOverride ?? selectedVersion;

    const handleRemoveUnusedFields = useCallback(
      (fields: string[]) => {
        const newSchema = schemaFields.filter((f) => !fields.includes(f.name));
        setSchemaFields(newSchema);

        const result = removeFieldsFromInputData(
          { inputData, inputDataRootName },
          fields,
        );

        setInputData(result.inputData, result.inputDataRootName);
        debouncedSaveConfig();
      },
      [
        schemaFields,
        inputData,
        inputDataRootName,
        debouncedSaveConfig,
        setSchemaFields,
        setInputData,
      ],
    );

    // Show toast for unused fields with option to remove them
    const showUnusedFieldsToast = useCallback(
      (fields: string[]) => {
        const fieldList = fields.join(' and ');
        toast.warning('Unused fields', {
          description: `${fieldList} data fields were not referenced in the prompts.`,
          action: {
            label: 'Remove',
            onClick: () => handleRemoveUnusedFields(fields),
          },
        });
      },
      [handleRemoveUnusedFields],
    );

    // Handle running the prompt
    const handleRunPrompt = useCallback(async () => {
      const { promptId } = params;
      if (!promptId) return;

      // Check if user has LLM API keys configured (skip during onboarding)
      if (!isOnboardingActive && enabledModels.length === 0) {
        setShowNoApiKeysModal(true);
        return;
      }

      setStreamText('');
      setIsStreaming(true);
      setIsComplete(false);
      setStreamError(null);

      try {
        const formData = new FormData();
        formData.append('promptId', promptId);
        formData.append('model', testModel || 'anthropic/claude-haiku-4.5');
        formData.append(
          'temperature',
          (testTemperature ?? temperature).toString(),
        );
        formData.append('inputData', JSON.stringify(inputData));
        formData.append('inputDataRootName', inputDataRootName || '');
        if (testVersionToUse) {
          formData.append('version', testVersionToUse);
        }

        const response = await fetch('/api/prompts/run', {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
          const errorData = (await response.json().catch(() => ({}))) as {
            error?: string;
          };
          throw new Error(errorData.error || `HTTP ${response.status}`);
        }

        // Check for unused fields header before consuming the body
        const unusedFieldsHeader = response.headers.get('X-Unused-Fields');
        if (unusedFieldsHeader) {
          try {
            const unusedFields = JSON.parse(unusedFieldsHeader) as string[];
            if (unusedFields.length > 0) {
              showUnusedFieldsToast(unusedFields);
            }
          } catch {
            // Ignore malformed header
          }
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

        // Check if the stream contained an error from the server
        const errorMatch = fullText.match(/\[Error:\s*(.+)\]$/);
        if (errorMatch) {
          setStreamText('');
          throw new Error(errorMatch[1]);
        }

        setIsComplete(true);

        // Fetch the accurate token counts from the server
        // The server stores this via waitUntil() so it should be available now
        try {
          const usageParams = new URLSearchParams({ promptId });
          if (testVersionToUse) {
            usageParams.set('version', testVersionToUse);
          }
          const usageRes = await fetch(
            `/api/prompts/usage?${usageParams.toString()}`,
          );
          if (usageRes.ok) {
            const usageData = (await usageRes.json()) as {
              outputTokens?: number | null;
              systemInputTokens?: number | null;
              userInputTokens?: number | null;
            };
            if (usageData.outputTokens != null) {
              setLastOutputTokens(usageData.outputTokens);
            }
            if (usageData.systemInputTokens != null) {
              setLastSystemInputTokens(usageData.systemInputTokens);
            }
            if (usageData.userInputTokens != null) {
              setLastUserInputTokens(usageData.userInputTokens);
            }
          }
        } catch {
          // Ignore usage fetch errors - not critical
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
      isOnboardingActive,
      enabledModels,
      testModel,
      testTemperature,
      temperature,
      inputData,
      inputDataRootName,
      testVersionToUse,
      showUnusedFieldsToast,
      setLastOutputTokens,
      setLastSystemInputTokens,
      setLastUserInputTokens,
    ]);

    // Trigger test from external source (e.g., PromptReview)
    const triggerTest = useCallback(() => {
      setTestOpen(true);
      testSectionRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
      // Small delay to ensure collapsible is open before running
      setTimeout(handleRunPrompt, 100);
    }, [handleRunPrompt]);

    // Expose ref API for external control
    useImperativeHandle(
      ref,
      () => ({
        triggerTest,
        isStreaming,
      }),
      [triggerTest, isStreaming],
    );

    // Save test config to main config and DB
    const handleSaveTestConfig = useCallback(() => {
      setModel(testModel);
      setTemperature(testTemperature ?? temperature);

      // Save to DB
      const state = usePromptEditorStore.getState();
      const config = {
        schema: state.schemaFields,
        model: testModel,
        temperature: testTemperature ?? temperature,
        inputData: state.inputData,
        inputDataRootName: state.inputDataRootName,
      };
      configFetcher.submit(
        { intent: 'saveConfig', config: JSON.stringify(config) },
        { method: 'post', action: location.pathname },
      );
    }, [
      testModel,
      testTemperature,
      temperature,
      configFetcher,
      location.pathname,
      setModel,
      setTemperature,
    ]);

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
            <SidebarGroup key="key" className="py-1">
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
            <SidebarGroup key="key" className="py-1">
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
                        disabled={isReadonly}
                      />
                    </div>
                  </SidebarGroupContent>
                </CollapsibleContent>
              </Collapsible>
            </SidebarGroup>
            <SidebarSeparator className="mx-0" />
          </Fragment>
          <Fragment key={1.5}>
            <SidebarGroup key="code-preview" className="py-1">
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
          <Fragment key={2}>
            <SidebarGroup key="key" className="py-0">
              <Collapsible defaultOpen={false} className="group/collapsible">
                <SidebarGroupLabel
                  asChild
                  className="group/label text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground w-full text-sm"
                >
                  <CollapsibleTrigger>
                    Output
                    <ChevronRight className="ml-auto transition-transform group-data-[state=open]/collapsible:rotate-90" />
                  </CollapsibleTrigger>
                </SidebarGroupLabel>
                <CollapsibleContent>
                  <SidebarGroupContent>
                    <div className="px-2 py-3">
                      <Select defaultValue="string">
                        <SelectTrigger className="w-full" disabled>
                          <SelectValue placeholder="Select output format" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectGroup>
                            <SelectLabel>Output Formats</SelectLabel>
                            <SelectItem value="string">String</SelectItem>
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                    </div>
                  </SidebarGroupContent>
                </CollapsibleContent>
              </Collapsible>
            </SidebarGroup>
            <SidebarSeparator className="mx-0" />
          </Fragment>
          <Fragment key={3}>
            <SidebarGroup key="key" className="py-0">
              <Collapsible defaultOpen={false} className="group/collapsible">
                <SidebarGroupLabel
                  asChild
                  className="group/label text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground w-full text-sm"
                >
                  <CollapsibleTrigger>
                    Model
                    <ChevronRight className="ml-auto transition-transform group-data-[state=open]/collapsible:rotate-90" />
                  </CollapsibleTrigger>
                </SidebarGroupLabel>
                <CollapsibleContent>
                  <SidebarGroupContent>
                    <div className="px-2 py-3">
                      <SelectScrollable
                        value={model ?? ''}
                        onChange={handleModelChange}
                        disabled={isReadonly}
                        enabledModels={
                          isOnboardingActive ? undefined : enabledModels
                        }
                      />
                    </div>
                  </SidebarGroupContent>
                </CollapsibleContent>
              </Collapsible>
            </SidebarGroup>
            <SidebarSeparator className="mx-0" />
          </Fragment>
          <Fragment key={4}>
            <SidebarGroup key="key" className="py-0">
              <Collapsible defaultOpen={false} className="group/collapsible">
                <SidebarGroupLabel
                  asChild
                  className="group/label text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground w-full text-sm"
                >
                  <CollapsibleTrigger>
                    Temperature
                    <ChevronRight className="ml-auto transition-transform group-data-[state=open]/collapsible:rotate-90" />
                  </CollapsibleTrigger>
                </SidebarGroupLabel>
                <CollapsibleContent>
                  <SidebarGroupContent>
                    <div className="px-2 py-3">
                      <SidebarSlider
                        value={temperature}
                        onChange={handleTemperatureChange}
                        disabled={isReadonly}
                      />
                    </div>
                  </SidebarGroupContent>
                </CollapsibleContent>
              </Collapsible>
            </SidebarGroup>
            <SidebarSeparator className="mx-0" />
          </Fragment>
          <Fragment key={5}>
            <SidebarGroup
              ref={testSectionRef}
              id="onboarding-test-section"
              key="test"
              className="py-0"
            >
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
                    <div className="flex flex-col gap-y-2">
                      <div className="px-2 py-3">
                        <div className="text-xs font-medium text-sidebar-foreground mb-2 block">
                          Input data
                        </div>
                        <div
                          className={cn(
                            'rounded-md border border-sidebar-border bg-sidebar/50 p-2 overflow-x-auto',
                            isOnboardingActive &&
                              'pointer-events-none opacity-60',
                          )}
                        >
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

                      <div className="px-2">
                        <div className="text-xs font-medium text-sidebar-foreground mb-2 block">
                          Model
                        </div>
                        <div className="my-4">
                          <SelectScrollable
                            value={testModel ?? ''}
                            onChange={setTestModel}
                            disabled={isOnboardingActive}
                            enabledModels={
                              isOnboardingActive ? undefined : enabledModels
                            }
                          />
                        </div>
                      </div>

                      <div className="px-2">
                        <div className="text-xs font-medium text-sidebar-foreground mb-2 block">
                          Prompt version
                        </div>
                        <div className="my-4">
                          <Select
                            value={testVersionToUse ?? ''}
                            onValueChange={setTestVersionOverride}
                            disabled={
                              isOnboardingActive ||
                              (!hasDraftVersion &&
                                publishedVersions.length === 0)
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
                      </div>

                      <div className="px-2">
                        <div className="text-xs font-medium text-sidebar-foreground mb-2 block">
                          Temperature
                        </div>
                        <div className="my-1">
                          <SidebarSlider
                            value={testTemperature ?? temperature}
                            onChange={setTestTemperature}
                            disabled={isOnboardingActive}
                          />
                        </div>
                      </div>

                      <div className="px-2 pt-4 flex flex-col gap-2">
                        <Button
                          id="onboarding-test-button"
                          className={cn(
                            'w-full font-medium transition-all duration-200',
                            isStreaming
                              ? 'bg-primary/80'
                              : 'bg-linear-to-r from-primary to-primary/90 hover:from-primary/95 hover:to-primary/85 shadow-sm hover:shadow-md',
                          )}
                          onClick={handleRunPrompt}
                          disabled={isStreaming}
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
                        <Button
                          variant="outline"
                          className="w-full"
                          onClick={handleSaveTestConfig}
                          disabled={
                            isOnboardingActive ||
                            !hasTestConfigChanges ||
                            configFetcher.state !== 'idle'
                          }
                        >
                          {configFetcher.state !== 'idle' ? (
                            <span className="flex items-center gap-2">
                              <span className="size-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                              Saving...
                            </span>
                          ) : (
                            'Save config'
                          )}
                        </Button>
                      </div>

                      <div
                        id="onboarding-test-response"
                        className="px-2 pt-6 pb-4"
                      >
                        <div className="text-xs font-medium text-sidebar-foreground mb-2 block">
                          Response
                        </div>
                        <StreamingResponse
                          text={streamText}
                          isStreaming={isStreaming}
                          isComplete={isComplete}
                          error={streamError}
                        />
                        <OnboardingTestWatcher
                          isComplete={isComplete}
                          isStreaming={isStreaming}
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

SidebarRight.displayName = 'SidebarRight';
