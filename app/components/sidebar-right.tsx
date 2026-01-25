'use client';

import { JsonEditor, type Theme } from 'json-edit-react';
import { ChevronRight } from 'lucide-react';
import type * as React from 'react';
import {
  Fragment,
  forwardRef,
  useCallback,
  useImperativeHandle,
  useMemo,
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
  SidebarMenu,
  SidebarMenuItem,
  SidebarSeparator,
} from '~/components/ui/sidebar';
import { type Version, VersionsTable } from '~/components/versions-table';
import { useIsMobile } from '~/hooks/use-mobile';
import { removeFieldsFromInputData } from '~/lib/input-data-utils';
import type { SchemaField } from '~/lib/schema-types';
import { cn } from '~/lib/utils';

const DEFAULT_INPUT_DATA: unknown = {};

const sidebarLightTheme: Theme = {
  container: {
    backgroundColor: 'transparent',
    fontFamily: 'inherit',
  },
  property: 'oklch(0.554 0.046 257.417)', // muted-foreground
  bracket: 'oklch(0.704 0.04 256.788)', // ring color
  string: 'oklch(0.208 0.042 265.755)', // primary
  number: 'oklch(0.646 0.222 41.116)', // chart-1
  boolean: 'oklch(0.6 0.118 184.704)', // chart-2
  null: 'oklch(0.554 0.046 257.417)', // muted-foreground
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
};

