"use client";

import { useMemo, useState } from "react";
import { format } from "date-fns";
import {
  Search,
  X,
  MapPin,
  Mail,
  User,
  MessageSquare,
} from "lucide-react";

import type { Database } from "@/types/database";
import {
  leadDisplayName,
  formatPhoneDisplay,
  streetOnly,
} from "@/lib/utils";

type Lead = Database["public"]["Tables"]["leads"]["Row"];
type Message = Database["public"]["Tables"]["messages"]["Row"];

type FilterPill = "all" | "HOT" | "WARM" | "COLD" | "NEW";

interface ContactsClientProps {
  initialLeads: Lead[];
  initialMessages: Message[];
}

// ── Avatar ───────────────────────────────────────────────────────────────────

const AVATAR_COLORS: Record<string, [string, string]> = {
  HOT:     ["#3a1d22", "var(--red)"],
  WARM:    ["#3a2a14", "var(--amb)"],
  COLD:    ["#1e242c", "var(--t3)"],
  DEAD:    ["#1e242c", "var(--t3)"],
  OPT_OUT: ["#2a1a2a", "var(--pur)"],
  UNKNOWN: ["#141b2a", "var(--blu)"],
};

function Avatar({ lead }: { lead: Lead }) {
  const initials =
    ((lead.first_name?.[0] ?? "") + (lead.last_name?.[0] ?? "")).toUpperCase() || "?";
  const [bg, color] = AVATAR_COLORS[lead.classification] ?? ["#141b2a", "var(--blu)"];
  return (
    <div
      style={{
        width: 30,
        height: 30,
        borderRadius: 7,
        background: bg,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}
    >
      <span
        style={{
          fontSize: 11,
          fontWeight: 600,
          color,
          fontFamily: "var(--font-mono)",
        }}
      >
        {initials}
      </span>
    </div>
  );
}

// ── Status badge ─────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<string, { bg: string; color: string }> = {
  New:       { bg: "var(--gd)",   color: "var(--g)"   },
  Contacted: { bg: "var(--blud)", color: "var(--blu)"  },
  Replied:   { bg: "var(--ambd)", color: "var(--amb)"  },
  Hot:       { bg: "var(--redd)", color: "var(--red)"  },
  Dead:      { bg: "var(--b1)",   color: "var(--t3)"   },
  DNC:       { bg: "var(--redd)", color: "var(--red)"  },
};

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_STYLES[status] ?? { bg: "var(--b1)", color: "var(--t3)" };
  return (
    <span
      style={{
        fontSize: 10,
        fontWeight: 500,
        padding: "2px 7px",
        borderRadius: 4,
        background: s.bg,
        color: s.color,
        fontFamily: "var(--font-mono)",
        whiteSpace: "nowrap",
      }}
    >
      {status}
    </span>
  );
}

// ── Classification chip ───────────────────────────────────────────────────────

const CLASS_STYLES: Record<string, { bg: string; color: string }> = {
  HOT:     { bg: "var(--redd)", color: "var(--red)"  },
  WARM:    { bg: "var(--ambd)", color: "var(--amb)"  },
  COLD:    { bg: "var(--blud)", color: "var(--blu)"  },
  DEAD:    { bg: "var(--b1)",   color: "var(--t3)"   },
  OPT_OUT: { bg: "var(--purd)", color: "var(--pur)"  },
};

function ClassChip({ cls }: { cls: string }) {
  if (!cls || cls === "UNKNOWN") return null;
  const s = CLASS_STYLES[cls] ?? { bg: "var(--b1)", color: "var(--t3)" };
  return (
    <span
      style={{
        fontSize: 9,
        fontWeight: 600,
        padding: "1px 5px",
        borderRadius: 3,
        background: s.bg,
        color: s.color,
        fontFamily: "var(--font-mono)",
      }}
    >
      {cls === "OPT_OUT" ? "STOP" : cls}
    </span>
  );
}

// ── Drawer info row ───────────────────────────────────────────────────────────

function InfoRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
      <span style={{ color: "var(--t3)", marginTop: 1, flexShrink: 0 }}>{icon}</span>
      <span
        style={{
          fontSize: 11,
          color: "var(--t3)",
          flexShrink: 0,
          minWidth: 54,
          marginTop: 1,
        }}
      >
        {label}
      </span>
      <span style={{ fontSize: 12, color: "var(--t2)", wordBreak: "break-word" }}>
        {value}
      </span>
    </div>
  );
}

// ── Main client ───────────────────────────────────────────────────────────────

