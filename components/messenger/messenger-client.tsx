"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  Search,
  Plus,
  Phone,
  StickyNote,
  ExternalLink,
  MoreHorizontal,
  Paperclip,
  FileText,
  Clock,
  Send,
  MessageSquare,
  CheckCheck,
} from "lucide-react";

import { Topbar } from "@/components/Topbar";
import type { Database } from "@/types/database";

type Lead = Database["public"]["Tables"]["leads"]["Row"];
type Message = Database["public"]["Tables"]["messages"]["Row"];

// ── Status helpers ───────────────────────────────────────────────────────────

type DisplayStatus = "HOT" | "WARM" | "NEW" | "COLD";

const STATUS_STYLES: Record<DisplayStatus, { bg: string; color: string }> = {
  HOT:  { bg: "var(--redd)", color: "var(--red)" },
  WARM: { bg: "var(--ambd)", color: "var(--amb)" },
  NEW:  { bg: "var(--gd)",   color: "var(--g)"   },
  COLD: { bg: "var(--b1)",   color: "var(--t3)"  },
};

function toDisplayStatus(lead: Lead): DisplayStatus {
  const c = lead.classification;
  if (c === "HOT") return "HOT";
  if (c === "WARM") return "WARM";
  if (c === "COLD" || c === "DEAD" || c === "OPT_OUT") return "COLD";
  if (lead.status === "New") return "NEW";
  if (lead.status === "Replied") return "WARM";
  if (lead.status === "Hot") return "HOT";
  return "NEW";
}

const AVATAR_PALETTE: Record<DisplayStatus, [string, string]> = {
  HOT:  ["#3a1d22", "var(--red)"],
  WARM: ["#3a2a14", "var(--amb)"],
  NEW:  ["#0f2820", "var(--g)"],
  COLD: ["#1e242c", "var(--t3)"],
};

function getInitials(lead: Lead) {
  return ((lead.first_name[0] ?? "") + (lead.last_name[0] ?? "")).toUpperCase();
}

// ── Quick replies ────────────────────────────────────────────────────────────

const QUICK_REPLIES = [
  {
    label: "Cash offer opener",
    text: "Hi {first} — Senay with sellingmy.casa. I can offer cash for {address} as-is, no fees, close in 9 days. Want a number?",
  },
  {
    label: "Follow-up",
    text: "Just checking in on {address} — still open to a cash offer? No pressure, happy to revisit whenever the timing's right.",
  },
  {
    label: "Schedule call",
    text: "Easier to talk this through? I can call you in the next 30 min, or pick a time that works: tomorrow 10a / 2p / 4p.",
  },
  {
    label: "Opt-out footer",
    text: "Reply STOP to opt out anytime. We won't text again if you do.",
  },
];

// ── Sub-components ───────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: DisplayStatus }) {
  const s = STATUS_STYLES[status];
  return (
    <span
      style={{
        fontSize: 9,
        fontFamily: "var(--font-mono)",
        fontWeight: 600,
        letterSpacing: "0.04em",
        borderRadius: 4,
        padding: "1px 5px",
        background: s.bg,
        color: s.color,
        flexShrink: 0,
      }}
    >
      {status}
    </span>
  );
}

function Avatar({
  lead,
  size = 30,
}: {
  lead: Lead;
  size?: number;
}) {
  const status = toDisplayStatus(lead);
  const [bg, color] = AVATAR_PALETTE[status];
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: 8,
        background: bg,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}
    >
      <span
        style={{
          fontSize: size * 0.34,
          fontFamily: "var(--font-mono)",
          fontWeight: 600,
          color,
        }}
      >
        {getInitials(lead)}
      </span>
    </div>
  );
}

// ── Conversation list ────────────────────────────────────────────────────────

interface ConvoItem {
  lead: Lead;
  latestMessage: Message | null;
  unread: boolean;
  status: DisplayStatus;
}

