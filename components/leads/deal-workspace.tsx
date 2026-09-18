"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { format, parseISO } from "date-fns";

import { addNote, setFollowup } from "@/app/actions";
import { fallbackAddress, formatPhoneDisplay, leadDisplayName } from "@/lib/utils";
import type { Database } from "@/types/database";

type Lead = Database["public"]["Tables"]["leads"]["Row"];
type Note = Database["public"]["Tables"]["notes"]["Row"];
type Message = Database["public"]["Tables"]["messages"]["Row"];
type Followup = Database["public"]["Tables"]["followups"]["Row"];

const TABS = [
  { key: "property", label: "Property info" },
  { key: "sms", label: "SMS conversation" },
  { key: "timeline", label: "Timeline" },
  { key: "offer", label: "Offer calculator" },
  { key: "tasks", label: "Tasks" },
  { key: "notes", label: "Notes / documents" },
] as const;
type TabKey = (typeof TABS)[number]["key"];

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

function safeFormat(value: string | null | undefined, pattern: string) {
  if (!value) return "—";
  // parseISO reads date-only values ("2026-09-10", e.g. followups.due_date) as LOCAL midnight;
  // `new Date()` would treat them as UTC and show the previous day in US timezones.
  const date = parseISO(value);
  return Number.isNaN(date.getTime()) ? "—" : format(date, pattern);
}

function Field({ label, value, wide }: { label: string; value: string | null | undefined; wide?: boolean }) {
  return (
    <div className={`rounded-xl bg-gray-50 px-4 py-3 ${wide ? "md:col-span-2 xl:col-span-3" : ""}`}>
      <p className="text-xs uppercase tracking-wide text-gray-400">{label}</p>
      <p className="mt-2 break-words text-sm font-medium text-gray-900">{value?.trim() || "—"}</p>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-gray-400">{children}</p>;
}

// ── Offer calculator: max offer = ARV − repairs − assignment fee ───────────
function OfferCalculator() {
  const [arv, setArv] = useState("");
  const [repairs, setRepairs] = useState("");
  const [fee, setFee] = useState("");

  const toNumber = (value: string) => {
    const parsed = Number.parseFloat(value.replace(/[$,\s]/g, ""));
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
  };
  const arvValue = toNumber(arv);
  const repairsValue = toNumber(repairs);
  const feeValue = toNumber(fee);
  const rawOffer = arvValue - repairsValue - feeValue;
  const maxOffer = Math.max(0, rawOffer);
  const hasInput = arvValue > 0;

  const inputClass =
    "mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-400";

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
      <div className="space-y-3">
        {[
          { id: "arv", label: "After-repair value (ARV)", value: arv, set: setArv },
          { id: "repairs", label: "Estimated repairs", value: repairs, set: setRepairs },
          { id: "fee", label: "Assignment / wholesale fee", value: fee, set: setFee },
        ].map((field) => (
          <label key={field.id} htmlFor={`offer-${field.id}`} className="block text-xs font-medium uppercase tracking-wide text-gray-400">
            {field.label}
            <input
              id={`offer-${field.id}`}
              inputMode="decimal"
              value={field.value}
              onChange={(event) => field.set(event.target.value)}
              placeholder="$0"
              className={inputClass}
            />
          </label>
        ))}
        <p className="text-xs text-gray-400">Calculated in your browser only — nothing here is saved to the lead.</p>
      </div>

      <div className="rounded-xl bg-gray-50 px-5 py-4">
        <p className="text-xs uppercase tracking-wide text-gray-400">Maximum offer</p>
        <p className="mt-2 text-3xl font-semibold text-gray-900">{hasInput ? money.format(maxOffer) : "—"}</p>
        <dl className="mt-4 space-y-1.5 text-sm text-gray-600">
          <div className="flex justify-between">
            <dt>ARV</dt>
            <dd>{money.format(arvValue)}</dd>
          </div>
          <div className="flex justify-between">
            <dt>− Repairs</dt>
            <dd>{money.format(repairsValue)}</dd>
          </div>
          <div className="flex justify-between">
            <dt>− Fee</dt>
            <dd>{money.format(feeValue)}</dd>
          </div>
        </dl>
        {hasInput && rawOffer < 0 ? (
          <p className="mt-3 text-xs font-medium text-amber-700">
            Repairs plus fee exceed the ARV — there is no offer price that works.
          </p>
        ) : null}
        {!hasInput ? <p className="mt-3 text-xs text-gray-400">Enter the ARV to see the maximum offer.</p> : null}
      </div>
    </div>
  );
}

