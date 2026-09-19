"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  MessageSquare,
  Users,
  Calendar,
  Clock,
  Phone,
  Repeat2,
  Bot,
  Radio,
  FileText,
  Tag,
  Ban,
  Kanban,
  FileUp,
  Settings,
  Database,
} from "lucide-react";

import { useTheme } from "@/lib/theme-context";

interface SidebarProps {
  activeItem: string;
  /** Real count of recent inbound replies (from the database). */
  inboxBadge?: number;
  userEmail?: string;
}

const WORKSPACE = [
  { label: "Dashboard", icon: LayoutDashboard, href: "/dashboard" },
  { label: "Messenger", icon: MessageSquare, href: "/inbox" },
  { label: "Contacts", icon: Users, href: "/contacts" },
  { label: "Calendar", icon: Calendar, href: "/calendar" },
  { label: "Scheduled", icon: Clock, href: "/scheduled" },
  { label: "Call Logs", icon: Phone, href: "/call-logs" },
  { label: "Scraper", icon: Database, href: "/scraper" },
];

const OUTREACH = [
  { label: "Text Drips", icon: Repeat2, href: "/drips" },
  { label: "Auto Responders", icon: Bot, href: "/auto-responders" },
  { label: "Campaigns", icon: Radio, href: "/campaigns" },
  { label: "Templates", icon: FileText, href: "/templates" },
  { label: "Tags", icon: Tag, href: "/tags" },
  { label: "Stop Words", icon: Ban, href: "/stop-words" },
];

const SYSTEM = [
  { label: "Pipeline", icon: Kanban, href: "/pipeline" },
  { label: "Import CSV", icon: FileUp, href: "/import" },
  { label: "Settings", icon: Settings, href: "/settings" },
];

const chipColors: Record<string, { bg: string; color: string }> = {
  blu: { bg: "var(--blud)", color: "var(--blu)" },
  amb: { bg: "var(--ambd)", color: "var(--amb)" },
  red: { bg: "var(--redd)", color: "var(--red)" },
  grn: { bg: "var(--gd)", color: "var(--g)" },
};

function NavItem({
  label,
  icon: Icon,
  href,
  chip,
  chipColor,
  isActive,
}: {
  label: string;
  icon: React.ElementType;
  href: string;
  chip?: string;
  chipColor?: string;
  isActive: boolean;
}) {
  const cc = chipColor ? chipColors[chipColor] : null;

  return (
    <Link
      href={href}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 9,
        minHeight: 34,
        padding: "0 10px",
        borderRadius: 8,
        fontSize: 13,
        fontWeight: isActive ? 600 : 500,
        color: isActive ? "var(--g)" : "var(--t2)",
        background: isActive ? "var(--gd)" : "transparent",
        textDecoration: "none",
        position: "relative",
        transition: "background 0.1s, color 0.1s",
      }}
      className="nav-item group"
    >
      <Icon
        size={16}
        strokeWidth={isActive ? 2.2 : 1.8}
        style={{
          opacity: isActive ? 1 : 0.7,
          flexShrink: 0,
          transition: "opacity 0.1s",
        }}
      />
      <span style={{ flex: 1 }}>{label}</span>
      {chip && cc && (
        <span
          style={{
            fontSize: 9,
            fontFamily: "var(--font-mono)",
            borderRadius: 4,
            padding: "1px 5px",
            background: cc.bg,
            color: cc.color,
            fontWeight: 500,
          }}
        >
          {chip}
        </span>
      )}
    </Link>
  );
}

const HREF_TO_LABEL: Record<string, string> = {
  "/dashboard":      "Dashboard",
  "/inbox":          "Messenger",
  "/messenger":      "Messenger",
  "/contacts":       "Contacts",
  "/calendar":       "Calendar",
  "/scheduled":      "Scheduled",
  "/call-logs":      "Call Logs",
  "/drips":          "Text Drips",
  "/auto-responders":"Auto Responders",
  "/campaigns":      "Campaigns",
  "/templates":      "Templates",
  "/tags":           "Tags",
  "/stop-words":     "Stop Words",
  "/pipeline":       "Pipeline",
  "/import":         "Import CSV",
  "/settings":       "Settings",
  "/scraper":        "Scraper",
};