function ConvoRow({
  item,
  active,
  onClick,
}: {
  item: ConvoItem;
  active: boolean;
  onClick: () => void;
}) {
  const { lead, latestMessage, unread, status } = item;
  const preview = latestMessage?.body?.slice(0, 60) ?? "No messages yet";
  const time = latestMessage
    ? new Date(latestMessage.created_at).toLocaleTimeString([], {
        hour: "numeric",
        minute: "2-digit",
      })
    : "";

  return (
    <div
      className={"convo-row" + (active ? " active" : "")}
      onClick={onClick}
      style={{
        display: "grid",
        gridTemplateColumns: "30px 1fr auto",
        gap: 10,
        padding: "10px 12px",
        borderLeft: active ? "2px solid var(--g)" : "2px solid transparent",
        cursor: "pointer",
        transition: "background .12s",
      }}
    >
      <Avatar lead={lead} />
      <div style={{ minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span
            className="convo-name"
            style={{
              fontSize: 12.5,
              fontWeight: unread ? 600 : 500,
              color: unread ? "var(--t1)" : "var(--t2)",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              flex: 1,
              minWidth: 0,
            }}
          >
            {lead.first_name} {lead.last_name}
          </span>
        </div>
        <div
          style={{
            fontSize: 11,
            color: unread ? "var(--t2)" : "var(--t3)",
            marginTop: 2,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {preview}
        </div>
      </div>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-end",
          gap: 5,
          flexShrink: 0,
        }}
      >
        <span
          style={{
            fontSize: 9.5,
            fontFamily: "var(--font-mono)",
            color: unread ? "var(--g)" : "var(--t3)",
          }}
        >
          {time}
        </span>
        <StatusBadge status={status} />
      </div>
    </div>
  );
}

function ConversationList({
  items,
  selectedId,
  onSelect,
  totalUnread,
}: {
  items: ConvoItem[];
  selectedId: string;
  onSelect: (id: string) => void;
  totalUnread: number;
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<string>("All");
  const filters = ["All", "Unread", "HOT", "WARM", "NEW"];

  const filtered = items.filter((item) => {
    if (filter === "Unread" && !item.unread) return false;
    if (["HOT", "WARM", "NEW", "COLD"].includes(filter) && item.status !== filter) return false;
    if (query.trim()) {
      const q = query.toLowerCase();
      const name = `${item.lead.first_name} ${item.lead.last_name}`.toLowerCase();
      return (name + " " + (item.lead.property_address ?? "") + " " + (item.latestMessage?.body ?? "")).toLowerCase().includes(q);
    }
    return true;
  });

  return (
    <aside
      style={{
        width: 296,
        flexShrink: 0,
        background: "var(--s1)",
        borderRight: "1px solid var(--b0)",
        display: "flex",
        flexDirection: "column",
        minHeight: 0,
      }}
    >
      {/* Header */}
      <div style={{ padding: "14px 14px 10px", borderBottom: "1px solid var(--b0)" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 10,
          }}
        >
          <div style={{ display: "flex", alignItems: "baseline", gap: 7 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--t1)" }}>
              Conversations
            </span>
            <span
              style={{
                fontSize: 10.5,
                fontFamily: "var(--font-mono)",
                color: "var(--t3)",
              }}
            >
              {totalUnread} unread · {items.length} total
            </span>
          </div>
          <button
            className="icon-btn"
            style={{
              width: 24,
              height: 24,
              borderRadius: 6,
              background: "transparent",
              border: "1px solid var(--b1)",
              color: "var(--t2)",
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
            }}
            title="Start conversation"
          >
            <Plus size={12} />
          </button>
        </div>

        {/* Search */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 7,
            background: "var(--bg)",
            border: "1px solid var(--b1)",
            borderRadius: 6,
            padding: "6px 9px",
          }}
        >
          <Search size={12} style={{ color: "var(--t3)", flexShrink: 0 }} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name, address, phone…"
            style={{
              flex: 1,
              background: "transparent",
              border: "none",
              color: "var(--t1)",
              fontSize: 11.5,
              fontFamily: "inherit",
            }}
          />
          <span
            style={{
              fontSize: 9.5,
              fontFamily: "var(--font-mono)",
              color: "var(--t3)",
              border: "1px solid var(--b1)",
              borderRadius: 3,
              padding: "0 4px",
            }}
          >
            ⌘K
          </span>
        </div>

        {/* Filters */}
        <div style={{ display: "flex", gap: 4, marginTop: 10 }}>
          {filters.map((f) => {
            const isActive = filter === f;
            return (
              <button
                key={f}
                onClick={() => setFilter(f)}
                style={{
                  fontSize: 10.5,
                  fontWeight: 500,
                  padding: "3px 8px",
                  borderRadius: 99,
                  border: "1px solid " + (isActive ? "var(--b2)" : "transparent"),
                  background: isActive ? "var(--s3)" : "transparent",
                  color: isActive ? "var(--t1)" : "var(--t3)",
                  cursor: "pointer",
                  fontFamily: ["HOT", "WARM", "NEW"].includes(f) ? "var(--font-mono)" : "inherit",
                }}
              >
                {f}
              </button>
            );
          })}
        </div>
      </div>

      {/* List */}
      <div style={{ flex: 1, overflowY: "auto", minHeight: 0 }}>
        {filtered.map((item) => (
          <ConvoRow
            key={item.lead.id}
            item={item}
            active={item.lead.id === selectedId}
            onClick={() => onSelect(item.lead.id)}
          />
        ))}
        {filtered.length === 0 && (
          <div
            style={{
              padding: "30px 16px",
              textAlign: "center",
              color: "var(--t3)",
              fontSize: 11.5,
            }}
          >
            No conversations match.
          </div>
        )}
      </div>
    </aside>
  );
}

// ── Metadata strip ───────────────────────────────────────────────────────────

const sourceColorMap: Record<string, { color: string; bg: string }> = {
  "LGBS Tax Sale":    { color: "var(--blu)", bg: "var(--blud)" },
  "Probate":         { color: "var(--pur)", bg: "var(--purd)" },
  "Code Violation":  { color: "var(--amb)", bg: "var(--ambd)" },
  "Driving for $":   { color: "var(--g)",   bg: "var(--gd)"   },
  "Skip Trace":      { color: "var(--g)",   bg: "var(--gd)"   },
  "Pre-foreclosure": { color: "var(--red)", bg: "var(--redd)" },
};

const iconBtn: React.CSSProperties = {
  width: 28,
  height: 28,
  borderRadius: 6,
  background: "transparent",
  border: "1px solid var(--b1)",
  color: "var(--t2)",
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
};

function MetadataStrip({ lead }: { lead: Lead }) {
  const status = toDisplayStatus(lead);
  const src = lead.lead_source ?? "Unknown";
  const sc = sourceColorMap[src] ?? { color: "var(--t2)", bg: "var(--s2)" };
  const phone = lead.phone ?? "—";
  const address = lead.property_address ?? "—";
  const city = [lead.city, lead.state].filter(Boolean).join(", ") || "TX";

  return (
    <div
      style={{
        borderBottom: "1px solid var(--b0)",
        background: "var(--s1)",
        padding: "14px 20px",
        display: "flex",
        alignItems: "center",
        gap: 18,
        flexWrap: "nowrap",
        overflow: "hidden",
      }}
    >
      <Avatar lead={lead} size={36} />

      <div style={{ minWidth: 0, flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span
            style={{
              fontSize: 14,
              fontWeight: 600,
              color: "var(--t1)",
              letterSpacing: "-0.01em",
              whiteSpace: "nowrap",
            }}
          >
            {lead.first_name} {lead.last_name}
          </span>
          <StatusBadge status={status} />
        </div>
        <div
          style={{
            fontSize: 11,
            fontFamily: "var(--font-mono)",
            color: "var(--t3)",
            marginTop: 2,
          }}
        >
          {phone}
        </div>
      </div>

      <div style={{ width: 1, height: 30, background: "var(--b0)", flexShrink: 0 }} />

      {/* Address */}
      <div style={{ display: "flex", flexDirection: "column", gap: 2, flexShrink: 0 }}>
        <span
          style={{
            fontSize: 9,
            fontFamily: "var(--font-mono)",
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            color: "var(--t3)",
          }}
        >
          Address
        </span>
        <span style={{ fontSize: 12.5, fontWeight: 500, color: "var(--t1)", whiteSpace: "nowrap" }}>
          {address}{" "}
          <span style={{ color: "var(--t3)", fontWeight: 400 }}>· {city}</span>
        </span>
      </div>

      {/* Motivation */}
      <div style={{ display: "flex", flexDirection: "column", gap: 2, flexShrink: 0 }}>
        <span
          style={{
            fontSize: 9,
            fontFamily: "var(--font-mono)",
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            color: "var(--t3)",
          }}
        >
          Motivation
        </span>
        <span
          style={{
            fontSize: 12.5,
            fontFamily: "var(--font-mono)",
            fontWeight: 500,
            color: "var(--g)",
            whiteSpace: "nowrap",
          }}
        >
          {lead.motivation_score}%
        </span>
      </div>

      {/* Right actions */}
      <div
        style={{
          marginLeft: "auto",
          display: "flex",
          alignItems: "center",
          gap: 8,
          flexShrink: 0,
        }}
      >
        <span
          style={{
            fontSize: 10,
            fontFamily: "var(--font-mono)",
            fontWeight: 500,
            background: sc.bg,
            color: sc.color,
            border: `1px solid ${sc.bg}`,
            padding: "3px 8px",
            borderRadius: 4,
            whiteSpace: "nowrap",
          }}
        >
          {src}
        </span>
        <button className="icon-btn" style={iconBtn} title="Call">
          <Phone size={13} />
        </button>
        <button className="icon-btn" style={iconBtn} title="Notes">
          <StickyNote size={13} />
        </button>
        <Link href={`/leads/${lead.id}`} style={{ ...iconBtn, textDecoration: "none" }} title="Lead detail">
          <ExternalLink size={13} />
        </Link>
        <button className="icon-btn" style={iconBtn} title="More">
          <MoreHorizontal size={13} />
        </button>
      </div>
    </div>
  );
}

// ── Chat thread ──────────────────────────────────────────────────────────────

function Bubble({ msg }: { msg: Message }) {
  const isOut = msg.direction === "outbound";
  const time = new Date(msg.created_at).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
  return (
    <div
      className="bubble"
      style={{
        display: "flex",
        justifyContent: isOut ? "flex-end" : "flex-start",
        padding: "0 4px",
      }}
    >
      <div
        style={{
          maxWidth: "72%",
          display: "flex",
          flexDirection: "column",
          gap: 4,
          alignItems: isOut ? "flex-end" : "flex-start",
        }}
      >
        <div
          style={{
            background: isOut ? "var(--g)" : "var(--s2)",
            color: isOut ? "#0a1812" : "var(--t1)",
            borderRadius: isOut ? "14px 14px 4px 14px" : "14px 14px 14px 4px",
            padding: "9px 13px",
            fontSize: 13,
            lineHeight: 1.45,
            letterSpacing: "-0.005em",
            border: isOut ? "none" : "1px solid var(--b0)",
            whiteSpace: "pre-wrap",
            overflowWrap: "break-word",
            wordBreak: "break-word",
          }}
        >
          {msg.body}
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 5,
            padding: "0 4px",
          }}
        >
          <span
            style={{
              fontSize: 9.5,
              fontFamily: "var(--font-mono)",
              color: "var(--t3)",
            }}
          >
            {time}
          </span>
          {isOut && <CheckCheck size={11} style={{ color: "var(--g)" }} />}
        </div>
      </div>
    </div>
  );
}

function DateDivider({ label }: { label: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0" }}>
      <div style={{ flex: 1, height: 1, background: "var(--b0)" }} />
      <span
        style={{
          fontSize: 9.5,
          fontFamily: "var(--font-mono)",
          color: "var(--t3)",
          textTransform: "uppercase",
          letterSpacing: "0.08em",
        }}
      >
        {label}
      </span>
      <div style={{ flex: 1, height: 1, background: "var(--b0)" }} />
    </div>
  );
}

function ChatThread({
  lead,
  messages,
}: {
  lead: Lead;
  messages: Message[];
}) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Group messages by date
  const grouped: Array<{ divider: string } | { msg: Message }> = [];
  let lastDay = "";
  const sorted = [...messages].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );
  for (const m of sorted) {
    const d = new Date(m.created_at);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    let day: string;
    if (d.toDateString() === today.toDateString()) day = "Today";
    else if (d.toDateString() === yesterday.toDateString()) day = "Yesterday";
    else day = d.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });

    if (day !== lastDay) {
      grouped.push({ divider: day });
      lastDay = day;
    }
    grouped.push({ msg: m });
  }

  return (
    <div
      ref={scrollRef}
      style={{
        flex: 1,
        minWidth: 0,
        minHeight: 0,
        overflowY: "auto",
        overflowX: "hidden",
        background: "var(--bg)",
        padding: "16px 28px 12px",
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      {messages.length === 0 ? (
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            color: "var(--t3)",
          }}
        >
          <MessageSquare size={28} style={{ opacity: 0.4 }} />
          <div style={{ fontSize: 12 }}>
            No messages yet with {lead.first_name}.
          </div>
          <div style={{ fontSize: 11, fontFamily: "var(--font-mono)" }}>
            Use a quick reply below to start.
          </div>
        </div>
      ) : (
        grouped.map((g, i) =>
          "divider" in g ? (
            <DateDivider key={"d" + i} label={g.divider} />
          ) : (
            <Bubble key={g.msg.id} msg={g.msg} />
          )
        )
      )}
    </div>
  );
}

