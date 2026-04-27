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

// CSS variable overrides for the dark sidebar
const sidebarStyle = {
  "--sidebar": "0 0% 8%",
  "--sidebar-foreground": "0 0% 45%",
  "--sidebar-border": "0 0% 11%",
  "--sidebar-accent": "162 30% 13%",
  "--sidebar-accent-foreground": "162 44% 55%",
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
    <Sidebar collapsible="icon" style={sidebarStyle}>
      {/* ── Logo ──────────────────────────────────────────────── */}
      <SidebarHeader className="px-4 py-5">
        <div className="flex items-center gap-3 group-data-[collapsible=icon]:justify-center">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#16a37f] text-[10px] font-bold text-white">
            SP
          </div>
          <div className="flex flex-col leading-tight group-data-[collapsible=icon]:hidden">
            <span
              className="text-[10px] font-medium uppercase tracking-[0.18em]"
              style={{ color: "rgba(255,255,255,.3)", fontFamily: "var(--font-mono)" }}
            >
              CRM
            </span>
            <span className="text-[14px] font-semibold text-white">
              Seller Pipeline
            </span>
          </div>
        </div>
      </SidebarHeader>

      <SidebarSeparator className="bg-[rgba(255,255,255,.06)]" />

      {/* ── Navigation ────────────────────────────────────────── */}
      <SidebarContent>
        <SidebarGroup className="px-2 py-3">
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
                        "rounded-[9px] transition-all duration-[120ms]",
                        isActive
                          ? "!bg-[rgba(22,163,127,.15)] !text-[#4ecba8] hover:!bg-[rgba(22,163,127,.18)]"
                          : "!text-[rgba(255,255,255,.42)] hover:!bg-[rgba(255,255,255,.04)] hover:!text-[rgba(255,255,255,.75)]"
                      )}
                    >
                      <Icon size={14} strokeWidth={1.7} className="shrink-0" />
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

      <SidebarSeparator className="bg-[rgba(255,255,255,.06)]" />

      {/* ── Footer: user + sign out ────────────────────────────── */}
      <SidebarFooter className="px-2 py-3">
        {/* User avatar row */}
        <div className="mb-1 flex items-center gap-2.5 rounded-[9px] px-2 py-2 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#16a37f] text-[10px] font-bold text-white">
            {initials}
          </div>
          <div className="flex flex-col leading-tight group-data-[collapsible=icon]:hidden">
            <span className="text-[12px] font-medium text-[rgba(255,255,255,.75)] truncate max-w-[120px]">
              {userEmail || "User"}
            </span>
            <span
              className="text-[10px]"
              style={{ color: "rgba(255,255,255,.3)" }}
            >
              Real Estate CRM
            </span>
          </div>
        </div>

        {/* Sign out */}
        <SidebarMenu>
          <SidebarMenuItem>
            <form action={signOut} className="w-full">
              <SidebarMenuButton
                render={<button type="submit" className="w-full" />}
                tooltip="Sign out"
                className="!text-[rgba(255,255,255,.42)] hover:!bg-[rgba(255,255,255,.04)] hover:!text-[rgba(255,255,255,.75)] rounded-[9px] transition-all duration-[120ms]"
              >
                <LogOut size={14} strokeWidth={1.7} />
                <span className="text-[13px]">Sign out</span>
              </SidebarMenuButton>
            </form>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
