"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Users,
  Flame,
  MessageSquare,
  AlertTriangle,
  Activity,
  Rss,
  TrendingUp,
  ArrowRight,
} from "lucide-react";

import { Card } from "@/components/Card";
import { Topbar } from "@/components/Topbar";
import type { Database } from "@/types/database";

type Lead = Database["public"]["Tables"]["leads"]["Row"];
type Message = Database["public"]["Tables"]["messages"]["Row"];

interface Props {
  userName: string;
  userInitials: string;
  counts: {
    totalLeads: number;
    contactedLeads: number;
    repliesReceived: number;
    hotLeads: number;
    dueToday: number;
  };
  dueLeads: Lead[];
  recentReplies: Array<{ lead: Lead; message: Message }>;
  hotLeadRows: Array<{ lead: Lead; lastMessage: Message | null }>;
  campaignPerformance: Array<{
    id: string;
    name: string;
    campaign_type: string | null;
    messaged_count: number;
    replied_count: number;
    hot_count: number;
    total_leads: number;
    conversionRate: number;
  }>;
}

// ── Stat bar hook ──────────────────────────────────────────────────────────
function useBarFill(target: number) {
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setWidth(target), 120);
    return () => clearTimeout(t);
  }, [target]);
  return width;
}

// ── Panel header ───────────────────────────────────────────────────────────
function PanelHeader({
  icon: Icon,
  iconColor,
  title,
  right,
}: {
  icon: React.ElementType;
  iconColor: string;
  title: string;
  right?: React.ReactNode;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "14px 16px 10px",
        borderBottom: "1px solid var(--b0)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
        <Icon size={13} style={{ color: iconColor }} />
        <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--t1)" }}>{title}</span>
      </div>
      {right}
    </div>
  );
}

