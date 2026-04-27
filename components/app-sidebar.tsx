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
  "--sidebar": "215 14% 13%",
  "--sidebar-foreground": "215 18% 82%",
  "--sidebar-border": "215 16% 19%",
  "--sidebar-accent": "160 35% 18%",
  "--sidebar-accent-foreground": "160 58% 73%",
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
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#16a37f] text-[10px] font-bold text-white shadow-sm">
            SP
          </div>
          <div className="flex flex-col leading-tight group-data-[collapsible=icon]:hidden">
            <span
              className="text-[10px] font-medium uppercase tracking-[0.18em]"
              style={{ color: "rgba(255,255,255,.3)", fontFamily: "var(--font-mono)" }}
            >
              CRM
            </span>
            <span className="text-[14px] font-semibold text-white/95">
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
                        "rounded-xl border border-transparent transition-all duration-[120ms]",
                        isActive
                          ? "!border-[rgba(94,234,212,.16)] !bg-[linear-gradient(180deg,rgba(22,163,127,.24),rgba(22,163,127,.12))] !text-[#ccfbf1] shadow-[inset_0_1px_0_rgba(255,255,255,.04)] hover:!bg-[linear-gradient(180deg,rgba(22,163,127,.28),rgba(22,163,127,.14))]"
                          : "!text-[rgba(255,255,255,.56)] hover:!border-[rgba(255,255,255,.05)] hover:!bg-[rgba(255,255,255,.045)] hover:!text-[rgba(255,255,255,.88)]"
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
        <div className="mb-1 flex items-center gap-2.5 rounded-xl px-2 py-2 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#16a37f] text-[10px] font-bold text-white shadow-sm">
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
                className="rounded-xl !text-[rgba(255,255,255,.56)] transition-all duration-[120ms] hover:!bg-[rgba(255,255,255,.045)] hover:!text-[rgba(255,255,255,.88)]"
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
