"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Check, MessageSquare, Phone, Plus, Search, Send, Sparkles } from "lucide-react";

import { messageSentiment, SentimentBadge } from "@/components/automation/sentiment-badge";
import { useSentiments } from "@/components/automation/use-sentiments";
import { generateInboxDraftReply } from "@/lib/ai/classify-lead";
import { initialsOf, leadFullName } from "@/lib/board";
import { formatDateTime, formatPhone, formatShort } from "@/lib/format";
import { createClient } from "@/lib/supabase/browser";
import { unreadLeadIds } from "@/lib/unread";
import type { Database } from "@/types/database";

type Lead = Database["public"]["Tables"]["leads"]["Row"];
type Message = Database["public"]["Tables"]["messages"]["Row"];

const stageBadge: Record<string, string> = {
  New: "bg-[var(--slate-100)] text-[var(--slate-700)] dark:bg-white/10 dark:text-[var(--c-text-2)]",
  "Skip Traced": "bg-[var(--c-accent-soft)] text-[var(--c-accent-strong)]",
  Contacted: "bg-[var(--c-accent-soft)] text-[var(--c-accent-strong)]",
  Replied: "bg-[var(--c-emerald-soft)] text-[var(--c-emerald-text)]",
  "Follow Up": "bg-[var(--c-amber-soft)] text-[var(--c-amber-text)]",
  "Hot Lead": "bg-[var(--c-rose-soft)] text-[var(--c-rose-text)]",
  "Offer Sent": "bg-[var(--c-accent-soft)] text-[var(--c-accent-strong)]",
  Dead: "bg-[var(--slate-100)] text-[var(--slate-500)] dark:bg-white/10",
  DNC: "bg-[var(--c-rose-soft)] text-[var(--c-rose-text)]",
};

/** Adds/replaces a message; a saved row supersedes its optimistic "temp-" bubble. */
function mergeMessage(existing: Message[], incoming: Message): Message[] {
  const kept = existing.filter(
    (entry) =>
      entry.id !== incoming.id &&
      !(entry.id.startsWith("temp-") && entry.direction === incoming.direction && entry.lead_id === incoming.lead_id && entry.body === incoming.body)
  );
  return [...kept, incoming].sort((a, b) => a.created_at.localeCompare(b.created_at));
}

interface Props {
  initialLeads: Lead[];
  initialMessages: Message[];
  initialSentiments?: Record<string, string>;
  initialLeadId?: string | null;
  userId: string;
}

