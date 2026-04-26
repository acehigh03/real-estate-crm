"use client";

import {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from "react";
import { format } from "date-fns";
import {
  Phone,
  MoreHorizontal,
  Plus,
  Search,
  Calendar,
  Clock,
  DollarSign,
  Home,
  Send,
  Users,
  MessageSquare,
  Flame,
} from "lucide-react";

import { createClient } from "@/lib/supabase/browser";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { Database, LeadStatus } from "@/types/database";

type Lead = Database["public"]["Tables"]["leads"]["Row"];
type Message = Database["public"]["Tables"]["messages"]["Row"];

/* ─── Types ─────────────────────────────────────────────── */
interface ConversationData {
  lead: Lead;
  messages: Message[];
  lastMessage: Message | null;
  unread: boolean;
}

/* ─── Helpers ────────────────────────────────────────────── */
function initials(lead: Lead) {
  return `${lead.first_name[0] ?? ""}${lead.last_name[0] ?? ""}`.toUpperCase();
}

function avatarBg(name: string) {
  const colors = [
    "#16a37f",
    "#2563eb",
    "#7c3aed",
    "#db2777",
    "#d97706",
    "#0891b2",
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

function statusTag(status: LeadStatus) {
  const styles: Record<string, { bg: string; color: string }> = {
    Hot: { bg: "#fff0eb", color: "#b84a1e" },
    New: { bg: "#eff5ff", color: "#2c5fbd" },
    Contacted: { bg: "#edfaf3", color: "#166b47" },
    Replied: { bg: "#edfaf3", color: "#166b47" },
    Dead: { bg: "#f4f4f4", color: "#888" },
    DNC: { bg: "#f4f4f4", color: "#888" },
  };
  const s = styles[status] ?? { bg: "#f4f4f4", color: "#888" };
  return (
    <span
      className="inline-flex items-center rounded-full px-1.5 py-0.5 font-mono text-[8px] font-medium uppercase tracking-wider"
      style={{ background: s.bg, color: s.color }}
    >
      {status}
    </span>
  );
}

function scoreFromStatus(status: LeadStatus): number {
  switch (status) {
    case "Hot": return 92;
    case "Replied": return 78;
    case "Contacted": return 65;
    case "New": return 55;
    case "Dead": return 25;
    case "DNC": return 10;
    default: return 0;
  }
}

/* ─── Quick-reply presets ────────────────────────────────── */
const QUICK_REPLIES = [
  {
    icon: Calendar,
    label: "Schedule call",
    text: "Would you be available for a quick 10-minute call this week?",
  },
  {
    icon: Clock,
    label: "Timeline",
    text: "What's your ideal timeline for selling the property?",
  },
  {
    icon: DollarSign,
    label: "Send offer",
    text: "Based on our analysis, we'd like to make you an offer. Is now a good time to discuss?",
  },
  {
    icon: Home,
    label: "Property details",
    text: "Could you share more details about the property condition and any recent updates?",
  },
];

/* ─── Typing dots ────────────────────────────────────────── */
function TypingIndicator() {
  return (
    <div className="flex items-end gap-2">
      <div
        className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full text-[8px] font-bold text-white"
        style={{ background: "#94a3b8" }}
      >
        ···
      </div>
      <div
        className="flex items-center gap-1 rounded-[22px] rounded-bl-[4px] bg-white px-4 py-3 shadow-sm ring-1 ring-black/[0.06]"
      >
        <div className="typing-dot" />
        <div className="typing-dot" />
        <div className="typing-dot" />
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════ */
/*  Main component                                           */
/* ══════════════════════════════════════════════════════════ */
interface InboxClientProps {
  initialLeads: Lead[];
  initialMessages: Message[];
  userId: string;
}

export function InboxClient({
  initialLeads,
  initialMessages,
  userId,
}: InboxClientProps) {
  /* ── State ─────────────────────────────────────────────── */
  const [messagesByLead, setMessagesByLead] = useState<
    Record<string, Message[]>
  >(() => {
    const map: Record<string, Message[]> = {};
    for (const m of initialMessages) {
      if (m.lead_id) {
        map[m.lead_id] = [...(map[m.lead_id] ?? []), m];
      }
    }
    // Sort each array asc
    for (const id of Object.keys(map)) {
      map[id] = map[id].sort((a, b) =>
        a.created_at.localeCompare(b.created_at)
      );
    }
    return map;
  });

  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(
    initialLeads[0]?.id ?? null
  );
  const [activeTab, setActiveTab] = useState<"messages" | "notes" | "lead-info">(
    "messages"
  );
  const [composeText, setComposeText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [showTyping, setShowTyping] = useState(false);
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const composeRef = useRef<HTMLInputElement>(null);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* ── Supabase realtime ─────────────────────────────────── */
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("inbox-messages")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        (payload) => {
          const newMsg = payload.new as Message;
          if (!newMsg.lead_id) return;
          setMessagesByLead((prev) => {
            const existing = prev[newMsg.lead_id!] ?? [];
            // Avoid duplicates (optimistic id vs real id)
            const deduped = existing.filter(
              (m) =>
                m.id !== newMsg.id &&
                !(m.id.startsWith("temp-") && m.body === newMsg.body)
            );
            return {
              ...prev,
              [newMsg.lead_id!]: [...deduped, newMsg].sort((a, b) =>
                a.created_at.localeCompare(b.created_at)
              ),
            };
          });
          // Remove typing indicator when inbound arrives
          if (newMsg.direction === "inbound") {
            setShowTyping(false);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  /* ── Conversations list (sorted by latest message) ─────── */
  const conversations: ConversationData[] = useMemo(() => {
    return initialLeads
      .map((lead) => {
        const msgs = messagesByLead[lead.id] ?? [];
        const sorted = [...msgs].sort((a, b) =>
          a.created_at.localeCompare(b.created_at)
        );
        const lastMessage = sorted.at(-1) ?? null;
        return {
          lead,
          messages: sorted,
          lastMessage,
          unread: lastMessage?.direction === "inbound",
        };
      })
      .filter((c) => c.messages.length > 0)
      .sort((a, b) => {
        const ta = a.lastMessage?.created_at ?? "";
        const tb = b.lastMessage?.created_at ?? "";
        return tb.localeCompare(ta);
      });
  }, [initialLeads, messagesByLead]);

  const filtered = useMemo(() => {
    if (!search.trim()) return conversations;
    const q = search.toLowerCase();
    return conversations.filter((c) =>
      `${c.lead.first_name} ${c.lead.last_name}`.toLowerCase().includes(q)
    );
  }, [conversations, search]);

  const selectedConversation = useMemo(
    () =>
      filtered.find((c) => c.lead.id === selectedLeadId) ?? filtered[0] ?? null,
    [filtered, selectedLeadId]
  );

  /* ── Auto-scroll ───────────────────────────────────────── */
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [selectedLeadId, selectedConversation?.messages.length, showTyping]);

  /* ── Send message ──────────────────────────────────────── */
  const sendMessage = useCallback(async () => {
    if (!composeText.trim() || !selectedConversation || isSending) return;
    const text = composeText.trim();
    setComposeText("");
    setError(null);
    setIsSending(true);

    // Optimistic message
    const tempId = `temp-${Date.now()}`;
    const tempMsg: Message = {
      id: tempId,
      body: text,
      direction: "outbound",
      lead_id: selectedConversation.lead.id,
      created_at: new Date().toISOString(),
      user_id: userId,
      status: "sending",
      telnyx_message_id: null,
      to_number: selectedConversation.lead.phone_normalized,
    };
    setMessagesByLead((prev) => ({
      ...prev,
      [selectedConversation.lead.id]: [
        ...(prev[selectedConversation.lead.id] ?? []),
        tempMsg,
      ],
    }));

    // Show typing indicator after 600ms
    typingTimerRef.current = setTimeout(() => setShowTyping(true), 600);

    try {
      const res = await fetch("/api/telnyx/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: selectedConversation.lead.phone_normalized,
          message: text,
          lead_id: selectedConversation.lead.id,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Failed to send message.");
        // Roll back optimistic message
        setMessagesByLead((prev) => ({
          ...prev,
          [selectedConversation.lead.id]: (
            prev[selectedConversation.lead.id] ?? []
          ).filter((m) => m.id !== tempId),
        }));
      } else {
        // Remove typing after 1800ms
        setTimeout(() => setShowTyping(false), 1800);
      }
    } catch {
      setError("Network error. Please try again.");
      setMessagesByLead((prev) => ({
        ...prev,
        [selectedConversation.lead.id]: (
          prev[selectedConversation.lead.id] ?? []
        ).filter((m) => m.id !== tempId),
      }));
    } finally {
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      setIsSending(false);
    }
  }, [composeText, selectedConversation, isSending, userId]);

  /* ── Stats (across all leads/messages) ──────────────────── */
  const stats = useMemo(() => {
    const allMsgs = Object.values(messagesByLead).flat();
    return {
      leads: initialLeads.length,
      replies: allMsgs.filter((m) => m.direction === "inbound").length,
      hot: initialLeads.filter((l) => l.status === "Hot").length,
    };
  }, [initialLeads, messagesByLead]);

  const hasChatOpen = !!selectedConversation;

  /* ══════════════════════════════════════════════════════════
     Render
  ══════════════════════════════════════════════════════════ */
  return (
    <div className="flex h-full overflow-hidden bg-[#f7f6f4]">
      {/* ══ LEFT: Conversation list (218px) ════════════════════ */}
      <div
        className="flex h-full w-[218px] shrink-0 flex-col border-r border-[#e8e8e4] bg-white"
        style={{ transition: "opacity 120ms" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3">
          <span className="text-[14px] font-semibold">Inbox</span>
          <button
            type="button"
            className="flex h-6 w-6 items-center justify-center rounded-full text-white transition hover:opacity-90"
            style={{ background: "var(--green)" }}
            title="New conversation"
          >
            <Plus size={13} strokeWidth={2.5} />
          </button>
        </div>

        {/* Search */}
        <div className="px-3 pb-2">
          <div className="flex items-center gap-2 rounded-full bg-[#f5f5f5] px-3 py-1.5">
            <Search size={12} className="shrink-0 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-transparent text-[12px] text-foreground placeholder:text-muted-foreground"
              style={{
                outline: "none",
                border: "none",
              }}
            />
          </div>
        </div>

        {/* Conversation rows */}
        <div className="flex-1 overflow-y-auto">
          {filtered.length === 0 ? (
            <p className="px-4 py-8 text-center text-[12px] text-muted-foreground">
              No conversations yet.
            </p>
          ) : (
            filtered.map((c) => {
              const isSelected = c.lead.id === selectedConversation?.lead.id;
              const bg = avatarBg(`${c.lead.first_name} ${c.lead.last_name}`);
              const lastText = c.lastMessage?.body ?? "";
              const lastTime = c.lastMessage
                ? format(new Date(c.lastMessage.created_at), "h:mm a")
                : "";

              return (
                <button
                  key={c.lead.id}
                  type="button"
                  onClick={() => setSelectedLeadId(c.lead.id)}
                  className="group relative w-full text-left"
                  style={{ transition: "all 120ms" }}
                >
                  {/* 3px left border */}
                  <div
                    className="absolute left-0 top-0 h-full w-[3px] rounded-r"
                    style={{
                      background: isSelected ? "var(--green)" : "transparent",
                    }}
                  />

                  <div
                    className="flex items-start gap-2.5 px-4 py-3"
                    style={{
                      background: isSelected
                        ? "#edf9f5"
                        : c.unread
                        ? "#f5fbf9"
                        : "transparent",
                      opacity: hasChatOpen && !isSelected ? 0.7 : 1,
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected)
                        (e.currentTarget as HTMLDivElement).style.background =
                          "#f7f6f4";
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLDivElement).style.background =
                        isSelected
                          ? "#edf9f5"
                          : c.unread
                          ? "#f5fbf9"
                          : "transparent";
                    }}
                  >
                    {/* Avatar */}
                    <div
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full font-mono text-[10px] font-semibold text-white"
                      style={{ background: bg }}
                    >
                      {initials(c.lead)}
                    </div>

                    {/* Text */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-1">
                        <span
                          className="truncate text-[12px] leading-tight"
                          style={{
                            fontWeight: c.unread ? 600 : 500,
                          }}
                        >
                          {c.lead.first_name} {c.lead.last_name}
                        </span>
                        <span
                          className="shrink-0 font-mono text-[9px]"
                          style={{
                            color: c.unread ? "var(--green)" : "#94a3b8",
                          }}
                        >
                          {lastTime}
                        </span>
                      </div>

                      <div className="mt-0.5 flex items-center gap-1.5">
                        {statusTag(c.lead.status)}
                        {c.unread && (
                          <div
                            className="h-1.5 w-1.5 shrink-0 rounded-full"
                            style={{ background: "var(--green)" }}
                          />
                        )}
                      </div>

                      <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                        {lastText}
                      </p>
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* ══ RIGHT: Chat pane ════════════════════════════════════ */}
      <div className="flex flex-1 flex-col overflow-hidden bg-[#f7f6f4]">
        {selectedConversation ? (
          <>
            {/* ── Chat header ─────────────────────────────────── */}
            <div className="flex shrink-0 items-center gap-3 border-b border-[#e8e8e4] bg-white px-5 py-3">
              {/* Avatar */}
              <div
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full font-mono text-[11px] font-semibold text-white"
                style={{
                  background: avatarBg(
                    `${selectedConversation.lead.first_name} ${selectedConversation.lead.last_name}`
                  ),
                }}
              >
                {initials(selectedConversation.lead)}
              </div>

              {/* Name + meta */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[14px] font-semibold">
                    {selectedConversation.lead.first_name}{" "}
                    {selectedConversation.lead.last_name}
                  </span>
                  {statusTag(selectedConversation.lead.status)}
                </div>
                <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                  {selectedConversation.lead.property_address}
                  {" · Score "}
                  <span className="font-mono font-medium">
                    {scoreFromStatus(selectedConversation.lead.status)}
                  </span>
                </p>
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-muted hover:text-foreground"
                >
                  <Phone size={14} />
                </button>
                <button
                  type="button"
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-muted hover:text-foreground"
                >
                  <MoreHorizontal size={14} />
                </button>
                <button
                  type="button"
                  className="rounded-lg px-3 py-1.5 text-[12px] font-semibold text-white transition hover:opacity-90"
                  style={{ background: "var(--green)" }}
                >
                  New Lead
                </button>
              </div>
            </div>

            {/* ── Stats bar ───────────────────────────────────── */}
            <div className="flex shrink-0 items-center gap-2 border-b border-[#e8e8e4] bg-white px-5 py-2.5">
              {[
                {
                  icon: <Users size={11} style={{ color: "#2563eb" }} />,
                  bg: "#eff5ff",
                  label: "Leads",
                  value: stats.leads,
                },
                {
                  icon: <MessageSquare size={11} style={{ color: "#16a37f" }} />,
                  bg: "#e8f7f3",
                  label: "Replies",
                  value: stats.replies,
                },
                {
                  icon: <Flame size={11} style={{ color: "#b84a1e" }} />,
                  bg: "#fff0eb",
                  label: "Hot",
                  value: stats.hot,
                },
              ].map(({ icon, bg, label, value }) => (
                <div
                  key={label}
                  className="flex items-center gap-2 rounded-lg px-2.5 py-1.5"
                  style={{ background: "#f5f5f5" }}
                >
                  <div
                    className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md"
                    style={{ background: bg }}
                  >
                    {icon}
                  </div>
                  <span
                    className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground"
                  >
                    {label}
                  </span>
                  <span className="text-[14px] font-semibold leading-none">
                    {value}
                  </span>
                </div>
              ))}
            </div>

            {/* ── Tabs ────────────────────────────────────────── */}
            <div className="flex shrink-0 items-center border-b border-[#e8e8e4] bg-white px-5">
              {(["messages", "notes", "lead-info"] as const).map((tab) => {
                const labels: Record<typeof tab, string> = {
                  messages: "Messages",
                  notes: "Notes",
                  "lead-info": "Lead info",
                };
                return (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setActiveTab(tab)}
                    className="relative mr-4 py-2.5 text-[11px] font-medium transition"
                    style={{
                      color:
                        activeTab === tab ? "var(--green)" : "#94a3b8",
                    }}
                  >
                    {labels[tab]}
                    {activeTab === tab && (
                      <div
                        className="absolute bottom-0 left-0 h-0.5 w-full"
                        style={{ background: "var(--green)" }}
                      />
                    )}
                  </button>
                );
              })}
            </div>

            {/* ── Message thread ──────────────────────────────── */}
            <div className="flex-1 overflow-hidden">
              <ScrollArea className="h-full">
                <div className="space-y-3 px-5 py-4">
                  {activeTab === "messages" && (
                    <>
                      {selectedConversation.messages.length === 0 ? (
                        <p className="py-8 text-center text-sm text-muted-foreground">
                          No messages yet.
                        </p>
                      ) : (
                        selectedConversation.messages.map((msg) => (
                          <div
                            key={msg.id}
                            className={`flex message-animate ${
                              msg.direction === "outbound"
                                ? "justify-end"
                                : "items-end gap-2"
                            }`}
                          >
                            {msg.direction === "inbound" && (
                              <div
                                className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full font-mono text-[8px] font-bold text-white"
                                style={{
                                  background: avatarBg(
                                    `${selectedConversation.lead.first_name} ${selectedConversation.lead.last_name}`
                                  ),
                                }}
                              >
                                {initials(selectedConversation.lead)}
                              </div>
                            )}
                            <div className="max-w-[70%]">
                              <div
                                className={`px-4 py-2.5 text-[13px] leading-relaxed ${
                                  msg.direction === "outbound"
                                    ? "rounded-[22px] rounded-br-[4px] text-white"
                                    : "rounded-[22px] rounded-bl-[4px] bg-white ring-1 ring-black/[0.06]"
                                }`}
                                style={
                                  msg.direction === "outbound"
                                    ? {
                                        background: "var(--blue)",
                                        boxShadow:
                                          "0 2px 10px var(--blue-glow)",
                                      }
                                    : {
                                        boxShadow:
                                          "0 1px 3px rgba(0,0,0,.06)",
                                      }
                                }
                              >
                                {msg.body}
                              </div>
                              <p
                                className={`mt-1 font-mono text-[9px] text-muted-foreground ${
                                  msg.direction === "outbound"
                                    ? "text-right"
                                    : ""
                                }`}
                              >
                                {format(new Date(msg.created_at), "h:mm a")}
                              </p>
                            </div>
                          </div>
                        ))
                      )}

                      {/* Typing indicator */}
                      {showTyping && <TypingIndicator />}

                      <div ref={messagesEndRef} />
                    </>
                  )}

                  {activeTab === "notes" && (
                    <div className="py-4 text-sm text-muted-foreground">
                      Notes are managed from the Leads page.
                    </div>
                  )}

                  {activeTab === "lead-info" && (
                    <div className="space-y-2 py-4">
                      {[
                        { label: "Phone", value: selectedConversation.lead.phone },
                        { label: "Address", value: selectedConversation.lead.property_address },
                        { label: "Status", value: selectedConversation.lead.status },
                        { label: "Source", value: selectedConversation.lead.lead_source ?? "—" },
                        {
                          label: "Follow-up",
                          value: selectedConversation.lead.next_follow_up_at
                            ? format(new Date(selectedConversation.lead.next_follow_up_at), "PPPp")
                            : selectedConversation.lead.follow_up_date
                            ? format(new Date(selectedConversation.lead.follow_up_date), "PPP")
                            : "—",
                        },
                      ].map(({ label, value }) => (
                        <div key={label} className="flex gap-3 text-sm">
                          <span className="w-24 shrink-0 font-medium text-muted-foreground">
                            {label}
                          </span>
                          <span>{value}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </ScrollArea>
            </div>

            {/* ── Quick replies ────────────────────────────────── */}
            {activeTab === "messages" && (
              <div className="flex shrink-0 items-center gap-2 overflow-x-auto px-5 py-2">
                {QUICK_REPLIES.map(({ icon: Icon, label, text }) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => setComposeText(text)}
                    className="flex shrink-0 items-center gap-1.5 rounded-full border border-[#e8e8e4] bg-white px-3 py-1.5 text-[11px] font-medium text-muted-foreground transition"
                    onMouseEnter={(e) => {
                      const el = e.currentTarget;
                      el.style.background = "var(--green-bg)";
                      el.style.borderColor = "var(--green)";
                      el.style.color = "var(--green-dark)";
                    }}
                    onMouseLeave={(e) => {
                      const el = e.currentTarget;
                      el.style.background = "white";
                      el.style.borderColor = "#e8e8e4";
                      el.style.color = "";
                    }}
                  >
                    <Icon size={11} />
                    {label}
                  </button>
                ))}
              </div>
            )}

            {/* ── Compose bar ──────────────────────────────────── */}
            {activeTab === "messages" && (
              <div className="shrink-0 border-t border-[#e8e8e4] bg-white px-5 py-3">
                {error && (
                  <p className="mb-2 text-[11px] text-red-500">{error}</p>
                )}
                <div className="flex items-center gap-2">
                  <input
                    ref={composeRef}
                    type="text"
                    value={composeText}
                    onChange={(e) => setComposeText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        sendMessage();
                      }
                    }}
                    placeholder="iMessage"
                    disabled={isSending || selectedConversation.lead.status === "DNC"}
                    className="flex-1 rounded-full border border-[#e8e8e4] bg-white px-4 py-2 text-[13px] placeholder:text-muted-foreground disabled:opacity-50"
                    style={{
                      outline: "none",
                      transition: "border-color 150ms, box-shadow 150ms",
                    }}
                    onFocus={(e) => {
                      e.currentTarget.style.borderColor = "var(--blue)";
                      e.currentTarget.style.boxShadow =
                        "0 0 0 3px rgba(37,99,235,.08)";
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.borderColor = "#e8e8e4";
                      e.currentTarget.style.boxShadow = "none";
                    }}
                  />
                  <button
                    type="button"
                    onClick={sendMessage}
                    disabled={
                      isSending ||
                      !composeText.trim() ||
                      selectedConversation.lead.status === "DNC"
                    }
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white transition disabled:opacity-40 hover:scale-105 active:scale-95"
                    style={{ background: "var(--blue)" }}
                  >
                    <Send size={13} />
                  </button>
                </div>
                {selectedConversation.lead.status === "DNC" && (
                  <p className="mt-1.5 text-[11px] text-muted-foreground">
                    This lead is marked DNC — messaging disabled.
                  </p>
                )}
              </div>
            )}
          </>
        ) : (
          /* Empty state */
          <div className="flex flex-1 items-center justify-center">
            <div className="text-center">
              <MessageSquare
                size={32}
                className="mx-auto mb-3 text-muted-foreground opacity-40"
              />
              <p className="text-sm text-muted-foreground">
                Select a conversation to start messaging.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
