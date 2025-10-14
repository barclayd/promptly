import type { Route } from "./+types/home";
import { SidebarProvider, SidebarTrigger } from "~/components/ui/sidebar"
import { AppSidebar } from '~/components/app-sidebar.tsx';

export function meta({}: Route.MetaArgs) {
  return [
    { title: "New React Router App" },
    { name: "description", content: "Welcome to React Router!" },
  ];
}

export function ServerComponent() {
  return (<SidebarProvider>
    <AppSidebar />
    <main>
      <SidebarTrigger />
      {/*{children}*/}
    </main>
  </SidebarProvider>);
}