const sidebarDarkTheme: Theme = {
  container: {
    backgroundColor: 'transparent',
    fontFamily: 'inherit',
  },
  property: 'oklch(0.704 0.04 256.788)', // muted-foreground dark
  bracket: 'oklch(0.551 0.027 264.364)', // ring dark
  string: 'oklch(0.929 0.013 255.508)', // primary dark
  number: 'oklch(0.769 0.188 70.08)', // chart-3 dark
  boolean: 'oklch(0.696 0.17 162.48)', // chart-2 dark
  null: 'oklch(0.704 0.04 256.788)', // muted-foreground dark
  iconEdit: 'oklch(0.488 0.243 264.376)', // sidebar-primary dark
  iconDelete: 'oklch(0.704 0.191 22.216)', // destructive dark
  iconAdd: 'oklch(0.696 0.17 162.48)', // chart-2 dark
  iconCopy: 'oklch(0.704 0.04 256.788)',
  iconOk: 'oklch(0.696 0.17 162.48)',
  iconCancel: 'oklch(0.704 0.191 22.216)',
  input: {
    backgroundColor: 'oklch(0.279 0.041 260.031)', // muted dark
    color: 'oklch(0.984 0.003 247.858)', // foreground dark
    border: '1px solid oklch(1 0 0 / 15%)', // input dark
    borderRadius: '0.375rem',
    padding: '0.25rem 0.5rem',
    fontSize: '0.75rem',
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
  (
    {
      versions = [],
      schema = [],
      model: initialModel = null,
      temperature: initialTemperature = 0.5,
      inputData: initialInputData = DEFAULT_INPUT_DATA,
      inputDataRootName: initialRootName = null,
      isReadonly = false,
      ...props
    },
    ref,
  ) => {
    const [schemaFields, setSchemaFields] = useState<SchemaField[]>(schema);
    const [model, setModel] = useState<string | null>(initialModel);
    const [temperature, setTemperature] = useState(initialTemperature);
    const [inputData, setInputData] = useState<unknown>(initialInputData);
    const [inputDataRootName, setInputDataRootName] = useState<string | null>(
      initialRootName,
    );
    const [isGeneratingInputData, setIsGeneratingInputData] = useState(false);

    // Test section has its own model/temperature that can differ from main config
    const [testModel, setTestModel] = useState<string | null>(initialModel);
    const [testTemperature, setTestTemperature] = useState(initialTemperature);

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

    // Use refs to access current values in debounced callback
    const schemaRef = useRef(schemaFields);
    const modelRef = useRef(model);
    const temperatureRef = useRef(temperature);
    const inputDataRef = useRef(inputData);
    const inputDataRootNameRef = useRef(inputDataRootName);
    schemaRef.current = schemaFields;
    modelRef.current = model;
    temperatureRef.current = temperature;
    inputDataRef.current = inputData;
    inputDataRootNameRef.current = inputDataRootName;

    const debouncedSaveConfig = useDebouncedCallback(() => {
      const config = {
        schema: schemaRef.current,
        model: modelRef.current,
        temperature: temperatureRef.current,
        inputData: inputDataRef.current,
        inputDataRootName: inputDataRootNameRef.current,
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
          const result = await response.json();
          if (result.inputData !== undefined) {
            setInputData(result.inputData);
            setInputDataRootName(result.rootName ?? null);
            inputDataRef.current = result.inputData;
            inputDataRootNameRef.current = result.rootName ?? null;
            debouncedSaveConfig();
          }
        }
      } catch (error) {
        console.error('Failed to generate input data:', error);
      } finally {
        setIsGeneratingInputData(false);
      }
    }, [schemaFields, debouncedSaveConfig]);

    const handleSchemaChange = useCallback(
      (fields: SchemaField[]) => {
        setSchemaFields(fields);
        debouncedSaveConfig();
      },
      [debouncedSaveConfig],
    );

    const handleModelChange = useCallback(
      (value: string | null) => {
        setModel(value);
        debouncedSaveConfig();
      },
      [debouncedSaveConfig],
    );

    const handleTemperatureChange = useCallback(
      (value: number) => {
        setTemperature(value);
        debouncedSaveConfig();
      },
      [debouncedSaveConfig],
    );

    const handleInputDataChange = useCallback(
      (value: unknown) => {
        setInputData(value);
        debouncedSaveConfig();
      },
      [debouncedSaveConfig],
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

    const handleRemoveUnusedFields = useCallback(
      (fields: string[]) => {
        const newSchema = schemaFields.filter((f) => !fields.includes(f.name));
        setSchemaFields(newSchema);

        const result = removeFieldsFromInputData(
          { inputData, inputDataRootName },
          fields,
        );

        setInputData(result.inputData);
        setInputDataRootName(result.inputDataRootName);
        debouncedSaveConfig();
      },
      [schemaFields, inputData, inputDataRootName, debouncedSaveConfig],
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

      setStreamText('');
      setIsStreaming(true);
      setIsComplete(false);
      setStreamError(null);

      try {
        const formData = new FormData();
        formData.append('promptId', promptId);
        formData.append('model', testModel || 'anthropic/claude-haiku-4.5');
        formData.append('temperature', testTemperature.toString());
        formData.append('inputData', JSON.stringify(inputData));
        formData.append('inputDataRootName', inputDataRootName || '');
        if (selectedVersion) {
          formData.append('version', selectedVersion);
        }

        const response = await fetch('/api/prompts/run', {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
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

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          setStreamText((prev) => prev + chunk);
        }

        setIsComplete(true);
      } catch (err) {
        setStreamError(
          err instanceof Error ? err.message : 'An error occurred',
        );
      } finally {
        setIsStreaming(false);
      }
    }, [
      params,
      testModel,
      testTemperature,
      inputData,
      inputDataRootName,
      selectedVersion,
      showUnusedFieldsToast,
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
      setTemperature(testTemperature);

      // Save to DB
      const config = {
        schema: schemaRef.current,
        model: testModel,
        temperature: testTemperature,
        inputData: inputDataRef.current,
        inputDataRootName: inputDataRootNameRef.current,
      };
      configFetcher.submit(
        { intent: 'saveConfig', config: JSON.stringify(config) },
        { method: 'post', action: location.pathname },
      );
    }, [testModel, testTemperature, configFetcher, location.pathname]);

    const jsonEditorTheme = useMemo(() => {
      const isDarkMode =
        typeof document !== 'undefined' &&
        document.documentElement.classList.contains('dark');
      return isDarkMode ? sidebarDarkTheme : sidebarLightTheme;
    }, []);

    return (
      <Sidebar
        collapsible="none"
        className={cn(
          isMobile ? 'relative border-t bg-sidebar w-full' : 'border-l',
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
            <SidebarGroup ref={testSectionRef} key="test" className="py-0">
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
                        <div className="rounded-md border border-sidebar-border bg-sidebar/50 p-2 overflow-x-auto">
                          <JsonEditor
                            data={inputData}
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
                          />
                        </div>
                      </div>

                      <div className="px-2">
                        <div className="text-xs font-medium text-sidebar-foreground mb-2 block">
                          Prompt version
                        </div>
                        <div className="my-4">
                          <Select
                            value={selectedVersion ?? ''}
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
                      </div>

                      <div className="px-2">
                        <div className="text-xs font-medium text-sidebar-foreground mb-2 block">
                          Temperature
                        </div>
                        <div className="my-1">
                          <SidebarSlider
                            value={testTemperature}
                            onChange={setTestTemperature}
                          />
                        </div>
                      </div>

                      <div className="px-2 pt-4 flex flex-col gap-2">
                        <Button
                          className={cn(
                            'w-full font-medium transition-all duration-200',
                            isStreaming
                              ? 'bg-primary/80'
                              : 'bg-gradient-to-r from-primary to-primary/90 hover:from-primary/95 hover:to-primary/85 shadow-sm hover:shadow-md',
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

                      <div className="px-2 pt-6 pb-4">
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
      </Sidebar>
    );
  },
);

SidebarRight.displayName = 'SidebarRight';
