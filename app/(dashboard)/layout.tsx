import type { CSSProperties } from "react";
import { redirect } from "next/navigation";

import { AppSidebar } from "@/components/app-sidebar";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { createClient } from "@/lib/supabase/server";
import { getInboxBadgeCount } from "@/lib/data";

export default async function DashboardLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const inboxBadgeCount = await getInboxBadgeCount();

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": "11.75rem",
          "--sidebar-width-icon": "3.25rem",
        } as CSSProperties
      }
    >
      <AppSidebar
        inboxBadgeCount={inboxBadgeCount}
        userEmail={user.email ?? ""}
      />
      <SidebarInset className="overflow-hidden">
        {/* Mobile-only top bar */}
        <header className="flex h-12 shrink-0 items-center gap-2 border-b px-4 md:hidden">
          <SidebarTrigger />
          <span className="text-sm font-semibold">Seller Pipeline</span>
        </header>
        {/* Page content fills remaining height */}
        <div className="flex flex-1 flex-col overflow-hidden">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
