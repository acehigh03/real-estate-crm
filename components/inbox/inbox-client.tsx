"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { format } from "date-fns";
import { CalendarClock, Flame, MessageSquare, Plus, Search, Send, Skull, Snowflake } from "lucide-react";

import { saveLead, setFollowup, updateLeadStatus } from "@/app/actions";
import { getClassificationLabel } from "@/lib/ai/classify-lead";
import { createClient } from "@/lib/supabase/browser";
import { formatClassificationColor, formatStatusColor } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { Database, LeadClassification, LeadStatus } from "@/types/database";

type Lead = Database["public"]["Tables"]["leads"]["Row"];
type Message = Database["public"]["Tables"]["messages"]["Row"];

interface ConversationData {
  lead: Lead;
  messages: Message[];
  lastMessage: Message | null;
  unread: boolean;
}

interface InboxClientProps {
  initialLeads: Lead[];
  initialMessages: Message[];
  userId: string;
}

function initials(lead: Lead) {
  return `${lead.first_name[0] ?? ""}${lead.last_name[0] ?? ""}`.toUpperCase();
}

function avatarBg(name: string) {
  const colors = ["#16a37f", "#2563eb", "#0f766e", "#d97706", "#4f46e5", "#db2777"];
  let hash = 0;
  for (let index = 0; index < name.length; index += 1) {
    hash = name.charCodeAt(index) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

function classificationBadge(classification: LeadClassification) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${formatClassificationColor(classification)}`}
    >
      {getClassificationLabel(classification)}
    </span>
  );
}

function statusBadge(status: LeadStatus) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${formatStatusColor(status)}`}
    >
      {status}
    </span>
  );
}

function HiddenLeadFields({
  lead,
  classification,
  notesSummary,
  nextFollowUpAt,
  includeNotesSummary = true,
}: {
  lead: Lead;
  classification: LeadClassification;
  notesSummary: string;
  nextFollowUpAt: string;
  includeNotesSummary?: boolean;
}) {
  return (
    <>
      <input type="hidden" name="id" value={lead.id} />
      <input type="hidden" name="first_name" value={lead.first_name} />
      <input type="hidden" name="last_name" value={lead.last_name} />
      <input type="hidden" name="property_address" value={lead.property_address} />
      <input type="hidden" name="mailing_address" value={lead.mailing_address ?? ""} />
      <input type="hidden" name="phone" value={lead.phone} />
      <input type="hidden" name="email" value={lead.email ?? ""} />
      <input type="hidden" name="lead_source" value={lead.lead_source ?? ""} />
      <input type="hidden" name="tag" value={lead.tag ?? ""} />
      <input type="hidden" name="status" value={lead.status} />
      <input type="hidden" name="classification" value={classification} />
      {includeNotesSummary ? <input type="hidden" name="notes_summary" value={notesSummary} /> : null}
      <input type="hidden" name="next_follow_up_at" value={nextFollowUpAt} />
    </>
  );
}

