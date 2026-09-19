"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { format } from "date-fns";
import { MessageSquare, Plus, Search, Send } from "lucide-react";

import { generateInboxDraftReply, getClassificationLabel } from "@/lib/ai/classify-lead";
import { messageSentiment, SentimentBadge } from "@/components/automation/sentiment-badge";
import { useSentiments } from "@/components/automation/use-sentiments";
import { createClient } from "@/lib/supabase/browser";
import {
  fallbackCampaignName,
  fallbackCampaignType,
  formatClassificationColor,
  leadDisplayName,
  messageSnippet,
  formatPhoneDisplay,
  normalizePhone,
} from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { Database, LeadClassification } from "@/types/database";

type Lead = Database["public"]["Tables"]["leads"]["Row"];
type Message = Database["public"]["Tables"]["messages"]["Row"];
type CampaignSummary = Pick<Database["public"]["Tables"]["campaigns"]["Row"], "id" | "name" | "campaign_type">;

interface ConversationData {
  lead: Lead;
  messages: Message[];
  lastMessage: Message | null;
  unread: boolean;
}

interface InboxClientProps {
  initialLeads: Lead[];
  initialMessages: Message[];
  initialCampaigns: CampaignSummary[];
  /** Reply sentiments keyed by Telnyx message id (for the sentiment badges). */
  initialSentiments?: Record<string, string>;
  userId: string;
  autoOpenComposer?: boolean;
  /** Conversation to open first (from a dashboard "Draft Reply" link). */
  initialLeadId?: string | null;
}

interface StartConversationResponse {
  success?: boolean;
  error?: string;
  warning?: string | null;
  lead?: Lead;
  message?: Message | null;
}

const POLL_INTERVAL_MS = 10_000;

/**
 * Adds or replaces a message in a thread and keeps it ordered. Optimistic "temp-" bubbles are
 * dropped when the real row arrives; the stored body has the STOP footer appended, so the
 * optimistic text is matched as a prefix rather than compared for equality.
 */
function mergeMessage(existing: Message[], incoming: Message): Message[] {
  const withoutDuplicates = existing.filter(
    (entry) =>
      entry.id !== incoming.id &&
      !(
        entry.id.startsWith("temp-") &&
        entry.direction === incoming.direction &&
        incoming.body.startsWith(entry.body)
      )
  );
  return [...withoutDuplicates, incoming].sort((left, right) =>
    left.created_at.localeCompare(right.created_at)
  );
}

