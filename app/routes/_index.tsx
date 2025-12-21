import { AppSidebar } from '~/components/app-sidebar';
import { SiteHeader } from '~/components/site-header';
import { Folder } from '~/components/ui/folder';
import { SidebarInset, SidebarProvider } from '~/components/ui/sidebar';
import type { Route } from './+types/home';

// biome-ignore lint/correctness/noEmptyPattern: react router default
export function meta({}: Route.MetaArgs) {
  return [
    { title: 'Promptly' },
    {
      name: 'description',
      content:
        'The modern CMS for high performing teams to ship effective AI products at speed',
    },
  ];
}

export default function Home() {
  return (
    <SidebarProvider
      style={
        {
          '--sidebar-width': 'calc(var(--spacing) * 72)',
          '--header-height': 'calc(var(--spacing) * 12)',
        } as React.CSSProperties
      }
    >
      <AppSidebar variant="inset" />
      <SidebarInset>
        <SiteHeader title="Library" />
        <div className="flex flex-1 flex-col">
          <div className="@container/main flex flex-1 flex-col gap-2">
            <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
              <div className="px-4 lg:px-6">
                <div className="font-semibold text-gray-500/75 mb-4">
                  Folders
                </div>
                <div className="flex flex-col">
                  <Folder />
                  <h4 className="w-48 text-center my-4">Reviews</h4>
                </div>
              </div>
            </div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