// ── AI Draft ─────────────────────────────────────────────────────────────────

function AIDraft({
  lead,
  onApprove,
}: {
  lead: Lead;
  onApprove: (text: string) => void;
}) {
  const draft = `Hey ${lead.first_name} — confirming 2pm at ${lead.property_address}. I'll have the contract printed; if the number works we can sign on the spot. Sound good?`;
  return (
    <div
      style={{
        background:
          "linear-gradient(180deg, rgba(176,139,255,0.07), rgba(176,139,255,0.02))",
        border: "1px solid rgba(176,139,255,0.20)",
        borderRadius: 8,
        padding: "10px 12px",
        display: "flex",
        alignItems: "flex-start",
        gap: 10,
      }}
    >
      <span
        style={{
          fontSize: 9,
          fontFamily: "var(--font-mono)",
          fontWeight: 600,
          letterSpacing: "0.07em",
          background: "var(--purb)",
          color: "var(--pur)",
          padding: "2px 7px",
          borderRadius: 99,
          flexShrink: 0,
          marginTop: 1,
        }}
      >
        AI · DRAFT
      </span>
      <div style={{ flex: 1, fontSize: 12, color: "var(--t1)", lineHeight: 1.5 }}>
        {draft}
      </div>
      <button
        onClick={() => onApprove(draft)}
        style={{
          fontSize: 11,
          fontWeight: 600,
          background: "var(--g)",
          color: "#0a1812",
          border: "none",
          borderRadius: 5,
          padding: "5px 10px",
          cursor: "pointer",
          fontFamily: "inherit",
          flexShrink: 0,
        }}
      >
        Use
      </button>
    </div>
  );
}