// ── Stat card ──────────────────────────────────────────────────────────────
function StatCard({
  label,
  icon: Icon,
  iconBg,
  iconColor,
  value,
  footer,
  pct,
  barColor,
}: {
  label: string;
  icon: React.ElementType;
  iconBg: string;
  iconColor: string;
  value: number | string;
  footer: string;
  pct: number;
  barColor: string;
}) {
  const barW = useBarFill(pct);

  return (
    <Card style={{ padding: "14px 16px", display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <span style={{ fontSize: 10.5, fontWeight: 500, color: "var(--t3)", letterSpacing: "0.02em" }}>
          {label}
        </span>
        <div
          style={{
            width: 26,
            height: 26,
            borderRadius: 7,
            background: iconBg,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Icon size={13} style={{ color: iconColor }} />
        </div>
      </div>
      <div
        style={{
          fontSize: 28,
          fontFamily: "var(--font-mono)",
          fontWeight: 600,
          letterSpacing: "-0.05em",
          color: "var(--t1)",
          marginTop: 10,
          lineHeight: 1,
        }}
      >
        {typeof value === "number" ? value.toLocaleString() : value}
      </div>
      <div
        style={{
          fontSize: 10,
          fontFamily: "var(--font-mono)",
          color: "var(--t3)",
          marginTop: 6,
        }}
      >
        {footer}
      </div>
      <div
        style={{
          height: 2,
          background: "var(--b1)",
          borderRadius: 2,
          marginTop: 12,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${barW}%`,
            background: barColor,
            borderRadius: 2,
            transition: "width 0.7s cubic-bezier(.4,0,.2,1)",
          }}
        />
      </div>
    </Card>
  );
}

// ── Activity feed ──────────────────────────────────────────────────────────
type FeedItem = {
  id: number;
  color: string;
  text: string;
  time: string;
  opacity?: number;
};

const INITIAL_FEED: FeedItem[] = [
  { id: 1, color: "var(--blu)", text: "Darnell Williams replied to your message", time: "Just now" },
  { id: 2, color: "var(--g)", text: "Marcus Trevino added to pipeline", time: "4m ago" },
  { id: 3, color: "var(--amb)", text: "Jerome Castillo opened your text", time: "9m ago" },
  { id: 4, color: "var(--pur)", text: "AI drafted response for Patricia Okonkwo", time: "14m ago" },
  { id: 5, color: "var(--g)", text: "LGBS campaign sent to 89 contacts", time: "22m ago" },
  { id: 6, color: "var(--red)", text: "Gloria Sampson — follow-up overdue 8 days", time: "1h ago" },
];

const INCOMING: Omit<FeedItem, "id">[] = [
  { color: "var(--blu)", text: "New reply from Jerome Castillo", time: "Just now" },
  { color: "var(--g)", text: "Lead scored HOT: Darnell Williams", time: "Just now" },
  { color: "var(--pur)", text: "AI insight ready for Marcus Trevino", time: "Just now" },
  { color: "var(--amb)", text: "Follow-up reminder: Patricia Okonkwo", time: "Just now" },
];

function LiveFeed() {
  const [items, setItems] = useState<FeedItem[]>(INITIAL_FEED);
  const counterRef = useRef(100);

  useEffect(() => {
    let idx = 0;
    const iv = setInterval(() => {
      const next = INCOMING[idx % INCOMING.length];
      idx++;
      setItems((prev) => {
        const newItem: FeedItem = { ...next, id: counterRef.current++, opacity: 0 };
        const updated = [newItem, ...prev].slice(0, 7);
        return updated;
      });
      // fade in
      setTimeout(() => {
        setItems((prev) =>
          prev.map((item) =>
            item.opacity === 0 ? { ...item, opacity: 1 } : item
          )
        );
      }, 50);
    }, 6000);
    return () => clearInterval(iv);
  }, []);

  return (
    <div style={{ overflowY: "auto", display: "flex", flexDirection: "column" }}>
      {items.map((item, i) => (
        <div
          key={item.id}
          style={{
            display: "flex",
            gap: 10,
            padding: "8px 16px",
            background: "transparent",
            opacity: item.opacity === 0 ? 0 : 1,
            transition: "opacity 0.4s",
            cursor: "default",
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = "var(--s2)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
        >
          {/* Timeline pip */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
            <span
              style={{
                width: 7,
                height: 7,
                borderRadius: "50%",
                background: item.color,
                flexShrink: 0,
              }}
            />
            {i < items.length - 1 && (
              <span
                style={{
                  width: 1,
                  flex: 1,
                  background: "var(--b1)",
                  margin: "3px 0",
                }}
              />
            )}
          </div>
          {/* Content */}
          <div>
            <div style={{ fontSize: 11.5, color: "var(--t1)" }}>{item.text}</div>
            <div
              style={{
                fontSize: 10,
                fontFamily: "var(--font-mono)",
                color: "var(--t3)",
                marginTop: 2,
              }}
            >
              {item.time}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Main dashboard ─────────────────────────────────────────────────────────
export function DashboardClient({ counts }: Props) {
  const heatLeads = [
    { name: "Darnell Williams", addr: "4812 Almeda Rd", pct: 94, color: "var(--red)", days: "23d" },
    { name: "Jerome Castillo", addr: "1148 Griggs Rd", pct: 80, color: "var(--red)", days: "30d" },
    { name: "Marcus Trevino", addr: "2234 Cullen Blvd", pct: 60, color: "var(--amb)", days: "58d" },
    { name: "Patricia Okonkwo", addr: "9201 Fondren Rd", pct: 45, color: "var(--amb)", days: "72d" },
    { name: "Gloria Sampson", addr: "6710 Scott St", pct: 27, color: "var(--g)", days: "103d" },
  ];

  const convos = [
    { init: "DW", name: "Darnell Williams", msg: "yeah that works", time: "11:45am", badge: "HOT", badgeColor: "var(--red)", badgeBg: "var(--redd)" },
    { init: "JC", name: "Jerome Castillo", msg: "Let me think about it", time: "4:00pm", badge: "WARM", badgeColor: "var(--amb)", badgeBg: "var(--ambd)" },
    { init: "PO", name: "Patricia Okonkwo", msg: "I already have an agent", time: "Yesterday", badge: "WARM", badgeColor: "var(--amb)", badgeBg: "var(--ambd)" },
    { init: "MT", name: "Marcus Trevino", msg: "No reply yet", time: "Today 8am", badge: "NEW", badgeColor: "var(--g)", badgeBg: "var(--gd)" },
    { init: "GS", name: "Gloria Sampson", msg: "not interested", time: "8d ago", badge: "COLD", badgeColor: "var(--t3)", badgeBg: "var(--b1)" },
  ];

  const stages = [
    { name: "New → Contacted", pct: 42, color: "var(--blu)", days: "1.2d" },
    { name: "Contacted → Warm", pct: 68, color: "var(--pur)", days: "3.8d" },
    { name: "Warm → Offer", pct: 54, color: "var(--amb)", days: "5.1d" },
    { name: "Offer → Contract", pct: 28, color: "var(--g)", days: "2.4d" },
  ];

  const miniMetrics = [
    { label: "Total texts sent", value: "53,933", footer: "In 6,564 · Out 47,369", color: "var(--g)" },
    { label: "Reply rate", value: "12.7%", footer: "↑ 2.4× industry avg", color: "var(--pur)", footerColor: "var(--g)" },
    { label: "Total calls", value: "131", footer: "In 117 · Out 14", color: "var(--blu)" },
    { label: "AI queue", value: "0", footer: "all clear", color: "var(--t3)", footerColor: "var(--g)" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: 0, flex: 1 }}>
      <Topbar page="Dashboard" />

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(12, 1fr)",
          gridAutoRows: "54px",
          gap: 10,
          padding: "16px 20px",
        }}
      >
        {/* ── HERO ──────────────────────────────── col 1-8, row 1-2 */}
        <Card
          noLift
          style={{ gridColumn: "1 / 9", gridRow: "1 / 3", padding: "22px 24px 20px", display: "flex", flexDirection: "column", justifyContent: "space-between" }}
        >
          <div>
            <div
              style={{
                fontSize: 10,
                fontFamily: "var(--font-mono)",
                fontWeight: 500,
                color: "var(--t3)",
                textTransform: "uppercase",
                letterSpacing: "0.07em",
                marginBottom: 8,
              }}
            >
              Mon, May 11, 2026 · Harris County
            </div>
            <div
              style={{
                fontSize: 19,
                fontWeight: 600,
                letterSpacing: "-0.035em",
                color: "var(--t1)",
              }}
            >
              Good morning,{" "}
              <span style={{ color: "var(--g)" }}>Senay</span>
            </div>
            <div style={{ fontSize: 12, color: "var(--t2)", marginTop: 4 }}>
              14 unread replies · 3 follow-ups overdue · Next foreclosure sale Jun 3
            </div>
          </div>
          <div style={{ display: "flex", gap: 7, marginTop: 16 }}>
            <Link
              href="/inbox"
              style={{
                height: 30,
                padding: "0 14px",
                borderRadius: 6,
                background: "var(--t1)",
                color: "var(--bg)",
                fontSize: 12,
                fontWeight: 500,
                display: "inline-flex",
                alignItems: "center",
                textDecoration: "none",
              }}
            >
              Open Inbox
            </Link>
            <Link
              href="/leads"
              style={{
                height: 30,
                padding: "0 14px",
                borderRadius: 6,
                border: "1px solid var(--b2)",
                background: "transparent",
                color: "var(--t2)",
                fontSize: 12,
                fontWeight: 500,
                display: "inline-flex",
                alignItems: "center",
                textDecoration: "none",
              }}
            >
              Follow-ups
            </Link>
            <Link
              href="/leads"
              style={{
                height: 30,
                padding: "0 14px",
                borderRadius: 6,
                border: "1px solid var(--b2)",
                background: "transparent",
                color: "var(--t2)",
                fontSize: 12,
                fontWeight: 500,
                display: "inline-flex",
                alignItems: "center",
                textDecoration: "none",
              }}
            >
              Import Leads
            </Link>
          </div>
        </Card>

        {/* ── STAT CARDS ────────────────────────── each col 2, row 2 */}
        <div style={{ gridColumn: "9 / 11", gridRow: "1 / 3" }}>
          <StatCard
            label="Total Leads"
            icon={Users}
            iconBg="var(--gd)"
            iconColor="var(--g)"
            value={counts.totalLeads}
            footer={`+${Math.round(counts.totalLeads * 0.08)} this week`}
            pct={73}
            barColor="var(--g)"
          />
        </div>
        <div style={{ gridColumn: "11 / 13", gridRow: "1 / 3" }}>
          <StatCard
            label="Hot Leads"
            icon={Flame}
            iconBg="var(--ambd)"
            iconColor="var(--amb)"
            value={counts.hotLeads}
            footer={`${Math.round((counts.hotLeads / Math.max(counts.totalLeads, 1)) * 100)}% of total`}
            pct={31}
            barColor="var(--amb)"
          />
        </div>

        {/* Row 2 stat cards — span cols 9-10 and 11-12, row 3-4 */}
        <div style={{ gridColumn: "9 / 11", gridRow: "3 / 5" }}>
          <StatCard
            label="New Replies"
            icon={MessageSquare}
            iconBg="var(--blud)"
            iconColor="var(--blu)"
            value={counts.repliesReceived}
            footer="Last 24 hours"
            pct={14}
            barColor="var(--blu)"
          />
        </div>
        <div style={{ gridColumn: "11 / 13", gridRow: "3 / 5" }}>
          <StatCard
            label="Overdue"
            icon={AlertTriangle}
            iconBg="var(--redd)"
            iconColor="var(--red)"
            value={counts.dueToday}
            footer="Follow-ups past due"
            pct={42}
            barColor="var(--red)"
          />
        </div>

        {/* ── URGENCY HEAT MAP ──────────────────── col 1-4, row 3-5 */}
        <Card noLift style={{ gridColumn: "1 / 5", gridRow: "3 / 6" }}>
          <PanelHeader
            icon={Activity}
            iconColor="var(--red)"
            title="Urgency Heat Map"
            right={
              <span style={{ fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--t3)" }}>
                days to sale
              </span>
            }
          />
          <div style={{ padding: "10px 16px 14px", display: "flex", flexDirection: "column", gap: 9 }}>
            {heatLeads.map((lead) => (
              <div key={lead.name} style={{ display: "grid", gridTemplateColumns: "1fr 80px 32px", gap: 8, alignItems: "center" }}>
                <div>
                  <div style={{ fontSize: 11.5, fontWeight: 500, color: "var(--t1)" }}>{lead.name}</div>
                  <div style={{ fontSize: 10, color: "var(--t3)" }}>{lead.addr}</div>
                </div>
                <div style={{ height: 4, background: "var(--b1)", borderRadius: 4, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${lead.pct}%`, background: lead.color, borderRadius: 4 }} />
                </div>
                <div style={{ fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--t3)", textAlign: "right" }}>
                  {lead.days}
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* ── AI INSIGHT ────────────────────────── col 5-8, row 3-5 */}
        <Card noLift style={{ gridColumn: "5 / 9", gridRow: "3 / 6", padding: "16px 18px", display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span
              style={{
                fontSize: 9.5,
                fontFamily: "var(--font-mono)",
                textTransform: "uppercase",
                letterSpacing: "0.07em",
                background: "var(--purb)",
                color: "var(--pur)",
                borderRadius: 99,
                padding: "2px 8px",
                fontWeight: 500,
              }}
            >
              AI · Insight
            </span>
            <span style={{ fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--t3)" }}>
              updated 4m ago
            </span>
          </div>

          <div>
            <div style={{ fontSize: 9.5, fontFamily: "var(--font-mono)", fontWeight: 600, textTransform: "uppercase", color: "var(--t3)", letterSpacing: "0.07em", marginBottom: 6 }}>
              Lead Signal
            </div>
            <div style={{ fontSize: 12.5, lineHeight: 1.6, letterSpacing: "-0.01em", color: "var(--t1)" }}>
              Darnell Williams replied 3× faster than average and used buyer-intent language. Accept probability is high if contacted in the next{" "}
              <span style={{ background: "var(--gd)", color: "var(--g)", borderRadius: 3, padding: "0 4px" }}>
                48 hours
              </span>
              .
            </div>
          </div>

          <div style={{ height: 1, background: "var(--b0)" }} />

          <div>
            <div style={{ fontSize: 9.5, fontFamily: "var(--font-mono)", fontWeight: 600, textTransform: "uppercase", color: "var(--t3)", letterSpacing: "0.07em", marginBottom: 6 }}>
              Campaign Signal
            </div>
            <div style={{ fontSize: 12.5, lineHeight: 1.6, letterSpacing: "-0.01em", color: "var(--t1)" }}>
              LGBS blast hit{" "}
              <span style={{ background: "var(--gd)", color: "var(--g)", borderRadius: 3, padding: "0 4px" }}>
                12.7% reply rate
              </span>{" "}
              — 2.4× industry avg. 89 contacts unsent. Estimated ~11 new convos if sent today.
            </div>
          </div>

          <div style={{ height: 1, background: "var(--b0)" }} />

          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {[
              { label: "Message Darnell now", href: "/inbox" },
              { label: "Launch remaining LGBS batch", href: "/campaigns" },
            ].map((action) => (
              <Link
                key={action.label}
                href={action.href}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  fontSize: 11.5,
                  fontWeight: 500,
                  color: "var(--blu)",
                  padding: "5px 8px",
                  borderRadius: 6,
                  textDecoration: "none",
                  transition: "background 0.12s, color 0.12s",
                }}
                className="ai-action-link"
              >
                {action.label}
                <ArrowRight size={11} className="ai-arrow" />
              </Link>
            ))}
          </div>
        </Card>

        {/* ── PIPELINE VELOCITY ─────────────────── col 1-4, row 6-8 */}
        <Card noLift style={{ gridColumn: "1 / 5", gridRow: "6 / 9" }}>
          <PanelHeader
            icon={TrendingUp}
            iconColor="var(--g)"
            title="Pipeline Velocity"
            right={
              <span style={{ fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--t3)" }}>
                avg days / stage
              </span>
            }
          />
          <div style={{ padding: "16px 18px", display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                <span style={{ fontSize: 24, fontFamily: "var(--font-mono)", fontWeight: 600, color: "var(--g)" }}>4.2</span>
                <span style={{ fontSize: 13, color: "var(--t2)" }}>days avg</span>
              </div>
              <span style={{ fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--g)" }}>↑ 18% faster</span>
            </div>
            {stages.map((stage) => (
              <div key={stage.name} style={{ display: "grid", gridTemplateColumns: "120px 1fr 32px", gap: 8, alignItems: "center" }}>
                <span style={{ fontSize: 11, color: "var(--t2)" }}>{stage.name}</span>
                <div style={{ height: 3, background: "var(--b1)", borderRadius: 3, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${stage.pct}%`, background: stage.color, borderRadius: 3 }} />
                </div>
                <span style={{ fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--t3)", textAlign: "right" }}>
                  {stage.days}
                </span>
              </div>
            ))}
          </div>
        </Card>

        {/* ── LIVE ACTIVITY FEED ────────────────── col 5-8, row 6-9 */}
        <Card noLift style={{ gridColumn: "5 / 9", gridRow: "6 / 10" }}>
          <PanelHeader
            icon={Rss}
            iconColor="var(--blu)"
            title="Live Activity"
            right={
              <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <span
                  style={{
                    width: 5,
                    height: 5,
                    borderRadius: "50%",
                    background: "var(--g)",
                    animation: "pulse 2.4s infinite",
                  }}
                />
                <span style={{ fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--t3)" }}>live</span>
              </div>
            }
          />
          <LiveFeed />
        </Card>

        {/* ── RECENT CONVERSATIONS ──────────────── col 9-13, row 5-9 */}
        <Card noLift style={{ gridColumn: "9 / 13", gridRow: "5 / 10" }}>
          <PanelHeader
            icon={MessageSquare}
            iconColor="var(--blu)"
            title="Recent Conversations"
            right={
              <Link
                href="/inbox"
                style={{ fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--blu)", textDecoration: "none" }}
              >
                View all
              </Link>
            }
          />
          <div>
            {convos.map((c) => (
              <div
                key={c.name}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "9px 16px",
                  cursor: "pointer",
                  transition: "background 0.1s",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "var(--s2)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
              >
                {/* Avatar */}
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 8,
                    background: c.badgeBg,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <span style={{ fontSize: 9.5, fontWeight: 600, fontFamily: "var(--font-mono)", color: c.badgeColor }}>
                    {c.init}
                  </span>
                </div>
                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 500, color: "var(--t1)" }}>{c.name}</div>
                  <div style={{ fontSize: 11, color: "var(--t3)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {c.msg}
                  </div>
                </div>
                {/* Right */}
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 3, flexShrink: 0 }}>
                  <span style={{ fontSize: 9.5, fontFamily: "var(--font-mono)", color: "var(--t3)" }}>{c.time}</span>
                  <span
                    style={{
                      fontSize: 9,
                      fontFamily: "var(--font-mono)",
                      fontWeight: 600,
                      borderRadius: 4,
                      padding: "1px 5px",
                      background: c.badgeBg,
                      color: c.badgeColor,
                    }}
                  >
                    {c.badge}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* ── PIPELINE VELOCITY row 8 uses col 1-4 already */}
        {/* Row 9 spacer for pipeline velocity (already spans row 6-8, 3 rows = 162px) */}

        {/* ── MINI METRICS ─────────────────────── row 9, 4× col 3 */}
        {miniMetrics.map((m, i) => (
          <Card
            key={m.label}
            style={{
              gridColumn: `${1 + i * 3} / ${1 + i * 3 + 3}`,
              gridRow: "9 / 11",
              padding: "16px 18px",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
            }}
          >
            <div style={{ fontSize: 10.5, fontWeight: 500, color: "var(--t3)", letterSpacing: "0.02em" }}>
              {m.label}
            </div>
            <div style={{ fontSize: 21, fontFamily: "var(--font-mono)", fontWeight: 600, letterSpacing: "-0.04em", color: m.color, marginTop: 8 }}>
              {m.value}
            </div>
            <div style={{ fontSize: 10, fontFamily: "var(--font-mono)", color: m.footerColor ?? "var(--t3)", marginTop: 5 }}>
              {m.footer}
            </div>
          </Card>
        ))}
      </div>

      <style>{`
        .ai-action-link:hover {
          background: var(--blud);
          color: var(--t1);
        }
        .ai-action-link:hover .ai-arrow {
          transform: translateX(2px);
        }
        .ai-arrow {
          transition: transform 0.15s;
        }
        .nav-item:hover {
          background: var(--s2) !important;
          color: var(--t1) !important;
        }
      `}</style>
    </div>
  );
}
