'use client';

import type { Icon } from '@tabler/icons-react';
import type * as React from 'react';
import { NavLink, useLocation } from 'react-router';

import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '~/components/ui/sidebar';
import { useSearchContext } from '~/context/search-context';

export const NavSecondary = ({
  items,
  ...props
}: {
  items: {
    title: string;
    url: string;
    icon: Icon;
  }[];
} & React.ComponentPropsWithoutRef<typeof SidebarGroup>) => {
  const location = useLocation();
  const currentSection = location.pathname.split('/').filter(Boolean)[0] || '';
  const { setOpen: setSearchOpen } = useSearchContext();

  return (
    <SidebarGroup {...props}>
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => {
            const isActive =
              item.url.slice(1).toLowerCase() === currentSection.toLowerCase();

            // Handle Search item specially
            if (item.title === 'Search') {
              return (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton onClick={() => setSearchOpen(true)}>
                    <item.icon />
                    <span>{item.title}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              );
            }

            return (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton asChild isActive={isActive}>
                  <NavLink to={item.url}>
                    <item.icon />
                    <span>{item.title}</span>
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
};