// ── Composer ─────────────────────────────────────────────────────────────────

function Composer({
  lead,
  onSend,
  sending,
}: {
  lead: Lead;
  onSend: (text: string) => Promise<void>;
  sending: boolean;
}) {
  const [text, setText] = useState("");

  const apply = (template: string) => {
    setText(
      template
        .replace("{first}", lead.first_name)
        .replace("{address}", lead.property_address ?? "the property")
    );
  };

  const handleSend = async () => {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    await onSend(trimmed);
    setText("");
  };

  const segments = Math.ceil(text.length / 160) || 1;

  return (
    <div
      style={{
        borderTop: "1px solid var(--b0)",
        background: "var(--s1)",
        padding: "12px 20px 14px",
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      <AIDraft lead={lead} onApprove={(d) => setText(d)} />

      {/* Quick replies */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        <span
          style={{
            fontSize: 9.5,
            fontFamily: "var(--font-mono)",
            textTransform: "uppercase",
            letterSpacing: "0.07em",
            color: "var(--t3)",
            alignSelf: "center",
            marginRight: 2,
          }}
        >
          Quick
        </span>
        {QUICK_REPLIES.map((q) => (
          <button
            key={q.label}
            className="quick-chip"
            onClick={() => apply(q.text)}
            style={{
              fontSize: 11,
              fontWeight: 500,
              background: "var(--bg)",
              border: "1px solid var(--b1)",
              color: "var(--t2)",
              borderRadius: 99,
              padding: "4px 11px",
              cursor: "pointer",
              fontFamily: "inherit",
              transition: "all .12s",
            }}
          >
            {q.label}
          </button>
        ))}
      </div>

      {/* Compose row */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          gap: 8,
          background: "var(--bg)",
          border: "1px solid var(--b1)",
          borderRadius: 8,
          padding: "8px 8px 8px 12px",
        }}
      >
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void handleSend();
            }
          }}
          placeholder={`Message ${lead.first_name}…`}
          rows={1}
          style={{
            flex: 1,
            background: "transparent",
            border: "none",
            color: "var(--t1)",
            fontSize: 13,
            fontFamily: "inherit",
            resize: "none",
            lineHeight: 1.45,
            maxHeight: 140,
            padding: "4px 0",
          }}
        />
        <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
          <button className="icon-btn" style={{ ...iconBtn, border: "none" }} title="Attach">
            <Paperclip size={13} />
          </button>
          <button className="icon-btn" style={{ ...iconBtn, border: "none" }} title="Template">
            <FileText size={13} />
          </button>
          <button className="icon-btn" style={{ ...iconBtn, border: "none" }} title="Schedule send">
            <Clock size={13} />
          </button>
          <button
            className="send-btn"
            onClick={() => void handleSend()}
            disabled={!text.trim() || sending}
            style={{
              height: 30,
              padding: "0 12px",
              borderRadius: 6,
              background: text.trim() ? "var(--g)" : "var(--s2)",
              color: text.trim() ? "#0a1812" : "var(--t3)",
              border: "none",
              fontSize: 12,
              fontWeight: 600,
              fontFamily: "inherit",
              cursor: text.trim() && !sending ? "pointer" : "not-allowed",
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
              transition: "all .12s",
              marginLeft: 4,
              opacity: sending ? 0.6 : 1,
            }}
          >
            {sending ? "Sending…" : "Send"}
            {!sending && <Send size={11} />}
          </button>
        </div>
      </div>

      {/* Footer */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          fontSize: 10,
          fontFamily: "var(--font-mono)",
          color: "var(--t3)",
        }}
      >
        <span>
          {text.length}/160 chars · {segments} segment{segments !== 1 ? "s" : ""}
        </span>
        <span>
          Sending from{" "}
          <span style={{ color: "var(--g)" }}>+1 (713) 565-0807</span> · A2P
          registered
        </span>
      </div>
    </div>
  );
}