export function MessengerClient({ initialLeads, initialMessages, initialSentiments = {}, initialLeadId = null, userId }: Props) {
  const [messages, setMessages] = useState<Message[]>(() => [...initialMessages].sort((a, b) => a.created_at.localeCompare(b.created_at)));
  const [selectedId, setSelectedId] = useState<string | null>(initialLeadId && initialLeads.some((lead) => lead.id === initialLeadId) ? initialLeadId : null);
  const [search, setSearch] = useState("");
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const { sentiments, refreshSoon } = useSentiments(initialSentiments);
  const endRef = useRef<HTMLDivElement>(null);

  // Live updates. Unsubscribed on unmount.
  useEffect(() => {
    if (!userId) return;
    const supabase = createClient();
    const channel = supabase
      .channel(`messenger-${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "messages", filter: `user_id=eq.${userId}` }, (payload) => {
        if (payload.eventType === "DELETE") return;
        const incoming = payload.new as Message;
        setMessages((current) => mergeMessage(current, incoming));
        if (incoming.direction === "inbound") refreshSoon();
      })
      .subscribe((status, error) => {
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") console.error(`[messenger] realtime ${status}`, error?.message ?? "");
      });
    return () => { void supabase.removeChannel(channel); };
  }, [userId, refreshSoon]);

  const leadById = useMemo(() => new Map(initialLeads.map((lead) => [lead.id, lead])), [initialLeads]);
  const unread = useMemo(() => unreadLeadIds(messages), [messages]);

  const byLead = useMemo(() => {
    const map = new Map<string, Message[]>();
    for (const message of messages) {
      if (!message.lead_id) continue;
      const list = map.get(message.lead_id);
      if (list) list.push(message); else map.set(message.lead_id, [message]);
    }
    return map;
  }, [messages]);

  const conversations = useMemo(() => {
    const rows = [...byLead.entries()].flatMap(([leadId, thread]) => {
      const lead = leadById.get(leadId);
      if (!lead) return [];
      const last = thread[thread.length - 1];
      const lastInbound = [...thread].reverse().find((message) => message.direction === "inbound");
      return [{ lead, last, unread: unread.has(leadId), sentiment: lastInbound ? messageSentiment(lastInbound, sentiments) : null }];
    });
    // A lead opened from elsewhere (?lead=) shows even before its first message.
    if (selectedId && !byLead.has(selectedId) && leadById.get(selectedId)) {
      rows.push({ lead: leadById.get(selectedId)!, last: undefined as unknown as Message, unread: false, sentiment: null });
    }
    return rows.sort((a, b) => (b.last?.created_at ?? "9").localeCompare(a.last?.created_at ?? "9"));
  }, [byLead, leadById, unread, sentiments, selectedId]);

  const visible = useMemo(() => {
    const query = search.trim().toLowerCase();
    return conversations.filter((row) => {
      if (unreadOnly && !row.unread) return false;
      if (!query) return true;
      return `${leadFullName(row.lead)} ${row.lead.phone} ${row.lead.property_address}`.toLowerCase().includes(query);
    });
  }, [conversations, search, unreadOnly]);

  const selected = selectedId ? leadById.get(selectedId) ?? null : null;
  const thread = useMemo(() => (selectedId ? byLead.get(selectedId) ?? [] : []), [byLead, selectedId]);
  const unreadCount = unread.size;
  const lastInbound = [...thread].reverse().find((message) => message.direction === "inbound") ?? null;

  // Opening a conversation marks it read (and again if a reply lands while it's open).
  const threadUnread = selectedId ? unread.has(selectedId) : false;
  useEffect(() => {
    if (!selectedId || !threadUnread) return;
    const now = new Date().toISOString();
    setMessages((current) => current.map((message) => (message.lead_id === selectedId && message.direction === "inbound" && !message.read_at ? { ...message, read_at: now } : message)));
    void fetch("/api/messages/read", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ lead_id: selectedId }) })
      .then(() => window.dispatchEvent(new Event("crm:unread-changed")))
      .catch(() => undefined);
  }, [selectedId, threadUnread]);

  useEffect(() => { endRef.current?.scrollIntoView({ block: "end" }); }, [selectedId, thread.length]);

  const send = useCallback(async (text: string) => {
    if (!selected || !text.trim()) return;
    setSending(true);
    setSendError(null);
    try {
      const response = await fetch("/api/telnyx/send", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ to: selected.phone, message: text.trim(), lead_id: selected.id }),
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string; warning?: string | null; message?: Message | null };
      if (!response.ok) return setSendError(payload.error ?? "Failed to send message.");
      if (payload.warning) setSendError(payload.warning);
      const saved: Message = payload.message ?? {
        id: `temp-${Date.now()}`, body: text.trim(), direction: "outbound", created_at: new Date().toISOString(), lead_id: selected.id, phone: selected.phone,
        to_number: selected.phone, user_id: null, classification: null, status: "queued", telnyx_message_id: null, read_at: null,
      };
      setMessages((current) => mergeMessage(current, saved));
      setDraft("");
    } catch {
      setSendError("Network error. Please try again.");
    } finally {
      setSending(false);
    }
  }, [selected]);

  const suggestion = selected ? generateInboxDraftReply({ propertyAddress: selected.property_address, lastInboundBody: lastInbound?.body ?? null, classification: selected.classification }) : "";

  return (
    <div className="flex min-h-0 flex-1 bg-[var(--c-page)]">
      {/* Conversation list */}
      <aside className={`${selected ? "hidden md:flex" : "flex"} w-full shrink-0 flex-col border-r border-[var(--c-border)] bg-[var(--c-surface)] md:w-[340px]`}>
        <div className="border-b border-[var(--c-border)] px-4 pb-3 pt-4">
          <div className="flex items-center justify-between">
            <h1 className="text-[17px] font-semibold text-[var(--c-text)]">Messenger</h1>
            <Link href="/inbox?new=1" className="inline-flex items-center gap-1 rounded-lg bg-[var(--c-accent)] px-2.5 py-1.5 text-[12.5px] font-semibold text-white hover:bg-[var(--c-accent-strong)]"><Plus size={14} aria-hidden />New</Link>
          </div>
          <div className="relative mt-3">
            <Search size={15} aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--c-muted)]" />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name, phone or address" aria-label="Search conversations" className="w-full rounded-lg border border-[var(--c-border)] bg-[var(--c-surface-2)] py-2 pl-9 pr-3 text-[13.5px] text-[var(--c-text)] outline-none focus:border-[var(--c-accent)]" />
          </div>
          <button type="button" role="switch" aria-checked={unreadOnly} onClick={() => setUnreadOnly((value) => !value)} className="mt-3 flex w-full items-center justify-between rounded-lg px-1 py-1 text-[13px] text-[var(--c-text-2)]">
            <span>Unread only <span className="num text-[var(--c-muted)]">({unreadCount})</span></span>
            <span className={`relative h-5 w-9 rounded-full transition-colors ${unreadOnly ? "bg-[var(--c-accent)]" : "bg-[var(--slate-300)]"}`}><span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${unreadOnly ? "left-[18px]" : "left-0.5"}`} /></span>
          </button>
        </div>
        <ul className="min-h-0 flex-1 overflow-y-auto">
          {visible.length === 0 && (
            <li className="px-5 py-10 text-center text-[13.5px] text-[var(--c-muted)]">{unreadOnly ? "You're all caught up." : conversations.length ? "No conversations match your search." : "No conversations yet. Texts you send and replies you get appear here."}</li>
          )}
          {visible.map((row) => (
            <li key={row.lead.id}>
              <button type="button" onClick={() => { setSelectedId(row.lead.id); setSendError(null); }} className={`flex w-full items-start gap-3 border-l-2 px-4 py-3 text-left hover:bg-[var(--c-surface-2)] ${row.lead.id === selectedId ? "border-l-[var(--c-accent)] bg-[var(--c-accent-soft)]" : "border-l-transparent"}`}>
                <span aria-hidden className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--c-accent-soft)] text-[12px] font-semibold text-[var(--c-accent-strong)]">{initialsOf(leadFullName(row.lead))}</span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline justify-between gap-2">
                    <span className={`truncate text-[13.5px] ${row.unread ? "font-semibold text-[var(--c-text)]" : "font-medium text-[var(--c-text-2)]"}`}>{leadFullName(row.lead)}</span>
                    <span className="num shrink-0 text-[11px] text-[var(--c-muted)]">{row.last ? formatShort(row.last.created_at) : ""}</span>
                  </span>
                  <span className="mt-0.5 flex items-center gap-1.5">
                    <span className="min-w-0 flex-1 truncate text-[12.5px] text-[var(--c-muted)]">{row.last ? `${row.last.direction === "outbound" ? "You: " : ""}${row.last.body}` : "No messages yet"}</span>
                    <SentimentBadge sentiment={row.sentiment} />
                    {row.unread && <span aria-label="Unread" className="h-2 w-2 shrink-0 rounded-full bg-[var(--c-rose)]" />}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </aside>

      {/* Thread */}
      <section className={`${selected ? "flex" : "hidden md:flex"} min-w-0 flex-1 flex-col`}>
        {!selected ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 text-[var(--c-muted)]">
            <MessageSquare size={30} aria-hidden />
            <p className="text-[14px]">Select a conversation</p>
          </div>
        ) : (
          <>
            <header className="flex items-center gap-3 border-b border-[var(--c-border)] bg-[var(--c-surface)] px-4 py-3 sm:px-6">
              <button type="button" onClick={() => setSelectedId(null)} aria-label="Back to conversations" className="rounded-lg p-1.5 text-[var(--c-text-2)] hover:bg-[var(--c-surface-2)] md:hidden"><ArrowLeft size={18} /></button>
              <span aria-hidden className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--c-accent-soft)] text-[13px] font-semibold text-[var(--c-accent-strong)]">{initialsOf(leadFullName(selected))}</span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Link href={`/leads/${selected.id}`} className="truncate text-[15px] font-semibold text-[var(--c-text)] hover:text-[var(--c-accent-strong)]">{leadFullName(selected)}</Link>
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${stageBadge[selected.is_dnc ? "DNC" : selected.stage ?? "New"] ?? stageBadge.New}`}>{selected.is_dnc ? "DNC" : selected.stage ?? "New"}</span>
                </div>
                <p className="truncate text-[12.5px] text-[var(--c-muted)]">{selected.property_address}<span className="num"> · {formatPhone(selected.phone)}</span></p>
              </div>
              <a href={`tel:${selected.phone}`} aria-label={`Call ${leadFullName(selected)}`} className="rounded-lg border border-[var(--c-border)] p-2 text-[var(--c-text-2)] hover:bg-[var(--c-surface-2)]"><Phone size={16} /></a>
            </header>

            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6">
              {thread.length === 0 ? (
                <p className="mt-16 text-center text-[13.5px] text-[var(--c-muted)]">No messages yet with {selected.first_name}. Say hello below.</p>
              ) : (
                <ul className="mx-auto flex max-w-3xl flex-col gap-3">
                  {thread.map((message) => {
                    const out = message.direction === "outbound";
                    return (
                      <li key={message.id} className={`flex flex-col ${out ? "items-end" : "items-start"}`}>
                        <div className={`max-w-[78%] whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2.5 text-[14px] leading-snug ${out ? "rounded-br-md bg-[var(--c-accent)] text-white" : "rounded-bl-md border border-[var(--c-border)] bg-[var(--c-surface)] text-[var(--c-text)]"}`}>{message.body}</div>
                        <div className="mt-1 flex items-center gap-2 px-1">
                          <span className="num text-[11px] text-[var(--c-muted)]">{formatDateTime(message.created_at)}</span>
                          {out && message.status === "delivered" && <Check size={12} className="text-[var(--c-emerald-text)]" aria-label="Delivered" />}
                          {out && (message.status === "failed" || message.status === "undelivered") && <span className="text-[11px] font-medium text-[var(--c-rose-text)]">Failed</span>}
                          {!out && <SentimentBadge sentiment={messageSentiment(message, sentiments)} />}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
              <div ref={endRef} />
            </div>

            <footer className="border-t border-[var(--c-border)] bg-[var(--c-surface)] px-4 py-3 sm:px-6">
              {selected.is_dnc ? (
                <p className="rounded-lg bg-[var(--c-rose-soft)] px-3 py-2.5 text-[13px] text-[var(--c-rose-text)]">This seller opted out. You can’t text them.</p>
              ) : (
                <div className="mx-auto max-w-3xl">
                  {lastInbound && !draft && (
                    <button type="button" onClick={() => setDraft(suggestion)} className="mb-2 inline-flex max-w-full items-start gap-1.5 rounded-lg border border-[var(--c-accent-border)] bg-[var(--c-accent-soft)] px-2.5 py-1.5 text-left text-[12.5px] text-[var(--c-accent-strong)]"><Sparkles size={13} className="mt-0.5 shrink-0" aria-hidden /><span className="truncate">{suggestion}</span></button>
                  )}
                  {sendError && <p role="alert" className="mb-2 text-[12.5px] text-[var(--c-rose-text)]">{sendError}</p>}
                  <form onSubmit={(event) => { event.preventDefault(); void send(draft); }} className="flex items-end gap-2">
                    <textarea
                      value={draft}
                      onChange={(event) => setDraft(event.target.value)}
                      onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void send(draft); } }}
                      rows={2}
                      maxLength={1600}
                      aria-label={`Message ${selected.first_name}`}
                      placeholder={`Message ${selected.first_name}…`}
                      className="min-h-[44px] flex-1 resize-none rounded-xl border border-[var(--c-border)] bg-[var(--c-surface-2)] px-3.5 py-2.5 text-[14px] text-[var(--c-text)] outline-none focus:border-[var(--c-accent)]"
                    />
                    <button type="submit" disabled={sending || !draft.trim()} className="inline-flex h-11 items-center gap-1.5 rounded-xl bg-[var(--c-accent)] px-4 text-[13.5px] font-semibold text-white hover:bg-[var(--c-accent-strong)] disabled:opacity-50"><Send size={15} aria-hidden />{sending ? "Sending…" : "Send"}</button>
                  </form>
                </div>
              )}
            </footer>
          </>
        )}
      </section>
    </div>
  );
}
