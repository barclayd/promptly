'use client';

import {
  type Icon,
  IconDots,
  IconFolder,
  IconShare3,
  IconTrash,
} from '@tabler/icons-react';
import { NavLink, useNavigate } from 'react-router';
import { toast } from 'sonner';
import { useRecentsContext } from '~/context/recents-context';

import { Badge } from '~/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '~/components/ui/dropdown-menu';
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '~/components/ui/sidebar';

export interface NavDocumentItem {
  promptId: string;
  name: string;
  url: string;
  icon: Icon;
  folderName?: string;
  version?: string | null;
}

export const NavDocuments = ({ items }: { items: NavDocumentItem[] }) => {
  const { isMobile } = useSidebar();
  const navigate = useNavigate();
  const { removeRecent } = useRecentsContext();

  const handleOpen = (url: string) => {
    navigate(url);
  };

  const handleShare = async (url: string) => {
    const fullUrl = `${window.location.origin}${url}`;
    await navigator.clipboard.writeText(fullUrl);
    toast.success('Link copied to clipboard', { position: 'bottom-center' });
  };

  const handleDelete = (promptId: string, name: string) => {
    removeRecent(promptId);
    toast.success(`Removed "${name}" from recents`, { position: 'bottom-center' });
  };

  if (items.length === 0) {
    return null;
  }

  return (
    <SidebarGroup className="group-data-[collapsible=icon]:hidden">
      <SidebarGroupLabel>Recents</SidebarGroupLabel>
      <SidebarMenu>
        {items.map((item) => (
          <SidebarMenuItem key={item.url}>
            <SidebarMenuButton asChild className="h-auto py-2">
              <NavLink to={item.url}>
                <item.icon className="shrink-0" />
                <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate font-medium text-sm">
                      {item.name}
                    </span>
                    {item.version && (
                      <Badge className="h-4 px-1.5 text-[10px] font-mono shrink-0">
                        v{item.version}
                      </Badge>
                    )}
                  </div>
                  {item.folderName && item.folderName !== 'Untitled' && (
                    <span className="text-[11px] text-sidebar-foreground/50 truncate">
                      {item.folderName}
                    </span>
                  )}
                </div>
              </NavLink>
            </SidebarMenuButton>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuAction
                  showOnHover
                  className="data-[state=open]:bg-accent rounded-sm"
                >
                  <IconDots />
                  <span className="sr-only">More</span>
                </SidebarMenuAction>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="w-24 rounded-lg"
                side={isMobile ? 'bottom' : 'right'}
                align={isMobile ? 'end' : 'start'}
              >
                <DropdownMenuItem onClick={() => handleOpen(item.url)}>
                  <IconFolder />
                  <span>Open</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleShare(item.url)}>
                  <IconShare3 />
                  <span>Share</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  variant="destructive"
                  onClick={() => handleDelete(item.promptId, item.name)}
                >
                  <IconTrash />
                  <span>Delete</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        ))}
      </SidebarMenu>
    </SidebarGroup>
  );
};
