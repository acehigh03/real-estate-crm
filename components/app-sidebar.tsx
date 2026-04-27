"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  PanelsTopLeft,
  Search,
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
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import { signOut } from "@/app/actions";

const sidebarStyle = {
  "--sidebar": "220 18% 8%",
  "--sidebar-foreground": "220 10% 76%",
  "--sidebar-border": "220 18% 8%",
  "--sidebar-accent": "220 18% 13%",
  "--sidebar-accent-foreground": "0 0% 100%",
  "--sidebar-ring": "160 84% 39%",
} as React.CSSProperties;

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, badge: null },
  { href: "/pipeline", label: "Pipeline", icon: PanelsTopLeft, badge: null },
  { href: "/leads", label: "Leads", icon: Users, badge: null },
  { href: "/inbox", label: "Inbox", icon: MessageSquare, badge: "live" },
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
  const displayName =
    userEmail
      .split("@")[0]
      .split(/[._-]/)
      .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
      .join(" ") || "Senay";
  const initials =
    displayName
      .split(" ")
      .map((segment) => segment[0] ?? "")
      .join("")
      .slice(0, 2)
      .toUpperCase() || "SP";

  return (
    <Sidebar collapsible="icon" style={sidebarStyle} className="!border-r-0">
      <SidebarHeader className="px-3 py-4">
        <div className="flex items-start gap-2.5 group-data-[collapsible=icon]:justify-center">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-[#10b981] text-[11px] font-semibold text-white">
            SP
          </div>
          <div className="group-data-[collapsible=icon]:hidden">
            <p className="text-[13px] font-medium text-white">Seller Pipeline</p>
            <p className="mt-0.5 text-[11px] text-white/35">sellingmy.casa</p>
          </div>
        </div>

        <div className="mt-4 group-data-[collapsible=icon]:hidden">
          <div className="crm-dark-input flex items-center gap-2 px-2.5 py-2">
            <Search size={13} className="text-white/35" />
            <input
              readOnly
              value=""
              placeholder="Search"
              className="w-full bg-transparent text-xs outline-none placeholder:text-white/35"
            />
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup className="px-2 py-2">
          <SidebarGroupContent>
            <SidebarMenu className="gap-1">
              {navItems.map(({ href, label, icon: Icon, badge }) => {
                const isActive = pathname === href || pathname.startsWith(`${href}/`);
                const badgeText =
                  label === "Inbox"
                    ? inboxBadgeCount > 0
                      ? String(inboxBadgeCount)
                      : badge
                    : badge;

                return (
                  <SidebarMenuItem key={href}>
                    <SidebarMenuButton
                      render={<Link href={href} />}
                      isActive={isActive}
                      tooltip={label}
                      className={cn(
                        "rounded-md px-2.5 py-2 text-[13px] transition-colors",
                        isActive
                          ? "!bg-[rgba(255,255,255,0.10)] !text-white data-[active=true]:font-medium"
                          : "!text-white/62 hover:!bg-[rgba(255,255,255,0.06)] hover:!text-white"
                      )}
                    >
                      <Icon size={14} strokeWidth={1.7} className="shrink-0" />
                      <span className="flex-1">{label}</span>
                      {badgeText ? (
                        <span className="rounded-full bg-black/25 px-1.5 py-0.5 text-[10px] font-medium text-white/80 group-data-[collapsible=icon]:hidden">
                          {badgeText}
                        </span>
                      ) : null}
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="px-3 py-4">
        <div className="flex items-center gap-2.5 group-data-[collapsible=icon]:justify-center">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-[11px] font-medium text-white">
            {initials}
          </div>
          <div className="min-w-0 group-data-[collapsible=icon]:hidden">
            <div className="flex items-center gap-2">
              <p className="truncate text-[12px] font-medium text-white">{displayName}</p>
              <span className="rounded-full bg-white/10 px-1.5 py-0.5 text-[10px] text-white/70">
                Pro
              </span>
            </div>
            <p className="mt-0.5 truncate text-[11px] text-white/35">{userEmail || "seller@pipeline.com"}</p>
          </div>
        </div>

        <SidebarMenu className="mt-3">
          <SidebarMenuItem>
            <form action={signOut} className="w-full">
              <SidebarMenuButton
                render={<button type="submit" className="w-full" />}
                tooltip="Sign out"
                className="rounded-md px-2.5 py-2 !text-white/50 transition-colors hover:!bg-[rgba(255,255,255,0.06)] hover:!text-white"
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