export function DealWorkspace({
  lead,
  messages,
  notes,
  followups,
  campaignName,
  initialTab,
  nextAction,
}: {
  lead: Lead;
  messages: Message[];
  notes: Note[];
  followups: Followup[];
  campaignName: string | null;
  initialTab?: string;
  nextAction?: string;
}) {
  const [tab, setTab] = useState<TabKey>(
    TABS.some((entry) => entry.key === initialTab) ? (initialTab as TabKey) : "property"
  );

  const timeline = useMemo(() => {
    const events: Array<{ at: string; title: string; detail?: string }> = [
      { at: lead.created_at, title: "Lead added", detail: lead.lead_source ? `Source: ${lead.lead_source}` : undefined },
    ];
    for (const message of messages) {
      events.push({
        at: message.created_at,
        title: message.direction === "outbound" ? "Text sent" : "Reply received",
        detail: message.body,
      });
    }
    for (const note of notes) events.push({ at: note.created_at, title: "Note added", detail: note.body });
    for (const followup of followups) {
      events.push({
        at: followup.created_at,
        title: `Follow-up scheduled for ${safeFormat(followup.due_date, "MMM d, yyyy")}`,
        detail: followup.note ?? undefined,
      });
      if (followup.completed_at) events.push({ at: followup.completed_at, title: "Follow-up completed" });
    }
    return events
      .filter((event) => !Number.isNaN(new Date(event.at).getTime()))
      .sort((left, right) => right.at.localeCompare(left.at))
      .slice(0, 100);
  }, [lead, messages, notes, followups]);

  const today = format(new Date(), "yyyy-MM-dd");

  return (
    <section id="deal-workspace" className="scroll-mt-4 rounded-xl border border-gray-100 bg-white shadow-sm">
      <div className="border-b border-gray-100 px-4 pt-4">
        <h2 className="text-sm font-semibold text-gray-900">Deal workspace</h2>
        <div role="tablist" aria-label="Deal workspace" className="-mb-px mt-3 flex gap-1 overflow-x-auto">
          {TABS.map((entry) => {
            const isActive = entry.key === tab;
            return (
              <button
                key={entry.key}
                id={`deal-tab-${entry.key}`}
                type="button"
                role="tab"
                aria-selected={isActive}
                aria-controls={`deal-panel-${entry.key}`}
                onClick={() => setTab(entry.key)}
                className={`whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition ${
                  isActive
                    ? "border-gray-900 text-gray-900"
                    : "border-transparent text-gray-500 hover:text-gray-900"
                }`}
              >
                {entry.label}
              </button>
            );
          })}
        </div>
      </div>

      <div
        role="tabpanel"
        id={`deal-panel-${tab}`}
        aria-labelledby={`deal-tab-${tab}`}
        className="px-4 py-4"
      >
        {tab === "property" ? (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            <Field label="Owner" value={leadDisplayName(lead)} />
            <Field label="Property address" value={fallbackAddress(lead.property_address)} />
            <Field label="Mailing address" value={lead.mailing_address} />
            <Field label="City / State / ZIP" value={[lead.city, lead.state, lead.zip].filter(Boolean).join(", ")} />
            <Field label="Phone" value={lead.phone ? formatPhoneDisplay(lead.phone) : null} />
            <Field label="Email" value={lead.email} />
            <Field label="Lead source" value={lead.lead_source} />
            <Field label="Campaign" value={campaignName} />
            <Field label="Tag" value={lead.tag} />
            <Field label="Status" value={lead.status} />
            <Field label="Stage" value={lead.stage} />
            <Field label="Priority" value={lead.priority} />
            <Field label="Last contacted" value={lead.last_contacted_at ? safeFormat(lead.last_contacted_at, "MMM d, yyyy h:mm a") : null} />
            <Field label="Motivation score" value={String(lead.motivation_score)} />
            <Field label="Next action" value={nextAction} />
            <Field label="Summary" value={lead.notes_summary ?? "No summary yet — waiting for more info"} wide />
          </div>
        ) : null}

        {tab === "sms" ? (
          <div>
            <div className="max-h-[420px] space-y-3 overflow-y-auto">
              {messages.length ? (
                messages.map((message) => (
                  <div
                    key={message.id}
                    className={
                      message.direction === "outbound"
                        ? "ml-auto max-w-[85%] rounded-2xl bg-[#141414] px-4 py-3 text-sm text-white"
                        : "max-w-[85%] rounded-2xl bg-gray-100 px-4 py-3 text-sm text-gray-800"
                    }
                  >
                    <p>{message.body}</p>
                    <p className="mt-2 text-xs opacity-70">
                      {message.direction === "outbound" ? "Outbound" : "Inbound"} •{" "}
                      {safeFormat(message.created_at, "MMM d, yyyy h:mm a")}
                    </p>
                  </div>
                ))
              ) : (
                <Empty>No messages for this lead yet.</Empty>
              )}
            </div>
            <div className="mt-4">
              <Link
                href="/inbox"
                className="inline-flex rounded-xl border border-gray-200 px-4 py-2 text-sm font-medium text-gray-900 hover:bg-gray-50"
              >
                Reply in Inbox
              </Link>
            </div>
          </div>
        ) : null}

        {tab === "timeline" ? (
          timeline.length ? (
            <ol className="space-y-4">
              {timeline.map((event, index) => (
                <li key={`${event.at}-${index}`} className="flex gap-3">
                  <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-gray-300" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900">{event.title}</p>
                    {event.detail ? <p className="mt-0.5 line-clamp-2 text-sm text-gray-500">{event.detail}</p> : null}
                    <p className="mt-0.5 text-xs text-gray-400">{safeFormat(event.at, "MMM d, yyyy h:mm a")}</p>
                  </div>
                </li>
              ))}
            </ol>
          ) : (
            <Empty>No activity yet.</Empty>
          )
        ) : null}

        {tab === "offer" ? <OfferCalculator /> : null}

        {tab === "tasks" ? (
          <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
            <div className="space-y-3">
              {lead.next_follow_up_at ? (
                <div className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
                  Next follow-up: {safeFormat(lead.next_follow_up_at, "MMM d, yyyy h:mm a")}
                </div>
              ) : null}
              {followups.length ? (
                followups.map((followup) => {
                  const done = Boolean(followup.completed_at);
                  const overdue = !done && followup.due_date < today;
                  return (
                    <div key={followup.id} className="rounded-xl bg-gray-50 px-4 py-3 text-sm">
                      <div className="flex items-center justify-between gap-3">
                        <p className="font-medium text-gray-900">{followup.note?.trim() || "Follow up"}</p>
                        <span
                          className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                            done
                              ? "bg-emerald-100 text-emerald-800"
                              : overdue
                                ? "bg-rose-100 text-rose-800"
                                : "bg-blue-100 text-blue-800"
                          }`}
                        >
                          {done ? "Done" : overdue ? "Overdue" : "Open"}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-gray-500">Due {safeFormat(followup.due_date, "MMM d, yyyy")}</p>
                    </div>
                  );
                })
              ) : (
                <Empty>No tasks yet. Schedule the first follow-up.</Empty>
              )}
            </div>
            <form action={setFollowup} className="space-y-3 rounded-xl border border-gray-100 p-4">
              <h3 className="text-sm font-semibold text-gray-900">Add a follow-up</h3>
              <input type="hidden" name="lead_id" value={lead.id} />
              <input
                name="due_date"
                type="date"
                required
                aria-label="Due date"
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
              />
              <textarea
                name="note"
                rows={2}
                aria-label="Follow-up note"
                placeholder="What needs to happen?"
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
              />
              <button type="submit" className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white">
                Add task
              </button>
            </form>
          </div>
        ) : null}

        {tab === "notes" ? (
          <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
            <div className="space-y-3">
              {notes.length ? (
                notes.map((note) => (
                  <div key={note.id} className="rounded-xl bg-gray-50 px-4 py-3 text-sm">
                    <p className="whitespace-pre-wrap text-gray-800">{note.body}</p>
                    <p className="mt-2 text-xs text-gray-400">{safeFormat(note.created_at, "MMM d, yyyy h:mm a")}</p>
                  </div>
                ))
              ) : (
                <Empty>No notes yet.</Empty>
              )}
            </div>
            <div className="space-y-4">
              <form action={addNote} className="space-y-3 rounded-xl border border-gray-100 p-4">
                <h3 className="text-sm font-semibold text-gray-900">Add a note</h3>
                <input type="hidden" name="lead_id" value={lead.id} />
                <textarea
                  name="body"
                  rows={3}
                  required
                  aria-label="Note"
                  placeholder="Add a note"
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
                />
                <button type="submit" className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white">
                  Add note
                </button>
              </form>
              <div className="rounded-xl border border-dashed border-gray-200 p-4">
                <h3 className="text-sm font-semibold text-gray-900">Documents</h3>
                <p className="mt-1 text-sm text-gray-400">
                  Contract and photo uploads are coming soon. File storage isn&apos;t set up yet.
                </p>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
