"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Layers,
  PanelsTopLeft,
  ShieldAlert,
  Users,
  MessageSquare,
  Settings,
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
  "--sidebar": "220 14% 97%",
  "--sidebar-foreground": "215 16% 50%",
  "--sidebar-border": "210 24% 90%",
  "--sidebar-accent": "162 71% 95%",
  "--sidebar-accent-foreground": "163 100% 38%",
  "--sidebar-ring": "163 100% 38%",
} as React.CSSProperties;

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/pipeline", label: "Pipeline", icon: PanelsTopLeft },
  { href: "/campaigns", label: "Campaigns", icon: Layers },
  { href: "/foreclosures", label: "Foreclosures", icon: ShieldAlert },
  { href: "/leads", label: "Leads", icon: Users },
  { href: "/inbox", label: "Inbox", icon: MessageSquare },
  { href: "/settings", label: "Settings", icon: Settings },
];

interface AppSidebarProps {
  inboxBadgeCount?: number;
  campaignCount?: number;
  userEmail?: string;
}

export function AppSidebar({
  inboxBadgeCount = 0,
  campaignCount = 0,
  userEmail = "",
}: AppSidebarProps) {
  const pathname = usePathname();

  return (
    <Sidebar collapsible="icon" style={sidebarStyle} className="border-r border-[#e8edf2]">
      {/* Logo */}
      <SidebarHeader className="px-4 py-5">
        <div className="flex items-center gap-3 group-data-[collapsible=icon]:justify-center">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[#00c08b] text-[12px] font-semibold text-white">
            S
          </div>
          <div className="group-data-[collapsible=icon]:hidden">
            <p className="text-[14px] font-semibold leading-tight text-[#1a1f36]">sellingmy.casa</p>
            <p className="text-[11px] leading-tight text-[#6b7c93]">Real Estate CRM</p>
          </div>
        </div>
      </SidebarHeader>

      {/* Navigation */}
      <SidebarContent>
        <SidebarGroup className="px-3 py-1">
          <SidebarGroupContent>
            <SidebarMenu className="gap-0.5">
              {navItems.map(({ href, label, icon: Icon }) => {
                const isActive = pathname === href || pathname.startsWith(`${href}/`);
                const showBadge =
                  (label === "Inbox" && inboxBadgeCount > 0) ||
                  (label === "Campaigns" && campaignCount > 0);
                const badgeCount = label === "Inbox" ? inboxBadgeCount : campaignCount;

                return (
                  <SidebarMenuItem key={href}>
                    <SidebarMenuButton
                      render={<Link href={href} />}
                      isActive={isActive}
                      tooltip={label}
                      className={cn(
                        "rounded-md px-3 py-2 text-[13px] transition-colors duration-100",
                        isActive
                          ? "!bg-[#eaf9f5] !text-[#00c08b] !font-medium"
                          : "!text-[#6b7c93] hover:!bg-[#f0f2f5] hover:!text-[#1a1f36]"
                      )}
                    >
                      <Icon size={16} strokeWidth={1.6} className="shrink-0" />
                      <span className="flex-1">{label}</span>
                      {showBadge && (
                        <span className="rounded-full bg-[#e8edf2] px-1.5 py-0.5 text-[10px] font-medium text-[#6b7c93] group-data-[collapsible=icon]:hidden">
                          {badgeCount > 99 ? "99+" : badgeCount}
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

      {/* Footer */}
      <SidebarFooter className="border-t border-[#e8edf2] px-4 py-4">
        <div className="mb-2 flex items-center gap-2 group-data-[collapsible=icon]:justify-center">
          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#eaf9f5] text-[10px] font-semibold text-[#00c08b]">
            {userEmail ? userEmail[0].toUpperCase() : "U"}
          </div>
          <div className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden">
            <div className="flex items-center gap-1.5">
              <span className="truncate text-[12px] text-[#1a1f36]">{userEmail || "user@example.com"}</span>
              <span className="shrink-0 rounded-full bg-[#eaf9f5] px-1.5 py-0.5 text-[10px] font-medium text-[#00c08b]">Pro</span>
            </div>
          </div>
        </div>

        <SidebarMenu>
          <SidebarMenuItem>
            <form action={signOut} className="w-full">
              <SidebarMenuButton
                render={<button type="submit" className="w-full" />}
                tooltip="Sign out"
                className="rounded-md px-3 py-2 !text-[#6b7c93] transition-colors duration-100 hover:!bg-[#f0f2f5] hover:!text-[#1a1f36]"
              >
                <LogOut size={14} strokeWidth={1.6} />
                <span className="text-[13px]">Sign out</span>
              </SidebarMenuButton>
            </form>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
