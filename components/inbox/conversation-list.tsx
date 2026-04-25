"use client";

import { useMemo, useState, useTransition } from "react";
import { format } from "date-fns";

import { formatStatusColor } from "@/lib/utils";
import type { Database } from "@/types/database";

type Lead = Database["public"]["Tables"]["leads"]["Row"];
type Message = Database["public"]["Tables"]["messages"]["Row"];

export function ConversationList({
  leads,
  messages
}: {
  leads: Lead[];
  messages: Message[];
}) {
  const [activeLeadId, setActiveLeadId] = useState<string | null>(leads[0]?.id ?? null);
  const [body, setBody] = useState("");
  const [status, setStatus] = useState("");
  const [isPending, startTransition] = useTransition();

  const conversations = useMemo(
    () =>
      leads
        .map((lead) => ({
          lead,
          messages: messages
            .filter((message) => message.lead_id === lead.id)
            .sort((a, b) => a.created_at.localeCompare(b.created_at))
        }))
        .filter((conversation) => conversation.messages.length > 0),
    [leads, messages]
  );

  const activeConversation =
    conversations.find((conversation) => conversation.lead.id === activeLeadId) ?? conversations[0];

  return (
    <section className="grid gap-5 lg:grid-cols-[320px_1fr]">
      <div className="rounded-3xl border border-border bg-white p-4 shadow-card">
        <h2 className="mb-4 text-lg font-semibold">Conversations</h2>
        <div className="space-y-2">
          {conversations.length ? (
            conversations.map(({ lead, messages: thread }) => (
              <button
                key={lead.id}
                type="button"
                onClick={() => setActiveLeadId(lead.id)}
                className="w-full rounded-2xl border border-border px-4 py-3 text-left transition hover:bg-slate-50"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="font-medium">
                    {lead.first_name} {lead.last_name}
                  </p>
                  <span
                    className={`rounded-full px-2 py-1 text-[11px] font-semibold ${formatStatusColor(lead.status)}`}
                  >
                    {lead.status}
                  </span>
                </div>
                <p className="mt-1 truncate text-sm text-muted">{thread.at(-1)?.body}</p>
              </button>
            ))
          ) : (
            <p className="text-sm text-muted">No conversations yet.</p>
          )}
        </div>
      </div>

      <div className="rounded-3xl border border-border bg-white p-5 shadow-card">
        {activeConversation ? (
          <>
            <div className="border-b border-border pb-4">
              <h2 className="text-xl font-semibold">
                {activeConversation.lead.first_name} {activeConversation.lead.last_name}
              </h2>
              <p className="text-sm text-muted">{activeConversation.lead.phone}</p>
            </div>

            <div className="max-h-[440px] space-y-3 overflow-y-auto py-5">
              {activeConversation.messages.map((message) => (
                <div
                  key={message.id}
                  className={
                    message.direction === "outbound"
                      ? "ml-auto max-w-[80%] rounded-3xl bg-slate-900 px-4 py-3 text-sm text-white"
                      : "max-w-[80%] rounded-3xl bg-slate-100 px-4 py-3 text-sm"
                  }
                >
                  <p>{message.body}</p>
                  <p className="mt-2 text-xs opacity-70">{format(new Date(message.created_at), "PPp")}</p>
                </div>
              ))}
            </div>

            <div className="border-t border-border pt-4">
              <textarea
                rows={4}
                value={body}
                onChange={(event) => setBody(event.target.value)}
                placeholder="Send an individual SMS"
                className="w-full rounded-2xl border border-border px-4 py-3 text-sm"
              />
              <div className="mt-3 flex items-center gap-3">
                <button
                  type="button"
                  disabled={isPending || !body.trim() || activeConversation.lead.status === "DNC"}
                  onClick={() =>
                    startTransition(async () => {
                      const response = await fetch("/api/send-sms", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ leadId: activeConversation.lead.id, message: body })
                      });

                      const data = await response.json();
                      setStatus(response.ok ? "Message sent." : data.error);
                      if (response.ok) {
                        setBody("");
                        window.location.reload();
                      }
                    })
                  }
                  className="rounded-2xl bg-accent px-4 py-3 text-sm font-medium text-white disabled:opacity-60"
                >
                  {isPending ? "Sending..." : "Send SMS"}
                </button>
                {status ? <p className="text-sm text-muted">{status}</p> : null}
              </div>
            </div>
          </>
        ) : (
          <p className="text-sm text-muted">Conversation threads will appear here when messages are received or sent.</p>
        )}
      </div>
    </section>
  );
}