function latestInboundSentiment(messages: Message[], sentiments: Record<string, string>) {
  const latest = [...messages].reverse().find((message) => message.direction === "inbound");
  return latest ? messageSentiment(latest, sentiments) : null;
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

function campaignForLead(campaigns: CampaignSummary[], campaignId: string | null) {
  return campaignId ? campaigns.find((campaign) => campaign.id === campaignId) ?? null : null;
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

export function InboxClient({
  initialLeads,
  initialMessages,
  initialCampaigns,
  initialSentiments = {},
  userId,
  autoOpenComposer = false,
  initialLeadId = null,
}: InboxClientProps) {
  const [leads, setLeads] = useState<Lead[]>(initialLeads);
  const { sentiments, refresh: refreshSentiments, refreshSoon: refreshSentimentsSoon } = useSentiments(initialSentiments);
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
    if (initialLeadId && initialLeads.some((lead) => lead.id === initialLeadId)) return initialLeadId;
    const firstLeadWithMessages = initialLeads.find((lead) => (initialMessages.some((message) => message.lead_id === lead.id)));
    return firstLeadWithMessages?.id ?? initialLeads[0]?.id ?? null;
  });
  const [composeText, setComposeText] = useState("");
  const [search, setSearch] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notesDraft, setNotesDraft] = useState("");
  const [followUpDraft, setFollowUpDraft] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(autoOpenComposer);
  const [manualPhone, setManualPhone] = useState("");
  const [manualName, setManualName] = useState("");
  const [modalMessage, setModalMessage] = useState("");
  const [modalError, setModalError] = useState<string | null>(null);
  const [isCreatingLead, setIsCreatingLead] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const upsertMessage = useCallback((message: Message) => {
    if (!message.lead_id) return;
    const leadId = message.lead_id;
    setMessagesByLead((current) => ({
      ...current,
      [leadId]: mergeMessage(current[leadId] ?? [], message),
    }));
  }, []);

  const upsertLead = useCallback((lead: Lead) => {
    setLeads((current) =>
      current.some((entry) => entry.id === lead.id)
        ? current.map((entry) => (entry.id === lead.id ? lead : entry))
        : [lead, ...current]
    );
  }, []);

  // Live updates: new/updated messages and lead changes (e.g. a reply re-classifying a lead)
  // stream in without a refresh. If realtime can't connect, fall back to polling so the
  // inbox still stays current. Everything is torn down on unmount.
  useEffect(() => {
    if (!userId) return;

    const supabase = createClient();
    let pollTimer: ReturnType<typeof setInterval> | null = null;

    const poll = async () => {
      const [messageResult, leadResult] = await Promise.all([
        supabase
          .from("messages")
          .select("*")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(200),
        supabase.from("leads").select("*").eq("user_id", userId),
      ]);
      if (messageResult.error) console.error("[inbox] poll messages failed:", messageResult.error.message);
      else (messageResult.data ?? []).forEach(upsertMessage);
      if (leadResult.error) console.error("[inbox] poll leads failed:", leadResult.error.message);
      else (leadResult.data ?? []).forEach(upsertLead);
      void refreshSentiments();
    };

    const startPolling = () => {
      if (pollTimer) return;
      void poll();
      pollTimer = setInterval(() => void poll(), POLL_INTERVAL_MS);
    };
    const stopPolling = () => {
      if (pollTimer) clearInterval(pollTimer);
      pollTimer = null;
    };

    const channel = supabase
      .channel(`inbox-${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "messages", filter: `user_id=eq.${userId}` },
        (payload) => {
          if (payload.eventType === "DELETE") return;
          const incoming = payload.new as Message;
          upsertMessage(incoming);
          if (incoming.direction === "inbound") refreshSentimentsSoon();
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "leads", filter: `user_id=eq.${userId}` },
        (payload) => {
          if (payload.eventType === "DELETE") {
            const removedId = (payload.old as { id?: string }).id;
            if (removedId) setLeads((current) => current.filter((entry) => entry.id !== removedId));
            return;
          }
          upsertLead(payload.new as Lead);
        }
      )
      .subscribe((status, error) => {
        if (status === "SUBSCRIBED") {
          stopPolling();
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          console.error(`[inbox] realtime ${status}; falling back to polling`, error?.message ?? "");
          startPolling();
        }
      });

    return () => {
      stopPolling();
      void supabase.removeChannel(channel);
    };
  }, [userId, upsertLead, upsertMessage, refreshSentiments, refreshSentimentsSoon]);

  const conversations = useMemo<ConversationData[]>(() => {
    return leads
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
      .sort((left, right) => {
        const leftTime = left.lastMessage?.created_at ?? "";
        const rightTime = right.lastMessage?.created_at ?? "";
        return rightTime.localeCompare(leftTime);
      });
  }, [leads, messagesByLead]);

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

  const closeModal = useCallback(() => {
    setIsModalOpen(false);
    setModalError(null);
    setManualPhone("");
    setManualName("");
    setModalMessage("");
  }, []);

  const startConversation = useCallback(async () => {
    const phoneDigits = manualPhone.replace(/\D/g, "");
    if (phoneDigits.length < 10) {
      setModalError("Enter a valid phone number, e.g. (713) 555-0123.");
      return;
    }
    if (!modalMessage.trim()) {
      setModalError("Message is required.");
      return;
    }

    setIsCreatingLead(true);
    setModalError(null);

    try {
      // The server finds-or-creates the lead, sends the SMS through Telnyx and records it.
      const response = await fetch("/api/leads/start-conversation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: manualPhone,
          name: manualName,
          message: modalMessage,
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as StartConversationResponse;

      // The lead may exist even when the text failed (it shows up as "New" in the pipeline).
      if (payload.lead) {
        upsertLead(payload.lead);
        setSelectedLeadId(payload.lead.id);
        setSearch("");
      }

      if (!response.ok || !payload.lead) {
        setModalError(
          payload.error ??
            (response.status === 401
              ? "Your session expired. Please sign in again."
              : "Couldn't start the conversation. Please try again.")
        );
        return;
      }

      if (payload.message) upsertMessage(payload.message);
      setError(payload.warning ?? null);
      closeModal();
    } catch (error) {
      console.error("[inbox] start conversation request failed:", error);
      setModalError("Network error. Check your connection and try again.");
    } finally {
      setIsCreatingLead(false);
    }
  }, [closeModal, manualName, manualPhone, modalMessage, upsertLead, upsertMessage]);

  const startConversationModal = isModalOpen ? (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4">
      <div className="crm-panel w-full max-w-md overflow-hidden">
        <div className="bg-gradient-to-b from-white to-slate-50/80 px-5 py-4">
          <div className="flex items-center justify-between border-b border-slate-200/80 pb-4">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Start conversation</h2>
            <p className="mt-1 text-sm text-gray-500">Send a first message to a seller lead right away.</p>
          </div>
          <button
            type="button"
            onClick={closeModal}
            className="rounded-full px-2 py-1 text-sm text-gray-400 transition hover:bg-gray-100 hover:text-gray-700"
          >
            ✕
          </button>
        </div>
        </div>

        <div className="space-y-3 px-5 py-5">
          <input
            value={manualPhone}
            onChange={(event) => setManualPhone(event.target.value)}
            placeholder="Phone number"
            type="tel"
            disabled={isCreatingLead}
            className="w-full rounded-xl border px-3 py-2.5 text-sm outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-50"
          />
          <input
            value={manualName}
            onChange={(event) => setManualName(event.target.value)}
            placeholder="Name (optional)"
            disabled={isCreatingLead}
            className="w-full rounded-xl border px-3 py-2.5 text-sm outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-50"
          />
          <textarea
            value={modalMessage}
            onChange={(event) => setModalMessage(event.target.value)}
            placeholder="First message"
            disabled={isCreatingLead}
            rows={4}
            className="w-full rounded-xl border px-3 py-2.5 text-sm outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-50"
          />
          <button
            type="button"
            onClick={startConversation}
            disabled={isCreatingLead}
            className="w-full rounded-lg bg-[#00c08b] px-4 py-2.5 text-sm font-medium text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isCreatingLead ? "Sending..." : "Start Conversation"}
          </button>
          {modalError ? (
            <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {modalError}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  ) : null;

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
      to_number: selectedConversation.lead.phone,
      classification: null,
      phone: null,
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

    const removeTemp = () =>
      setMessagesByLead((current) => ({
        ...current,
        [selectedConversation.lead.id]: (current[selectedConversation.lead.id] ?? []).filter(
          (message) => message.id !== tempId
        ),
      }));

    try {
      const response = await fetch("/api/telnyx/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: selectedConversation.lead.phone,
          message: text,
          lead_id: selectedConversation.lead.id,
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        warning?: string | null;
        message?: Message | null;
      };

      if (!response.ok) {
        setError(payload.error ?? "Failed to send message.");
        removeTemp();
      } else if (payload.message) {
        // Swap the optimistic bubble for the saved row (realtime dedupes the same way).
        upsertMessage(payload.message);
        if (payload.warning) setError(payload.warning);
      }
    } catch (error) {
      console.error("[inbox] send message request failed:", error);
      setError("Network error. Please try again.");
      removeTemp();
    } finally {
      setIsSending(false);
    }
  }, [composeText, isSending, selectedConversation, upsertMessage, userId]);

  if (!selectedConversation) {
    return (
      <>
        {startConversationModal}
        <div className="crm-page flex h-full items-center justify-center px-6">
          <div className="crm-panel max-w-lg p-10 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-50 to-sky-50">
              <MessageSquare className="h-7 w-7 text-[#16a37f]" />
            </div>
            <p className="crm-section-kicker">Inbox</p>
            <h2 className="mt-2 text-xl font-semibold text-gray-900">No conversations yet</h2>
            <p className="mt-2 text-sm text-gray-500">
              Start texting leads in seconds.
            </p>
            <div className="mt-6 flex flex-col gap-3">
              <button
                type="button"
                onClick={() => setIsModalOpen(true)}
                className="crm-button-primary py-2.5"
              >
                Start Conversation
              </button>
              <Link
                href="/leads"
                className="crm-button-secondary"
              >
                Import CSV
              </Link>
              <Link
                href="/leads"
                className="crm-button-secondary"
              >
                Go to Leads
              </Link>
            </div>
            <p className="mt-4 text-xs text-gray-400">Tip: Import a CSV to start bulk outreach</p>
          </div>
        </div>
      </>
    );
  }

  const lead = selectedConversation.lead;
  const leadMessages = selectedConversation.messages;
  const lastInbound = [...leadMessages].reverse().find((message) => message.direction === "inbound") ?? null;
  const selectedCampaign = campaignForLead(initialCampaigns, lead.campaign_id);
  const campaignType = selectedCampaign?.campaign_type ?? null;
  const campaignName = selectedCampaign?.name ?? null;
  const suggestedReply = generateInboxDraftReply({
    propertyAddress: lead.property_address,
    lastInboundBody: lastInbound?.body ?? null,
    classification: lastInbound?.classification ?? lead.classification,
  });

  return (
    <div className="crm-page flex h-full flex-col overflow-hidden">
      <div className="crm-page-header flex items-center justify-between px-6 py-4">
        <h1 className="crm-header-title">Inbox</h1>
        <button type="button" onClick={() => setIsModalOpen(true)} className="crm-button-primary">
          Start conversation
        </button>
      </div>

      {startConversationModal}

      <div className="grid min-h-0 flex-1 gap-0 xl:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="flex min-h-0 flex-col border-r border-[#e8edf2] bg-[#f7f8fa]">
          <div className="px-4 py-4">
          <div className="flex items-center justify-between border-b border-[#eaecf0] pb-4">
            <div>
              <h2 className="text-sm font-medium text-[#0f1117]">Conversations</h2>
              <p className="mt-1 text-xs text-[#6b7280]">{filteredConversations.length} active threads</p>
            </div>
            <Link
              href="#"
              onClick={(event) => {
                event.preventDefault();
                setIsModalOpen(true);
              }}
              className="flex h-9 w-9 items-center justify-center rounded-[6px] bg-[#00c08b] text-white"
              title="Start conversation"
            >
              <Plus size={16} />
            </Link>
          </div>
          </div>
          <div className="border-b border-[#eaecf0] px-4 py-4">
            <div className="flex items-center gap-2 rounded-[6px] border border-[#eaecf0] bg-[#f8f9fb] px-3 py-2">
              <Search size={14} className="text-gray-400" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search conversations"
                className="w-full bg-transparent text-sm text-gray-900 placeholder:text-gray-400 outline-none"
              />
            </div>
          </div>

          <ScrollArea className="max-h-[260px] min-h-0 flex-1 xl:max-h-none">
            <div className="divide-y divide-[#eaecf0]">
              {filteredConversations.map((conversation) => {
                const isActive = conversation.lead.id === selectedConversation.lead.id;
                return (
                  <button
                    key={conversation.lead.id}
                    type="button"
                    onClick={() => setSelectedLeadId(conversation.lead.id)}
                    className={`w-full border-l-2 px-4 py-2 text-left transition ${
                      isActive ? "border-[#00c08b] bg-white" : conversation.unread ? "border-transparent bg-[#f7f8fa]" : "border-transparent bg-[#f7f8fa] hover:bg-white"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-white"
                        style={{
                          background: avatarBg(`${conversation.lead.first_name} ${conversation.lead.last_name}`),
                        }}
                      >
                        {initials(conversation.lead)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className={`truncate text-sm ${conversation.unread ? "font-semibold text-gray-900" : "font-medium text-gray-800"}`}>
                            {leadDisplayName(conversation.lead)}
                          </p>
                          <div className="flex items-center gap-1">
                            {conversation.unread ? <span className="h-2 w-2 rounded-full bg-[#00c08b]" /> : null}
                            <span className="shrink-0 text-[11px] text-gray-400">
                              {conversation.lastMessage ? format(new Date(conversation.lastMessage.created_at), "h:mm a") : ""}
                            </span>
                          </div>
                        </div>
                        <div className="mt-1 flex items-center gap-2">
                          <p className="min-w-0 flex-1 truncate text-xs text-gray-500">
                            {messageSnippet(conversation.lastMessage?.body, 42)}
                          </p>
                          <SentimentBadge sentiment={latestInboundSentiment(conversation.messages, sentiments)} />
                          {classificationBadge(conversation.lead.classification)}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </ScrollArea>
        </aside>

        <section className="flex min-h-0 flex-col bg-white">
          <div className="border-b border-[#eaecf0] bg-white px-5 py-4">
            <div className="flex items-center gap-3">
              <div
                className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold text-white"
                style={{ background: avatarBg(`${lead.first_name} ${lead.last_name}`) }}
              >
                {initials(lead)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h2 className="truncate text-sm font-semibold text-[#0f1117]">
                    {leadDisplayName(lead)}
                  </h2>
                  {classificationBadge(lead.classification)}
                  <SentimentBadge sentiment={latestInboundSentiment(leadMessages, sentiments)} />
                </div>
                <p className="mt-1 truncate text-xs text-[#6b7280]">
                  {campaignName
                    ? `${fallbackCampaignName(campaignName)} · ${fallbackCampaignType(campaignType)}`
                    : formatPhoneDisplay(lead.phone)}
                </p>
              </div>
            </div>
          </div>

          <ScrollArea className="min-h-[280px] flex-1 bg-[#f7f8fa] px-5 py-5 xl:min-h-0">
            <div className="space-y-4">
              {leadMessages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.direction === "outbound" ? "justify-end" : "justify-start"}`}
                >
                  <div className="max-w-[78%]">
                    <div
                      className={`${
                        message.direction === "outbound"
                          ? "crm-chat-bubble-outbound"
                          : "crm-chat-bubble-inbound"
                      }`}
                    >
                      {message.body}
                    </div>
                    <div
                      className={`mt-1 flex items-center gap-2 text-[11px] text-gray-400 ${
                        message.direction === "outbound" ? "justify-end" : "justify-start"
                      }`}
                    >
                      <span>{format(new Date(message.created_at), "MMM d, h:mm a")}</span>
                      <SentimentBadge sentiment={messageSentiment(message, sentiments)} />
                    </div>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>

          <div className="border-t border-[#eaecf0] bg-white px-5 py-4">
            <div className="mb-3 rounded-[10px] border border-[#00c08b]/20 bg-[#eaf9f5] p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-medium text-[#6b7280]">Suggested reply</p>
                  <p className="mt-1 text-sm text-[#0f1117]">{suggestedReply}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setComposeText(suggestedReply)}
                  className="rounded-[6px] bg-[#00c08b] px-3 py-2 text-xs font-medium text-white"
                >
                  Use reply
                </button>
              </div>
            </div>

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
                  className="rounded-full border border-[#eaecf0] bg-white px-3 py-1 text-[11px] text-gray-600"
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
                className="flex-1 rounded-[6px] border border-[#eaecf0] bg-white px-4 py-2.5 text-sm outline-none disabled:bg-gray-50 disabled:text-gray-400"
              />
              <button
                type="button"
                onClick={sendMessage}
                disabled={isSending || !composeText.trim() || lead.status === "DNC"}
                className="flex h-10 w-10 items-center justify-center rounded-[6px] bg-[#00c08b] text-white disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Send size={16} />
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