export function Sidebar({ activeItem, inboxBadge = 0, userEmail = "" }: SidebarProps) {
  const { theme, toggleTheme } = useTheme();
  const pathname = usePathname();
  const isDark = theme === "dark";

  // Lead records (/leads, /leads/[id]) belong to Contacts; anything unmapped falls back to activeItem.
  const activeLabel =
    HREF_TO_LABEL[pathname] ?? (pathname.startsWith("/leads") ? "Contacts" : activeItem);

  const namePart = userEmail.split("@")[0] ?? "";
  const nameWords = namePart.split(/[._-]/).filter(Boolean);
  const userName = nameWords.map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ") || "Your account";
  const userInitials = (nameWords.map((w) => w.charAt(0).toUpperCase()).slice(0, 2).join("") || "•");

  return (
    <aside
      style={{
        width: 224,
        height: "100%",
        background: "var(--s1)",
        borderRight: "1px solid var(--b1)",
        display: "flex",
        flexDirection: "column",
        flexShrink: 0,
      }}
    >
      {/* Brand bar */}
      <div
        style={{
          height: 58,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 16px",
          borderBottom: "1px solid var(--b0)",
          flexShrink: 0,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {/* Logo mark */}
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: 9,
              background: "linear-gradient(135deg, #6d5dfc, #4544c8)",
              boxShadow: "0 7px 18px rgba(91,92,226,.28)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <svg width="14" height="11" viewBox="0 0 12 9" fill="none">
              <polyline
                points="1,7 4,4 6,5.5 9,2 11,3"
                stroke="var(--on-g)"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
              />
            </svg>
          </div>
          <span
            style={{
              fontSize: 14,
              fontWeight: 700,
              color: "var(--t1)",
              letterSpacing: "-0.01em",
            }}
          >
            sellingmy.casa
          </span>
        </div>

        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          aria-label="Toggle theme"
          style={{
            width: 26,
            height: 14,
            borderRadius: 99,
            background: isDark ? "var(--g)" : "var(--b2)",
            border: "none",
            cursor: "pointer",
            position: "relative",
            padding: 0,
            flexShrink: 0,
            transition: "background 0.2s",
          }}
        >
          <span
            style={{
              position: "absolute",
              top: 2,
              left: 2,
              width: 10,
              height: 10,
              borderRadius: "50%",
              background: isDark ? "#000" : "var(--s1)",
              transform: isDark ? "translateX(12px)" : "translateX(0)",
              transition: "transform 0.25s cubic-bezier(0.34,1.4,0.64,1), background 0.2s",
            }}
          />
        </button>
      </div>

      {/* Nav */}
      <nav
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "8px 12px 14px",
          display: "flex",
          flexDirection: "column",
          gap: 2,
        }}
      >
        {/* WORKSPACE */}
        <span
          style={{
            fontSize: 10.5,
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            color: "var(--t3)",
            padding: "16px 10px 6px",
          }}
        >
          Workspace
        </span>
        {WORKSPACE.map((item) => (
          <NavItem
            key={item.label}
            {...item}
            {...(item.label === "Messenger" && inboxBadge > 0
              ? { chip: String(inboxBadge), chipColor: "grn" }
              : {})}
            isActive={activeLabel === item.label}
          />
        ))}

        {/* OUTREACH */}
        <span
          style={{
            fontSize: 10.5,
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            color: "var(--t3)",
            padding: "16px 10px 6px",
          }}
        >
          Outreach
        </span>
        {OUTREACH.map((item) => (
          <NavItem key={item.label} {...item} isActive={activeLabel === item.label} />
        ))}

        {/* SYSTEM */}
        <span
          style={{
            fontSize: 10.5,
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            color: "var(--t3)",
            padding: "16px 10px 6px",
          }}
        >
          System
        </span>
        {SYSTEM.map((item) => (
          <NavItem key={item.label} {...item} isActive={activeLabel === item.label} />
        ))}
      </nav>

      {/* Footer — the signed-in user */}
      <div
        style={{
          padding: "12px 14px",
          borderTop: "1px solid var(--b0)",
          display: "flex",
          alignItems: "center",
          gap: 8,
          minWidth: 0,
        }}
      >
        <div
          aria-hidden
          style={{
            width: 28,
            height: 28,
            borderRadius: 7,
            background: "var(--g)",
            color: "var(--on-g)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            fontSize: 10.5,
            fontWeight: 600,
          }}
        >
          {userInitials}
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 500, color: "var(--t1)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {userName}
          </div>
          {userEmail ? (
            <div style={{ fontSize: 10.5, color: "var(--t3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {userEmail}
            </div>
          ) : null}
        </div>
      </div>
    </aside>
  );
}