export function ContactsClient({
  initialLeads,
  initialMessages,
}: ContactsClientProps) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterPill>("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [drawerLead, setDrawerLead] = useState<Lead | null>(null);

  // Group messages by lead_id, sorted oldest-first for chat display
  const messagesByLead = useMemo(() => {
    const map = new Map<string, Message[]>();
    for (const msg of initialMessages) {
      if (!msg.lead_id) continue;
      const list = map.get(msg.lead_id) ?? [];
      list.push(msg);
      map.set(msg.lead_id, list);
    }
    for (const [k, v] of map) {
      map.set(k, [...v].sort((a, b) => a.created_at.localeCompare(b.created_at)));
    }
    return map;
  }, [initialMessages]);

  const filtered = useMemo(() => {
    let leads = initialLeads;

    if (filter === "HOT") leads = leads.filter((l) => l.classification === "HOT");
    else if (filter === "WARM") leads = leads.filter((l) => l.classification === "WARM");
    else if (filter === "COLD")
      leads = leads.filter(
        (l) =>
          l.classification === "COLD" ||
          l.classification === "DEAD" ||
          l.classification === "OPT_OUT"
      );
    else if (filter === "NEW") leads = leads.filter((l) => l.status === "New");

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      leads = leads.filter(
        (l) =>
          leadDisplayName(l).toLowerCase().includes(q) ||
          l.phone.includes(q) ||
          (l.property_address ?? "").toLowerCase().includes(q) ||
          (l.city ?? "").toLowerCase().includes(q)
      );
    }

    return leads;
  }, [initialLeads, filter, search]);

  function toggleSelect(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (selectedIds.size === filtered.length && filtered.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map((l) => l.id)));
    }
  }

  async function sendBulkSms() {
    const ids = [...selectedIds];
    const msg = window.prompt(`SMS message to send to ${ids.length} contact(s):`);
    if (!msg?.trim()) return;
    try {
      await fetch("/api/send-bulk-sms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadIds: ids, message: msg }),
      });
      setSelectedIds(new Set());
    } catch (err) {
      console.error("bulk SMS failed", err);
    }
  }

  const allSelected = filtered.length > 0 && selectedIds.size === filtered.length;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        background: "var(--bg)",
        overflow: "hidden",
      }}
    >
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div
        style={{
          background: "var(--s1)",
          borderBottom: "1px solid var(--b1)",
          padding: "12px 20px",
          flexShrink: 0,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 15, fontWeight: 600, color: "var(--t1)", flex: 1 }}>
            Contacts{" "}
            <span
              style={{
                fontSize: 11,
                fontWeight: 400,
                color: "var(--t3)",
                fontFamily: "var(--font-mono)",
              }}
            >
              {initialLeads.length}
            </span>
          </span>

          {selectedIds.size > 0 && (
            <button
              onClick={sendBulkSms}
              style={{
                fontSize: 12,
                fontWeight: 500,
                padding: "5px 12px",
                borderRadius: 6,
                background: "var(--g)",
                color: "#000",
                border: "none",
                cursor: "pointer",
              }}
            >
              SMS {selectedIds.size} selected
            </button>
          )}

          <div style={{ position: "relative" }}>
            <Search
              size={13}
              style={{
                position: "absolute",
                left: 9,
                top: "50%",
                transform: "translateY(-50%)",
                color: "var(--t3)",
                pointerEvents: "none",
              }}
            />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search contacts…"
              style={{
                paddingLeft: 28,
                paddingRight: 10,
                paddingTop: 6,
                paddingBottom: 6,
                fontSize: 12.5,
                borderRadius: 6,
                border: "1px solid var(--b1)",
                background: "var(--s2)",
                color: "var(--t1)",
                width: 200,
                outline: "none",
              }}
            />
          </div>
        </div>

        {/* Filter pills */}
        <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
          {(["all", "HOT", "WARM", "COLD", "NEW"] as FilterPill[]).map((pill) => (
            <button
              key={pill}
              onClick={() => setFilter(pill)}
              style={{
                fontSize: 11,
                fontWeight: 500,
                padding: "3px 10px",
                borderRadius: 99,
                border:
                  filter === pill ? "1px solid var(--b2)" : "1px solid var(--b1)",
                background: filter === pill ? "var(--s3)" : "transparent",
                color: filter === pill ? "var(--t1)" : "var(--t3)",
                cursor: "pointer",
                fontFamily: "var(--font-mono)",
                transition: "all 0.1s",
              }}
            >
              {pill === "all" ? "All" : pill}
            </button>
          ))}
        </div>
      </div>

      {/* ── Table ──────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, overflow: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
          <thead>
            <tr
              style={{
                background: "var(--s1)",
                borderBottom: "1px solid var(--b1)",
                position: "sticky",
                top: 0,
                zIndex: 1,
              }}
            >
              <th style={{ width: 36, padding: "8px 12px", textAlign: "left" }}>
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleAll}
                  style={{ cursor: "pointer" }}
                />
              </th>
              {[
                "Name",
                "Phone",
                "Property",
                "Location",
                "Source",
                "Status",
                "Last Contact",
              ].map((h) => (
                <th
                  key={h}
                  style={{
                    padding: "8px 12px",
                    textAlign: "left",
                    fontWeight: 500,
                    color: "var(--t3)",
                    fontSize: 10.5,
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                    whiteSpace: "nowrap",
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td
                  colSpan={8}
                  style={{
                    padding: "48px 20px",
                    textAlign: "center",
                    color: "var(--t3)",
                    fontSize: 13,
                  }}
                >
                  {search || filter !== "all"
                    ? "No contacts match this filter."
                    : "No contacts yet. Import a CSV to get started."}
                </td>
              </tr>
            )}
            {filtered.map((lead, i) => (
              <tr
                key={lead.id}
                onClick={() => setDrawerLead(lead)}
                style={{
                  borderBottom: "1px solid var(--b0)",
                  background: selectedIds.has(lead.id)
                    ? "var(--gd)"
                    : i % 2 === 0
                    ? "var(--bg)"
                    : "var(--s1)",
                  cursor: "pointer",
                  transition: "background 0.08s",
                }}
              >
                <td
                  style={{ padding: "7px 12px" }}
                  onClick={(e) => toggleSelect(lead.id, e)}
                >
                  <input
                    type="checkbox"
                    checked={selectedIds.has(lead.id)}
                    onChange={() => {}}
                    style={{ cursor: "pointer" }}
                  />
                </td>
                <td style={{ padding: "7px 12px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                    <Avatar lead={lead} />
                    <div>
                      <div
                        style={{
                          fontWeight: 500,
                          color: "var(--t1)",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {leadDisplayName(lead)}
                      </div>
                      <ClassChip cls={lead.classification} />
                    </div>
                  </div>
                </td>
                <td
                  style={{
                    padding: "7px 12px",
                    color: "var(--t2)",
                    fontFamily: "var(--font-mono)",
                    fontSize: 11.5,
                    whiteSpace: "nowrap",
                  }}
                >
                  {formatPhoneDisplay(lead.phone)}
                </td>
                <td
                  style={{
                    padding: "7px 12px",
                    color: "var(--t2)",
                    maxWidth: 180,
                  }}
                >
                  <span
                    style={{
                      display: "block",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {streetOnly(lead.property_address) || "—"}
                  </span>
                </td>
                <td
                  style={{
                    padding: "7px 12px",
                    color: "var(--t3)",
                    whiteSpace: "nowrap",
                    fontSize: 12,
                  }}
                >
                  {[lead.city, lead.state].filter(Boolean).join(", ") || "—"}
                </td>
                <td
                  style={{
                    padding: "7px 12px",
                    color: "var(--t3)",
                    whiteSpace: "nowrap",
                    fontSize: 12,
                  }}
                >
                  {lead.lead_source || "—"}
                </td>
                <td style={{ padding: "7px 12px" }}>
                  <StatusBadge status={lead.status} />
                </td>
                <td
                  style={{
                    padding: "7px 12px",
                    color: "var(--t3)",
                    whiteSpace: "nowrap",
                    fontFamily: "var(--font-mono)",
                    fontSize: 11,
                  }}
                >
                  {lead.last_contacted_at
                    ? format(new Date(lead.last_contacted_at), "MMM d, yyyy")
                    : "Never"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── Side Drawer ─────────────────────────────────────────────────── */}
      {drawerLead && (
        <>
          <div
            onClick={() => setDrawerLead(null)}
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.35)",
              zIndex: 40,
            }}
          />
          <div
            style={{
              position: "fixed",
              right: 0,
              top: 0,
              bottom: 0,
              width: 400,
              background: "var(--s1)",
              borderLeft: "1px solid var(--b1)",
              zIndex: 41,
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}
          >
            {/* Drawer header */}
            <div
              style={{
                padding: "13px 16px",
                borderBottom: "1px solid var(--b1)",
                display: "flex",
                alignItems: "center",
                gap: 10,
                flexShrink: 0,
              }}
            >
              <Avatar lead={drawerLead} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontWeight: 600,
                    color: "var(--t1)",
                    fontSize: 14,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {leadDisplayName(drawerLead)}
                </div>
                <div
                  style={{
                    fontSize: 11,
                    color: "var(--t3)",
                    fontFamily: "var(--font-mono)",
                    marginTop: 2,
                  }}
                >
                  {formatPhoneDisplay(drawerLead.phone)}
                </div>
              </div>
              <button
                onClick={() => setDrawerLead(null)}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "var(--t3)",
                  padding: 4,
                  flexShrink: 0,
                }}
              >
                <X size={16} />
              </button>
            </div>

            {/* Lead info */}
            <div
              style={{
                padding: "12px 16px",
                borderBottom: "1px solid var(--b1)",
                display: "flex",
                flexDirection: "column",
                gap: 8,
                flexShrink: 0,
              }}
            >
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                <StatusBadge status={drawerLead.status} />
                <ClassChip cls={drawerLead.classification} />
              </div>
              <InfoRow
                icon={<MapPin size={12} />}
                label="Property"
                value={drawerLead.property_address || "—"}
              />
              {(drawerLead.city || drawerLead.state) && (
                <InfoRow
                  icon={<MapPin size={12} />}
                  label="Location"
                  value={
                    [drawerLead.city, drawerLead.state].filter(Boolean).join(", ") ||
                    "—"
                  }
                />
              )}
              {drawerLead.email && (
                <InfoRow
                  icon={<Mail size={12} />}
                  label="Email"
                  value={drawerLead.email}
                />
              )}
              {drawerLead.lead_source && (
                <InfoRow
                  icon={<User size={12} />}
                  label="Source"
                  value={drawerLead.lead_source}
                />
              )}
              <InfoRow
                icon={<MessageSquare size={12} />}
                label="Added"
                value={format(new Date(drawerLead.created_at), "MMM d, yyyy")}
              />
              {drawerLead.notes_summary && (
                <div
                  style={{
                    padding: "8px 10px",
                    borderRadius: 6,
                    background: "var(--s2)",
                    fontSize: 12,
                    color: "var(--t2)",
                    lineHeight: 1.5,
                    border: "1px solid var(--b1)",
                  }}
                >
                  {drawerLead.notes_summary}
                </div>
              )}
            </div>

            {/* Message history */}
            <div
              style={{
                flex: 1,
                overflow: "auto",
                padding: "12px 16px",
                display: "flex",
                flexDirection: "column",
                gap: 8,
              }}
            >
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  color: "var(--t3)",
                  marginBottom: 4,
                }}
              >
                Message History
              </div>
              {(messagesByLead.get(drawerLead.id) ?? []).length === 0 ? (
                <div
                  style={{
                    color: "var(--t3)",
                    fontSize: 12,
                    textAlign: "center",
                    padding: "24px 0",
                  }}
                >
                  No messages yet
                </div>
              ) : (
                (messagesByLead.get(drawerLead.id) ?? []).map((msg) => (
                  <div
                    key={msg.id}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems:
                        msg.direction === "outbound" ? "flex-end" : "flex-start",
                    }}
                  >
                    <div
                      style={{
                        maxWidth: "82%",
                        padding: "7px 11px",
                        borderRadius:
                          msg.direction === "outbound"
                            ? "12px 12px 2px 12px"
                            : "12px 12px 12px 2px",
                        background:
                          msg.direction === "outbound"
                            ? "var(--t1)"
                            : "var(--s2)",
                        color:
                          msg.direction === "outbound"
                            ? "var(--bg)"
                            : "var(--t1)",
                        fontSize: 12.5,
                        lineHeight: 1.5,
                        border:
                          msg.direction === "inbound"
                            ? "1px solid var(--b1)"
                            : "none",
                      }}
                    >
                      {msg.body}
                    </div>
                    <div
                      style={{
                        fontSize: 10,
                        color: "var(--t3)",
                        marginTop: 3,
                        fontFamily: "var(--font-mono)",
                      }}
                    >
                      {format(new Date(msg.created_at), "MMM d, h:mm a")}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Open lead footer */}
            <div
              style={{
                padding: "12px 16px",
                borderTop: "1px solid var(--b1)",
                flexShrink: 0,
              }}
            >
              <a
                href={`/leads/${drawerLead.id}`}
                style={{
                  display: "block",
                  textAlign: "center",
                  padding: "8px",
                  borderRadius: 6,
                  background: "var(--t1)",
                  color: "var(--bg)",
                  fontSize: 13,
                  fontWeight: 500,
                  textDecoration: "none",
                }}
              >
                Open Full Lead
              </a>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
