'use client';

import {
  IconCamera,
  IconChartBar,
  IconCreditCard,
  IconDashboard,
  IconDatabase,
  IconDotsVertical,
  IconFileAi,
  IconFileDescription,
  IconFileWord,
  IconFolder,
  IconHelp,
  IconLogout,
  IconNotification,
  IconReport,
  IconSearch,
  IconSettings,
  IconUserCircle,
  IconUsers,
} from '@tabler/icons-react';
import { JsonEditor, type Theme } from 'json-edit-react';
import { ChevronRight } from 'lucide-react';
import type * as React from 'react';
import { Fragment, useMemo, useState } from 'react';

import { CodePreview } from '~/components/code-preview';
import { NavUser } from '~/components/nav-user';
import { SchemaBuilder } from '~/components/schema-builder';
import { SelectScrollable } from '~/components/select-scrollable';
import { SidebarSlider } from '~/components/sidebar-slider';
import { Avatar, AvatarFallback, AvatarImage } from '~/components/ui/avatar';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '~/components/ui/collapsible';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '~/components/ui/dropdown-menu';
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
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
} from '~/components/ui/sidebar';
import { useIsMobile } from '~/hooks/use-mobile';
import type { SchemaField } from '~/lib/schema-types';

const data = {
  user: {
    name: 'Test Prompter',
    email: 'test@promptlycms.com',
    avatar: '/avatars/shadcn.jpg',
  },
  navMain: [
    {
      title: 'Dashboard',
      url: '#',
      icon: IconDashboard,
    },
    {
      title: 'Analytics',
      url: '#',
      icon: IconChartBar,
    },
    {
      title: 'Projects',
      url: '#',
      icon: IconFolder,
    },
    {
      title: 'Team',
      url: '#',
      icon: IconUsers,
    },
  ],
  navClouds: [
    {
      title: 'Capture',
      icon: IconCamera,
      isActive: true,
      url: '#',
      items: [
        {
          title: 'Active Proposals',
          url: '#',
        },
        {
          title: 'Archived',
          url: '#',
        },
      ],
    },
    {
      title: 'Proposal',
      icon: IconFileDescription,
      url: '#',
      items: [
        {
          title: 'Active Proposals',
          url: '#',
        },
        {
          title: 'Archived',
          url: '#',
        },
      ],
    },
    {
      title: 'Prompts',
      icon: IconFileAi,
      url: '#',
      items: [
        {
          title: 'Active Proposals',
          url: '#',
        },
        {
          title: 'Archived',
          url: '#',
        },
      ],
    },
  ],
  navSecondary: [
    {
      title: 'Settings',
      url: '#',
      icon: IconSettings,
    },
    {
      title: 'Get Help',
      url: '#',
      icon: IconHelp,
    },
    {
      title: 'Search',
      url: '#',
      icon: IconSearch,
    },
  ],
  documents: [
    {
      name: 'Data Library',
      url: '#',
      icon: IconDatabase,
    },
    {
      name: 'Reports',
      url: '#',
      icon: IconReport,
    },
    {
      name: 'Word Assistant',
      url: '#',
      icon: IconFileWord,
    },
  ],
};

const DEFAULT_INPUT_DATA = [
  'Brilliant service from start to finish. The team arrived on time, handled everything with care, and nothing was damaged. Would definitely recommend to anyone moving house.',
  'Good value for money but communication could have been better. Had to chase for updates on the delivery window. The movers themselves were friendly and efficient though.',
  'Absolutely terrible experience. Driver was two hours late with no apology, then tried to charge extra for stairs that were clearly listed in the booking. Avoid.',
];

// Custom theme that integrates with the sidebar's design system
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
  ...props
}: React.ComponentProps<typeof Sidebar>) {
  const [schemaFields, setSchemaFields] = useState<SchemaField[]>([]);
  const [inputData, setInputData] = useState<string[]>(DEFAULT_INPUT_DATA);

  const isMobile = useIsMobile();

  // Memoized theme selection based on document dark class
  const jsonEditorTheme = useMemo(() => {
    const isDarkMode =
      typeof document !== 'undefined' &&
      document.documentElement.classList.contains('dark');
    return isDarkMode ? sidebarDarkTheme : sidebarLightTheme;
  }, []);

  return (
    <Sidebar
      collapsible="none"
      className="sticky top-0 hidden h-full w-full border-l lg:flex"
      {...props}
    >
      <SidebarHeader className="border-sidebar-border h-16 border-b">
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton
                  size="lg"
                  className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                >
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-medium">Reviews</span>
                    <span className="text-muted-foreground truncate text-xs">
                      Version: 0.1.0
                    </span>
                  </div>
                  <IconDotsVertical className="ml-auto size-4" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
                side={isMobile ? 'bottom' : 'right'}
                align="end"
                sideOffset={4}
              >
                <DropdownMenuLabel className="p-0 font-normal">
                  <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                    <div className="grid flex-1 text-left text-sm leading-tight">
                      <span className="truncate font-medium">Reviews</span>
                      <span className="text-muted-foreground truncate text-xs">
                        Version: 0.1.0
                      </span>
                    </div>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                  <DropdownMenuItem>
                    <IconUserCircle />
                    Account
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <IconCreditCard />
                    Billing
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <IconNotification />
                    Notifications
                  </DropdownMenuItem>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuItem>
                  <IconLogout />
                  Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
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