export function InboxClient({ initialLeads, initialMessages, userId }: InboxClientProps) {
  const [messagesByLead, setMessagesByLead] = useState<Record<string, Message[]>>(() => {
    const grouped: Record<string, Message[]> = {};
    for (const message of initialMessages) {
      if (!message.lead_id) continue;
      grouped[message.lead_id] = [...(grouped[message.lead_id] ?? []), message];
    }
    for (const leadId of Object.keys(grouped)) {
      grouped[leadId] = grouped[leadId].sort((left, right) =>
        left.created_at.localeCompare(right.created_at)
      );
    }
    return grouped;
  });

  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(() => {
    const firstLeadWithMessages = initialLeads.find((lead) => (initialMessages.some((message) => message.lead_id === lead.id)));
    return firstLeadWithMessages?.id ?? initialLeads[0]?.id ?? null;
  });
  const [composeText, setComposeText] = useState("");
  const [search, setSearch] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notesDraft, setNotesDraft] = useState("");
  const [followUpDraft, setFollowUpDraft] = useState("");

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("inbox-messages")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        (payload) => {
          const message = payload.new as Message;
          if (!message.lead_id) return;
          setMessagesByLead((current) => {
            const existing = current[message.lead_id!] ?? [];
            const deduped = existing.filter(
              (entry) =>
                entry.id !== message.id &&
                !(entry.id.startsWith("temp-") && entry.body === message.body)
            );
            return {
              ...current,
              [message.lead_id!]: [...deduped, message].sort((left, right) =>
                left.created_at.localeCompare(right.created_at)
              ),
            };
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const conversations = useMemo<ConversationData[]>(() => {
    return initialLeads
      .map((lead) => {
        const messages = messagesByLead[lead.id] ?? [];
        const lastMessage = messages.at(-1) ?? null;
        return {
          lead,
          messages,
          lastMessage,
          unread: lastMessage?.direction === "inbound",
        };
      })
      .filter((conversation) => conversation.messages.length > 0)
      .sort((left, right) => {
        const leftTime = left.lastMessage?.created_at ?? "";
        const rightTime = right.lastMessage?.created_at ?? "";
        return rightTime.localeCompare(leftTime);
      });
  }, [initialLeads, messagesByLead]);

  const filteredConversations = useMemo(() => {
    if (!search.trim()) return conversations;
    const query = search.toLowerCase();
    return conversations.filter((conversation) =>
      `${conversation.lead.first_name} ${conversation.lead.last_name} ${conversation.lead.property_address}`
        .toLowerCase()
        .includes(query)
    );
  }, [conversations, search]);

  const selectedConversation = useMemo(() => {
    return (
      filteredConversations.find((conversation) => conversation.lead.id === selectedLeadId) ??
      filteredConversations[0] ??
      null
    );
  }, [filteredConversations, selectedLeadId]);

  useEffect(() => {
    if (!selectedConversation) return;
    setNotesDraft(selectedConversation.lead.notes_summary ?? "");
    setFollowUpDraft(
      selectedConversation.lead.next_follow_up_at
        ? selectedConversation.lead.next_follow_up_at.slice(0, 16)
        : ""
    );
  }, [selectedConversation]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [selectedConversation?.lead.id, selectedConversation?.messages.length]);

  const sendMessage = useCallback(async () => {
    if (!composeText.trim() || !selectedConversation || isSending) return;

    const text = composeText.trim();
    const tempId = `temp-${Date.now()}`;
    const tempMessage: Message = {
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

    setComposeText("");
    setError(null);
    setIsSending(true);
    setMessagesByLead((current) => ({
      ...current,
      [selectedConversation.lead.id]: [
        ...(current[selectedConversation.lead.id] ?? []),
        tempMessage,
      ],
    }));

    try {
      const response = await fetch("/api/telnyx/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: selectedConversation.lead.phone_normalized,
          message: text,
          lead_id: selectedConversation.lead.id,
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        setError(payload.error ?? "Failed to send message.");
        setMessagesByLead((current) => ({
          ...current,
          [selectedConversation.lead.id]: (current[selectedConversation.lead.id] ?? []).filter(
            (message) => message.id !== tempId
          ),
        }));
      }
    } catch {
      setError("Network error. Please try again.");
      setMessagesByLead((current) => ({
        ...current,
        [selectedConversation.lead.id]: (current[selectedConversation.lead.id] ?? []).filter(
          (message) => message.id !== tempId
        ),
      }));
    } finally {
      setIsSending(false);
    }
  }, [composeText, isSending, selectedConversation, userId]);

  if (!selectedConversation) {
    return (
      <div className="flex h-full items-center justify-center bg-white px-6">
        <div className="max-w-md rounded-2xl border border-gray-100 bg-white p-8 text-center shadow-sm">
          <MessageSquare className="mx-auto mb-4 h-9 w-9 text-gray-300" />
          <h2 className="text-base font-semibold text-gray-900">No conversations yet</h2>
          <p className="mt-2 text-sm text-gray-500">
            No conversations yet. Import leads or open a lead to start messaging.
          </p>
          <div className="mt-5 flex items-center justify-center gap-3">
            <Link
              href="/leads"
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
            >
              Go to Leads
            </Link>
            <Link
              href="/leads"
              className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
            >
              Import CSV
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const lead = selectedConversation.lead;
  const leadMessages = selectedConversation.messages;

  return (
    <div className="flex h-full flex-col overflow-hidden bg-[#f6f7f9]">
      <div className="border-b bg-white px-6 py-4">
        <h1 className="text-lg font-semibold text-gray-900">Inbox</h1>
        <p className="mt-1 text-sm text-gray-500">Manage seller conversations and lead follow-up in one place.</p>
      </div>

      <div className="grid min-h-0 flex-1 gap-0 xl:grid-cols-[320px_minmax(0,1fr)_340px]">
        <aside className="flex min-h-0 flex-col border-r bg-white">
          <div className="flex items-center justify-between border-b px-4 py-4">
            <div>
              <h2 className="text-sm font-semibold text-gray-900">Conversations</h2>
              <p className="mt-1 text-xs text-gray-500">{filteredConversations.length} active threads</p>
            </div>
            <Link
              href="/leads"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-[#16a37f] text-white transition hover:bg-[#128765]"
              title="Go to leads"
            >
              <Plus size={16} />
            </Link>
          </div>
          <div className="border-b px-4 py-4">
            <div className="flex items-center gap-2 rounded-lg border bg-gray-50 px-3 py-2">
              <Search size={14} className="text-gray-400" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search conversations"
                className="w-full bg-transparent text-sm text-gray-900 placeholder:text-gray-400 outline-none"
              />
            </div>
          </div>

          <ScrollArea className="min-h-0 flex-1">
            <div className="divide-y">
              {filteredConversations.map((conversation) => {
                const isActive = conversation.lead.id === selectedConversation.lead.id;
                return (
                  <button
                    key={conversation.lead.id}
                    type="button"
                    onClick={() => setSelectedLeadId(conversation.lead.id)}
                    className={`w-full px-4 py-3 text-left transition ${
                      isActive ? "bg-[#eef8f4]" : conversation.unread ? "bg-[#fafdfb]" : "bg-white hover:bg-gray-50"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold text-white"
                        style={{
                          background: avatarBg(`${conversation.lead.first_name} ${conversation.lead.last_name}`),
                        }}
                      >
                        {initials(conversation.lead)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <p className={`truncate text-sm ${conversation.unread ? "font-semibold text-gray-900" : "font-medium text-gray-800"}`}>
                            {conversation.lead.first_name} {conversation.lead.last_name}
                          </p>
                          <div className="flex items-center gap-1">
                            {conversation.unread ? <span className="h-2 w-2 rounded-full bg-[#16a37f]" /> : null}
                            <span className="shrink-0 text-[11px] text-gray-400">
                              {conversation.lastMessage ? format(new Date(conversation.lastMessage.created_at), "h:mm a") : ""}
                            </span>
                          </div>
                        </div>
                        <p className="mt-1 truncate text-xs text-gray-500">
                          {conversation.lastMessage?.body ?? "No messages yet."}
                        </p>
                        <div className="mt-2">{classificationBadge(conversation.lead.classification)}</div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </ScrollArea>
        </aside>

        <section className="flex min-h-0 flex-col border-r bg-[#f8fafc]">
          <div className="border-b bg-white px-5 py-4">
            <div className="flex items-center gap-3">
              <div
                className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold text-white"
                style={{ background: avatarBg(`${lead.first_name} ${lead.last_name}`) }}
              >
                {initials(lead)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h2 className="truncate text-sm font-semibold text-gray-900">
                    {lead.first_name} {lead.last_name}
                  </h2>
                  {classificationBadge(lead.classification)}
                </div>
                <p className="mt-1 truncate text-xs text-gray-500">{lead.property_address}</p>
              </div>
            </div>
          </div>

          <ScrollArea className="min-h-0 flex-1 px-5 py-4">
            <div className="space-y-2">
              {leadMessages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.direction === "outbound" ? "justify-end" : "justify-start"}`}
                >
                  <div className="max-w-[78%]">
                    <div
                      className={`rounded-2xl px-4 py-2.5 text-sm leading-5 ${
                        message.direction === "outbound"
                          ? "rounded-br-md bg-blue-600 text-white"
                          : "rounded-bl-md bg-gray-200 text-gray-900"
                      }`}
                    >
                      {message.body}
                    </div>
                    <p
                      className={`mt-1 text-[11px] text-gray-400 ${
                        message.direction === "outbound" ? "text-right" : "text-left"
                      }`}
                    >
                      {format(new Date(message.created_at), "MMM d, h:mm a")}
                    </p>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>

          <div className="border-t bg-white px-5 py-3">
            <div className="mb-2 flex flex-wrap gap-2">
              {[
                "Would you be open to a quick cash offer this week?",
                "What timeline are you hoping for if you sell?",
                "Is the property currently vacant or occupied?",
              ].map((quickReply) => (
                <button
                  key={quickReply}
                  type="button"
                  onClick={() => setComposeText(quickReply)}
                  className="rounded-full border px-3 py-1 text-[11px] text-gray-600 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
                >
                  {quickReply}
                </button>
              ))}
            </div>

            {error ? <p className="mb-2 text-xs text-red-500">{error}</p> : null}

            <div className="flex items-center gap-2">
              <input
                value={composeText}
                onChange={(event) => setComposeText(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    sendMessage();
                  }
                }}
                disabled={isSending || lead.status === "DNC"}
                placeholder={lead.status === "DNC" ? "Messaging disabled for DNC lead" : "Type a message"}
                className="flex-1 rounded-full border bg-white px-4 py-2.5 text-sm outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-50 disabled:bg-gray-50 disabled:text-gray-400"
              />
              <button
                type="button"
                onClick={sendMessage}
                disabled={isSending || !composeText.trim() || lead.status === "DNC"}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-600 text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-200"
              >
                <Send size={16} />
              </button>
            </div>
          </div>
        </section>

        <aside className="flex min-h-0 flex-col bg-white">
          <ScrollArea className="min-h-0 flex-1">
            <div className="space-y-5 px-5 py-5">
              <section className="space-y-3">
                <div>
                  <h3 className="text-base font-semibold text-gray-900">
                    {lead.first_name} {lead.last_name}
                  </h3>
                  <p className="mt-1 text-sm text-gray-500">{lead.phone}</p>
                </div>
                <div className="grid gap-3">
                  <div className="rounded-xl border bg-gray-50 px-3 py-3">
                    <p className="text-[11px] uppercase tracking-wide text-gray-400">Property</p>
                    <p className="mt-1 text-sm text-gray-900">{lead.property_address}</p>
                  </div>
                  <div className="rounded-xl border bg-gray-50 px-3 py-3">
                    <p className="text-[11px] uppercase tracking-wide text-gray-400">Classification</p>
                    <div className="mt-2 flex items-center gap-2">
                      {classificationBadge(lead.classification)}
                      {statusBadge(lead.status)}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-xl border bg-gray-50 px-3 py-3">
                      <p className="text-[11px] uppercase tracking-wide text-gray-400">Motivation</p>
                      <p className="mt-1 text-xl font-semibold text-gray-900">{lead.motivation_score}</p>
                    </div>
                    <div className="rounded-xl border bg-gray-50 px-3 py-3">
                      <p className="text-[11px] uppercase tracking-wide text-gray-400">Next follow-up</p>
                      <p className="mt-1 text-sm text-gray-900">
                        {lead.next_follow_up_at ? format(new Date(lead.next_follow_up_at), "MMM d, h:mm a") : "Not set"}
                      </p>
                    </div>
                  </div>
                  <div className="rounded-xl border bg-gray-50 px-3 py-3">
                    <p className="text-[11px] uppercase tracking-wide text-gray-400">Last contacted</p>
                    <p className="mt-1 text-sm text-gray-900">
                      {lead.last_contacted_at ? format(new Date(lead.last_contacted_at), "MMM d, yyyy h:mm a") : "Not contacted yet"}
                    </p>
                  </div>
                </div>
              </section>

              <section className="space-y-3">
                <h4 className="text-sm font-semibold text-gray-900">Quick actions</h4>
                <div className="grid grid-cols-2 gap-2">
                  <form action={updateLeadStatus}>
                    <input type="hidden" name="id" value={lead.id} />
                    <input type="hidden" name="status" value="Hot" />
                    <button className="flex w-full items-center justify-center gap-2 rounded-lg bg-amber-500 px-3 py-2 text-sm font-medium text-white">
                      <Flame size={14} />
                      Mark hot
                    </button>
                  </form>

                  <form action={saveLead}>
                    <HiddenLeadFields
                      lead={lead}
                      classification="COLD"
                      notesSummary={notesDraft}
                      nextFollowUpAt={followUpDraft}
                    />
                    <button className="flex w-full items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700">
                      <Snowflake size={14} />
                      Mark cold
                    </button>
                  </form>

                  <form action={updateLeadStatus}>
                    <input type="hidden" name="id" value={lead.id} />
                    <input type="hidden" name="status" value="Dead" />
                    <button className="flex w-full items-center justify-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">
                      <Skull size={14} />
                      Mark dead
                    </button>
                  </form>
                </div>
              </section>

              <section className="space-y-3">
                <h4 className="text-sm font-semibold text-gray-900">Schedule follow-up</h4>
                <form action={setFollowup} className="space-y-2">
                  <input type="hidden" name="lead_id" value={lead.id} />
                  <input type="hidden" name="due_date" value={followUpDraft ? followUpDraft.slice(0, 10) : ""} />
                  <input
                    name="next_follow_up_at"
                    type="datetime-local"
                    required
                    value={followUpDraft}
                    onChange={(event) => setFollowUpDraft(event.target.value)}
                    className="w-full rounded-lg border px-3 py-2 text-sm outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-50"
                  />
                  <input
                    name="note"
                    placeholder="Optional follow-up note"
                    className="w-full rounded-lg border px-3 py-2 text-sm outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-50"
                  />
                  <button className="flex w-full items-center justify-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white">
                    <CalendarClock size={14} />
                    Schedule follow-up
                  </button>
                </form>
              </section>

              <section className="space-y-3">
                <h4 className="text-sm font-semibold text-gray-900">Notes</h4>
                <form action={saveLead} className="space-y-2">
                  <HiddenLeadFields
                    lead={lead}
                    classification={lead.classification}
                    notesSummary={notesDraft}
                    nextFollowUpAt={followUpDraft}
                    includeNotesSummary={false}
                  />
                  <textarea
                    name="notes_summary"
                    value={notesDraft}
                    onChange={(event) => setNotesDraft(event.target.value)}
                    rows={6}
                    className="w-full rounded-xl border px-3 py-3 text-sm outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-50"
                    placeholder="Add seller notes, objections, and next steps"
                  />
                  <button className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700">
                    Save notes
                  </button>
                </form>
              </section>
            </div>
          </ScrollArea>
        </aside>
      </div>
    </div>
  );
}
