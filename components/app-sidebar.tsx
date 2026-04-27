"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  PanelsTopLeft,
  Users,
  MessageSquare,
  LogOut,
} from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import { signOut } from "@/app/actions";

const sidebarStyle = {
  "--sidebar": "220 14% 10%",
  "--sidebar-foreground": "215 12% 68%",
  "--sidebar-border": "220 14% 17%",
  "--sidebar-accent": "220 14% 15%",
  "--sidebar-accent-foreground": "215 12% 90%",
  "--sidebar-ring": "162 44% 55%",
} as React.CSSProperties;

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/pipeline", label: "Pipeline", icon: PanelsTopLeft },
  { href: "/leads", label: "Leads", icon: Users },
  { href: "/inbox", label: "Inbox", icon: MessageSquare },
];

interface AppSidebarProps {
  inboxBadgeCount?: number;
  userEmail?: string;
}

export function AppSidebar({
  inboxBadgeCount = 0,
  userEmail = "",
}: AppSidebarProps) {
  const pathname = usePathname();

  const initials = userEmail
    ? userEmail
        .split("@")[0]
        .split(/[._-]/)
        .slice(0, 2)
        .map((s) => s[0]?.toUpperCase() ?? "")
        .join("")
        .slice(0, 2) || "SP"
    : "SP";

  return (
    <Sidebar collapsible="icon" style={sidebarStyle} className="border-r border-[#1e2230]">
      {/* Logo */}
      <SidebarHeader className="px-3 py-4">
        <div className="flex items-center gap-2.5 group-data-[collapsible=icon]:justify-center">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[#16a37f] text-[10px] font-bold text-white">
            SP
          </div>
          <span className="text-[13px] font-semibold text-white/85 group-data-[collapsible=icon]:hidden">
            Seller Pipeline
          </span>
        </div>
      </SidebarHeader>

      <SidebarSeparator className="bg-[#1e2230]" />

      {/* Navigation */}
      <SidebarContent>
        <SidebarGroup className="px-2 py-2">
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map(({ href, label, icon: Icon }) => {
                const isActive =
                  pathname === href || pathname.startsWith(href + "/");
                const showBadge =
                  label === "Inbox" && inboxBadgeCount > 0;

                return (
                  <SidebarMenuItem key={href}>
                    <SidebarMenuButton
                      render={<Link href={href} />}
                      isActive={isActive}
                      tooltip={label}
                      className={cn(
                        "rounded-md border border-transparent px-2.5 py-1 transition-colors duration-100",
                        isActive
                          ? "!border-[rgba(22,163,127,.15)] !bg-[rgba(255,255,255,.07)] !text-white"
                          : "!text-[rgba(255,255,255,.48)] hover:!bg-[rgba(255,255,255,.04)] hover:!text-[rgba(255,255,255,.78)]"
                      )}
                    >
                      <Icon size={14} strokeWidth={1.6} className="shrink-0" />
                      <span className="flex-1 text-[13px]">{label}</span>
                      {showBadge && (
                        <span className="rounded-full bg-red-500 px-1.5 py-0.5 text-[9px] font-bold leading-none text-white group-data-[collapsible=icon]:hidden">
                          {inboxBadgeCount > 99 ? "99+" : inboxBadgeCount}
                        </span>
                      )}
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarSeparator className="bg-[#1e2230]" />

      {/* Footer */}
      <SidebarFooter className="px-2 py-3">
        <div className="mb-1 flex items-center gap-2 px-2.5 py-1.5 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0">
          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#16a37f] text-[9px] font-bold text-white">
            {initials}
          </div>
          <span className="truncate max-w-[110px] text-[11px] text-[rgba(255,255,255,.42)] group-data-[collapsible=icon]:hidden">
            {userEmail || "User"}
          </span>
        </div>

        <SidebarMenu>
          <SidebarMenuItem>
            <form action={signOut} className="w-full">
              <SidebarMenuButton
                render={<button type="submit" className="w-full" />}
                tooltip="Sign out"
                className="rounded-md px-2.5 py-1 !text-[rgba(255,255,255,.38)] transition-colors duration-100 hover:!bg-[rgba(255,255,255,.04)] hover:!text-[rgba(255,255,255,.68)]"
              >
                <LogOut size={13} strokeWidth={1.6} />
                <span className="text-[13px]">Sign out</span>
              </SidebarMenuButton>
            </form>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
