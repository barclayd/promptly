'use client';

import {
  IconCamera,
  IconChartBar,
  IconFileAi,
  IconFileDescription,
  IconFileText,
  IconFolder,
  IconHelp,
  IconInnerShadowTop,
  IconSearch,
  IconSettings,
  IconUsers,
} from '@tabler/icons-react';
import type * as React from 'react';
import { NavLink, useRouteLoaderData } from 'react-router';
import { NavDocuments } from '~/components/nav-documents';
import { NavMain } from '~/components/nav-main';
import { NavSecondary } from '~/components/nav-secondary';
import { NavUser } from '~/components/nav-user';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '~/components/ui/sidebar';
import { useRecentsContext } from '~/context/recents-context';
import type { loader as rootLoader } from '~/root';

const data = {
  navMain: [
    {
      title: 'Analytics',
      url: '/analytics',
      icon: IconChartBar,
    },
    {
      title: 'Prompts',
      url: '/prompts',
      icon: IconFolder,
    },
    {
      title: 'Team',
      url: '/team',
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
      url: '/settings',
      icon: IconSettings,
    },
    {
      title: 'Help',
      url: '#',
      icon: IconHelp,
    },
    {
      title: 'Search',
      url: '#',
      icon: IconSearch,
    },
  ],
};

export const SidebarLeft = ({
  ...props
}: React.ComponentProps<typeof Sidebar>) => {
  const rootData = useRouteLoaderData<typeof rootLoader>('root');
  const { recents } = useRecentsContext();

  const user = {
    name: rootData?.user?.name ?? 'Guest',
    email: rootData?.user?.email ?? '',
    avatar: rootData?.user?.image ?? '/avatars/shadcn.jpg',
  };

  // Transform recents to NavDocuments format
  const recentItems = recents.map((r) => ({
    promptId: r.promptId,
    name: r.promptName,
    url: r.url,
    icon: IconFileText,
    folderName: r.folderName,
    version: r.version,
  }));

  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              className="data-[slot=sidebar-menu-button]:!p-1.5"
            >
              <NavLink to="/dashboard">
                <IconInnerShadowTop className="!size-5" />
                <span className="text-base font-semibold">Promptly</span>
              </NavLink>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={data.navMain} />
        {recentItems.length > 0 && <NavDocuments items={recentItems} />}
        <NavSecondary items={data.navSecondary} className="mt-auto" />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={user} />
      </SidebarFooter>
    </Sidebar>
  );
};