// ── Main client ──────────────────────────────────────────────────────────────

interface MessengerClientProps {
  initialLeads: Lead[];
  initialMessages: Message[];
  userId: string;
}

export function MessengerClient({
  initialLeads,
  initialMessages,
}: MessengerClientProps) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [selectedId, setSelectedId] = useState<string>(initialLeads[0]?.id ?? "");
  const [sending, setSending] = useState(false);

  // Build convo items: leads sorted by latest message desc
  const convoItems: ConvoItem[] = useMemo(() => {
    const msgByLead = new Map<string, Message[]>();
    for (const m of messages) {
      if (!m.lead_id) continue;
      if (!msgByLead.has(m.lead_id)) msgByLead.set(m.lead_id, []);
      msgByLead.get(m.lead_id)!.push(m);
    }

    return initialLeads
      .map((lead) => {
        const threadMsgs = (msgByLead.get(lead.id) ?? []).sort(
          (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );
        const latestMessage = threadMsgs[threadMsgs.length - 1] ?? null;
        const unread = latestMessage?.direction === "inbound" &&
          (!lead.last_contacted_at || new Date(latestMessage.created_at) > new Date(lead.last_contacted_at));
        return {
          lead,
          latestMessage,
          unread,
          status: toDisplayStatus(lead),
        };
      })
      .sort((a, b) => {
        const at = a.latestMessage?.created_at ?? a.lead.created_at;
        const bt = b.latestMessage?.created_at ?? b.lead.created_at;
        return new Date(bt).getTime() - new Date(at).getTime();
      });
  }, [initialLeads, messages]);

  const totalUnread = convoItems.filter((i) => i.unread).length;

  const selectedLead = useMemo(
    () => initialLeads.find((l) => l.id === selectedId) ?? initialLeads[0],
    [initialLeads, selectedId]
  );

  const threadMessages = useMemo(
    () =>
      messages
        .filter((m) => m.lead_id === selectedId)
        .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()),
    [messages, selectedId]
  );

  const handleSend = useCallback(
    async (text: string) => {
      if (!selectedLead) return;
      setSending(true);
      try {
        const res = await fetch("/api/telnyx/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            to: selectedLead.phone,
            message: text,
            lead_id: selectedLead.id,
          }),
        });
        if (res.ok) {
          // Optimistically add the message to the thread
          const optimistic: Message = {
            id: crypto.randomUUID(),
            body: text,
            direction: "outbound",
            created_at: new Date().toISOString(),
            lead_id: selectedLead.id,
            phone: selectedLead.phone,
            to_number: selectedLead.phone,
            user_id: null,
            classification: null,
            status: "queued",
            telnyx_message_id: null,
          };
          setMessages((prev) => [...prev, optimistic]);
        }
      } finally {
        setSending(false);
      }
    },
    [selectedLead]
  );

  if (!selectedLead) {
    return (
      <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
        <Topbar page="Messenger" />
        <div
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "var(--t3)",
            fontSize: 13,
          }}
        >
          No leads yet. Import contacts to get started.
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
      <Topbar page="Messenger" />

      <div
        style={{
          flex: 1,
          display: "flex",
          minHeight: 0,
          background: "var(--bg)",
        }}
      >
        <ConversationList
          items={convoItems}
          selectedId={selectedId}
          onSelect={setSelectedId}
          totalUnread={totalUnread}
        />

        <section
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            minWidth: 0,
            minHeight: 0,
            background: "var(--bg)",
          }}
        >
          <MetadataStrip lead={selectedLead} />
          <ChatThread lead={selectedLead} messages={threadMessages} />
          <Composer lead={selectedLead} onSend={handleSend} sending={sending} />
        </section>
      </div>

      <style>{`
        .convo-row:hover { background: var(--s2); }
        .convo-row.active { background: var(--s3); }
        .convo-row.active .convo-name { color: var(--t1); }
        .icon-btn { transition: background .12s, color .12s; }
        .icon-btn:hover { background: var(--s2); color: var(--t1); }
        .send-btn:hover { filter: brightness(1.08); }
        .send-btn:active { transform: scale(0.97); }
        .quick-chip:hover {
          background: var(--gd);
          border-color: var(--gb);
          color: var(--g);
        }
        .bubble { animation: fadeIn 0.22s ease-out both; }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(4px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
