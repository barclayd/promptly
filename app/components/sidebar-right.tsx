'use client';

import { IconCornerDownLeft } from '@tabler/icons-react';
import { JsonEditor, type Theme } from 'json-edit-react';
import { ChevronRight } from 'lucide-react';
import type * as React from 'react';
import { Fragment, useMemo, useState } from 'react';
import { useFetcher, useLocation } from 'react-router';
import { CodePreview } from '~/components/code-preview';
import { SchemaBuilder } from '~/components/schema-builder';
import { SelectScrollable } from '~/components/select-scrollable';
import { SidebarSlider } from '~/components/sidebar-slider';
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
import type { SchemaField } from '~/lib/schema-types';
import { cn } from '~/lib/utils';

const DEFAULT_INPUT_DATA = [
  'Brilliant service from start to finish. The team arrived on time, handled everything with care, and nothing was damaged. Would definitely recommend to anyone moving house.',
  'Good value for money but communication could have been better. Had to chase for updates on the delivery window. The movers themselves were friendly and efficient though.',
  'Absolutely terrible experience. Driver was two hours late with no apology, then tried to charge extra for stairs that were clearly listed in the booking. Avoid.',
];

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

export function SidebarRight({
  versions = [],
  schema = [],
  ...props
}: React.ComponentProps<typeof Sidebar> & {
  versions?: Version[];
  schema?: SchemaField[];
}) {
  const [initialSchema] = useState(schema);
  const [schemaFields, setSchemaFields] = useState<SchemaField[]>(schema);
  const [inputData, setInputData] = useState<string[]>(DEFAULT_INPUT_DATA);

  const schemaFetcher = useFetcher();
  const location = useLocation();
  const isMobile = useIsMobile();

  const isSchemaChanged =
    JSON.stringify(schemaFields) !== JSON.stringify(initialSchema);
  const isSchemaSaving = schemaFetcher.state !== 'idle';

  const handleSaveSchema = () => {
    schemaFetcher.submit(
      { intent: 'saveSchema', schema: JSON.stringify(schemaFields) },
      { method: 'post', action: location.pathname },
    );
  };

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
        'flex w-full',
        isMobile
          ? 'relative border-t bg-sidebar'
          : 'absolute inset-0 h-full border-l',
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
            <Collapsible defaultOpen={true} className="group/collapsible">
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
                      onChange={setSchemaFields}
                      onSave={handleSaveSchema}
                      isDirty={isSchemaChanged}
                      isSaving={isSchemaSaving}
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
                  <SidebarMenu>
                    <SidebarMenuItem key={1}>
                      <Select defaultValue="string">
                        <SelectTrigger className="w-[280px]" disabled>
                          <SelectValue placeholder="Select output format" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectGroup>
                            <SelectLabel>Output Formats</SelectLabel>
                            <SelectItem value="string">String</SelectItem>
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                    </SidebarMenuItem>
                  </SidebarMenu>
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
                  <SidebarMenu>
                    <SidebarMenuItem key={3} className="my-4">
                      <SelectScrollable />
                    </SidebarMenuItem>
                  </SidebarMenu>
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
                  <div className="px-3 pb-4">
                    <SidebarSlider />
                  </div>
                </SidebarGroupContent>
              </CollapsibleContent>
            </Collapsible>
          </SidebarGroup>
          <SidebarSeparator className="mx-0" />
        </Fragment>
        <Fragment key={5}>
          <SidebarGroup key="test" className="py-0">
            <Collapsible defaultOpen={true} className="group/collapsible">
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
                          setData={setInputData}
                          theme={jsonEditorTheme}
                          rootFontSize={11}
                          collapse={1}
                          showCollectionCount={true}
                          indent={2}
                          maxWidth="100%"
                        />
                      </div>
                    </div>

                    <div className="px-2">
                      <div className="text-xs font-medium text-sidebar-foreground mb-2 block">
                        Model
                      </div>
                      <div className="my-4">
                        <SelectScrollable />
                      </div>
                    </div>

                    <div className="px-2">
                      <div className="text-xs font-medium text-sidebar-foreground mb-2 block">
                        Prompt version
                      </div>
                      <div className="my-4">
                        <SelectScrollable />
                      </div>
                    </div>

                    <div className="px-2">
                      <div className="text-xs font-medium text-sidebar-foreground mb-2 block">
                        Temperature
                      </div>
                      <div className="my-1">
                        <SidebarSlider />
                      </div>
                    </div>

                    <div className="px-2">
                      <div className="pt-4">
                        <Button className="cursor-pointer">
                          Run <IconCornerDownLeft />
                        </Button>
                      </div>
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
}
