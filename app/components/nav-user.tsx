'use client';

import {
  IconCreditCard,
  IconDeviceDesktop,
  IconDotsVertical,
  IconLogout,
  IconMoon,
  IconNotification,
  IconSparkles,
  IconSun,
  IconUserCircle,
} from '@tabler/icons-react';
import { useState } from 'react';
import { NavLink, useFetcher } from 'react-router';
import { Avatar, AvatarFallback, AvatarImage } from '~/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '~/components/ui/dropdown-menu';
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '~/components/ui/sidebar';
import { type ThemeValue, useTheme } from '~/hooks/use-dark-mode';
import { useSubscription } from '~/hooks/use-subscription';
import { UpgradeGateModal } from './upgrade-gate-modal';

const getUserInitials = (name: string) => {
  const initials = name.split(' ');
  return initials.map((initial) => initial[0]).join('');
};

export const NavUser = ({
  user,
}: {
  user: {
    name: string;
    email: string;
    avatar?: string;
  };
}) => {
  const { isMobile } = useSidebar();
  const fetcher = useFetcher();
  const { theme, isDark, setTheme } = useTheme();
  const { subscription } = useSubscription();
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  const showUpgrade =
    !subscription ||
    subscription.status === 'expired' ||
    subscription.status === 'canceled' ||
    subscription.status === 'trialing';

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <Avatar className="h-8 w-8 rounded-lg grayscale">
                <AvatarImage src={user.avatar} alt={user.name} />
                <AvatarFallback className="rounded-lg">
                  {getUserInitials(user.name)}
                </AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">{user.name}</span>
                <span className="text-muted-foreground truncate text-xs">
                  {user.email}
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
                <Avatar className="h-8 w-8 rounded-lg">
                  <AvatarImage src={user.avatar} alt={user.name} />
                  <AvatarFallback className="rounded-lg">
                    {getUserInitials(user.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">{user.name}</span>
                  <span className="text-muted-foreground truncate text-xs">
                    {user.email}
                  </span>
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {showUpgrade && (
              <>
                <DropdownMenuGroup>
                  <DropdownMenuItem
                    className="text-indigo-700 dark:text-indigo-300 [&_svg]:!text-indigo-500 dark:[&_svg]:!text-indigo-400"
                    onSelect={() => setShowUpgradeModal(true)}
                  >
                    <IconSparkles />
                    Upgrade to Pro
                  </DropdownMenuItem>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
              </>
            )}
            <DropdownMenuGroup>
              <DropdownMenuItem>
                <IconUserCircle />
                Account
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <NavLink to="/settings?tab=billing">
                  <IconCreditCard />
                  Billing
                </NavLink>
              </DropdownMenuItem>
              <DropdownMenuItem>
                <IconNotification />
                Notifications
              </DropdownMenuItem>
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  {isDark ? <IconSun /> : <IconMoon />}
                  Toggle Theme
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  <DropdownMenuRadioGroup
                    value={theme}
                    onValueChange={(value) => setTheme(value as ThemeValue)}
                  >
                    <DropdownMenuRadioItem value="light">
                      <IconSun className="mr-2 size-4" />
                      Light
                    </DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="dark">
                      <IconMoon className="mr-2 size-4" />
                      Dark
                    </DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="system">
                      <IconDeviceDesktop className="mr-2 size-4" />
                      System
                    </DropdownMenuRadioItem>
                  </DropdownMenuRadioGroup>
                </DropdownMenuSubContent>
              </DropdownMenuSub>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() =>
                fetcher.submit(null, { method: 'post', action: '/logout' })
              }
            >
              <IconLogout />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <UpgradeGateModal
          open={showUpgradeModal}
          onOpenChange={setShowUpgradeModal}
          resource="general"
        />
      </SidebarMenuItem>
    </SidebarMenu>
  );
};
