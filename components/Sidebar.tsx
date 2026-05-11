"use client";

import Link from "next/link";
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
} from "lucide-react";

import { useTheme } from "@/lib/theme-context";

interface SidebarProps {
  activeItem: string;
}

const WORKSPACE = [
  { label: "Dashboard", icon: LayoutDashboard, href: "/dashboard" },
  { label: "Messenger", icon: MessageSquare, href: "/inbox", chip: "14", chipColor: "blu" },
  { label: "Contacts", icon: Users, href: "/leads", chip: "247", chipColor: "amb" },
  { label: "Calendar", icon: Calendar, href: "/calendar" },
  { label: "Scheduled", icon: Clock, href: "/scheduled", chip: "3", chipColor: "blu" },
  { label: "Call Logs", icon: Phone, href: "/call-logs" },
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
  { label: "Import CSV", icon: FileUp, href: "/leads" },
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
        gap: 7,
        padding: "6px 9px",
        borderRadius: 7,
        fontSize: 12,
        fontWeight: isActive ? 500 : 400,
        color: isActive ? "var(--t1)" : "var(--t2)",
        background: isActive ? "var(--s2)" : "transparent",
        textDecoration: "none",
        position: "relative",
        transition: "background 0.1s, color 0.1s",
      }}
      className="nav-item group"
    >
      {isActive && (
        <span
          style={{
            position: "absolute",
            left: 0,
            top: "50%",
            transform: "translateY(-50%)",
            width: 2,
            height: 13,
            borderRadius: "0 2px 2px 0",
            background: "var(--g)",
          }}
        />
      )}
      <Icon
        size={14}
        style={{
          opacity: isActive ? 1 : 0.55,
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

export function Sidebar({ activeItem }: SidebarProps) {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  return (
    <aside
      style={{
        width: 204,
        height: "100%",
        background: "var(--s1)",
        borderRight: "1px solid var(--b0)",
        display: "flex",
        flexDirection: "column",
        flexShrink: 0,
      }}
    >
      {/* Brand bar */}
      <div
        style={{
          height: 44,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 12px",
          borderBottom: "1px solid var(--b0)",
          flexShrink: 0,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {/* Logo mark */}
          <div
            style={{
              width: 22,
              height: 22,
              borderRadius: 6,
              background: "var(--g)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <svg width="12" height="9" viewBox="0 0 12 9" fill="none">
              <polyline
                points="1,7 4,4 6,5.5 9,2 11,3"
                stroke="black"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
              />
            </svg>
          </div>
          <span
            style={{
              fontSize: 13,
              fontWeight: 600,
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
          padding: "10px 8px",
          display: "flex",
          flexDirection: "column",
          gap: 1,
        }}
      >
        {/* WORKSPACE */}
        <span
          style={{
            fontSize: 9.5,
            fontWeight: 500,
            textTransform: "uppercase",
            letterSpacing: "0.09em",
            color: "var(--t3)",
            padding: "10px 8px 3px",
          }}
        >
          Workspace
        </span>
        {WORKSPACE.map((item) => (
          <NavItem key={item.label} {...item} isActive={activeItem === item.label} />
        ))}

        {/* OUTREACH */}
        <span
          style={{
            fontSize: 9.5,
            fontWeight: 500,
            textTransform: "uppercase",
            letterSpacing: "0.09em",
            color: "var(--t3)",
            padding: "10px 8px 3px",
          }}
        >
          Outreach
        </span>
        {OUTREACH.map((item) => (
          <NavItem key={item.label} {...item} isActive={activeItem === item.label} />
        ))}

        {/* SYSTEM */}
        <span
          style={{
            fontSize: 9.5,
            fontWeight: 500,
            textTransform: "uppercase",
            letterSpacing: "0.09em",
            color: "var(--t3)",
            padding: "10px 8px 3px",
          }}
        >
          System
        </span>
        {SYSTEM.map((item) => (
          <NavItem key={item.label} {...item} isActive={activeItem === item.label} />
        ))}
      </nav>

      {/* Footer */}
      <div
        style={{
          padding: "12px 14px",
          borderTop: "1px solid var(--b0)",
          display: "flex",
          flexDirection: "column",
          gap: 5,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {/* Avatar */}
          <div
            style={{
              width: 27,
              height: 27,
              borderRadius: 7,
              background: "linear-gradient(135deg, var(--g), var(--blu))",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <span
              style={{
                fontSize: 9.5,
                fontWeight: 600,
                color: "#000",
                fontFamily: "var(--font-mono)",
              }}
            >
              SB
            </span>
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 500, color: "var(--t1)" }}>
              Senay Baraki
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 4,
                marginTop: 1,
              }}
            >
              <span
                style={{
                  width: 5,
                  height: 5,
                  borderRadius: "50%",
                  background: "var(--g)",
                  flexShrink: 0,
                }}
              />
              <span
                style={{
                  fontSize: 10,
                  fontFamily: "var(--font-mono)",
                  color: "var(--t3)",
                }}
              >
                Live · Telnyx
              </span>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
