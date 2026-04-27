import Link from "next/link";
import { differenceInCalendarDays, format, isToday } from "date-fns";
import { CalendarClock, Clock3, FileText, Flame, Phone, Skull, User } from "lucide-react";

import { setFollowup, updateLeadStatus, updatePipelineStage } from "@/app/actions";
import type { PipelineLeadCard, PipelineStage } from "@/lib/data";

const STAGE_STYLES: Record<PipelineStage, { accent: string; chip: string }> = {
  "New Leads": { accent: "bg-sky-500", chip: "bg-sky-50 text-sky-700" },
  Contacted: { accent: "bg-teal-500", chip: "bg-teal-50 text-teal-700" },
  Replied: { accent: "bg-emerald-500", chip: "bg-emerald-50 text-emerald-700" },
  Qualified: { accent: "bg-amber-500", chip: "bg-amber-50 text-amber-700" },
  "Offer Sent": { accent: "bg-violet-500", chip: "bg-violet-50 text-violet-700" },
  Dead: { accent: "bg-slate-500", chip: "bg-slate-100 text-slate-700" },
};

function priorityBadge(classification: string) {
  if (classification === "HOT") {
    return { label: "HOT 🔥", classes: "bg-rose-100 text-rose-700" };
  }
  if (classification === "WARM") {
    return { label: "WARM", classes: "bg-amber-100 text-amber-700" };
  }
  return { label: "COLD", classes: "bg-slate-100 text-slate-600" };
}

function contactAge(lead: PipelineLeadCard["lead"]) {
  if (!lead.last_contacted_at) {
    return {
      label: "Never contacted",
      classes: "text-slate-500",
    };
  }

  const days = differenceInCalendarDays(new Date(), new Date(lead.last_contacted_at));
  return {
    label: `⏱ ${days}d since contact`,
    classes: days <= 1 ? "text-emerald-600" : days <= 3 ? "text-amber-600" : "text-rose-600",
  };
}

export function PipelineBoard({
  stageOrder,
  cards,
}: {
  stageOrder: PipelineStage[];
  cards: PipelineLeadCard[];
}) {
  const cardsByStage = new Map<PipelineStage, PipelineLeadCard[]>(
    stageOrder.map((stage) => [stage, cards.filter((card) => card.stage === stage)])
  );
  const hasAnyLeads = cards.length > 0;

  return (
    <div className="crm-page flex flex-1 flex-col overflow-hidden">
      <div className="crm-page-header px-8 py-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="crm-section-kicker">Daily pipeline</p>
            <h1 className="crm-header-title mt-2">Pipeline Board</h1>
            <p className="crm-header-copy">Track seller leads across your acquisition workflow.</p>
          </div>
          <div className="flex flex-wrap gap-2">
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
              Add Lead
            </Link>
            <Link href="/inbox" className="crm-button-primary">
              Start Conversation
            </Link>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-x-auto overflow-y-hidden px-6 py-8">
        {!hasAnyLeads ? (
          <div className="flex h-full items-center justify-center">
            <div className="crm-panel max-w-md p-10 text-center">
                  <h2 className="text-xl font-bold text-gray-900">No leads yet</h2>
              <p className="mt-2 text-sm text-gray-500">
                Add leads to start tracking and closing deals.
              </p>
              <div className="mt-6 flex flex-col gap-3">
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
                <Link
                  href="/inbox"
                  className="crm-button-primary py-2.5"
                >
                  Start Conversation
                </Link>
              </div>
            </div>
          </div>
        ) : (
        <div className="grid min-w-[1500px] grid-cols-6 gap-4">
          {stageOrder.map((stage) => {
            const stageCards = cardsByStage.get(stage) ?? [];
            const styles = STAGE_STYLES[stage];

            return (
              <section
                key={stage}
                className="crm-card flex min-h-0 flex-col overflow-hidden"
              >
                <div className="border-b border-slate-200/80 bg-gradient-to-b from-white to-slate-50/70 px-4 py-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className={`h-2.5 w-2.5 rounded-full ${styles.accent}`} />
                      <h2 className="text-[15px] font-semibold text-gray-900">
                        {stage} <span className="text-gray-400">({stageCards.length})</span>
                      </h2>
                    </div>
                  </div>
                </div>

                <div className="flex-1 space-y-3 overflow-y-auto p-3">
                  {stageCards.length ? (
                    stageCards.map(({ lead, messageCount, callCount, followupCount, daysInPipeline, lastMessagePreview, stage }) => {
                      const followUpDate = lead.next_follow_up_at ? new Date(lead.next_follow_up_at) : null;
                      const isDueToday = followUpDate ? isToday(followUpDate) : false;
                      const priority = priorityBadge(lead.classification);
                      const contact = contactAge(lead);

                      return (
                      <article
                        key={lead.id}
                        className="crm-card-soft p-4 transition hover:border-teal-200 hover:shadow-md"
                      >
                        <div className="mb-3 flex items-start justify-between gap-2">
                          <p className="text-sm font-semibold leading-5 text-slate-900">{lead.property_address}</p>
                          <span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-medium uppercase tracking-wide ${priority.classes}`}>
                            {priority.label}
                          </span>
                        </div>

                        <div className="mt-3 space-y-2.5 text-xs text-slate-500">
                          <div className="flex items-center gap-2">
                            <User size={13} className="text-gray-400" />
                            <span>
                              {lead.first_name} {lead.last_name || "Seller"}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Phone size={13} className="text-gray-400" />
                            <span>{lead.phone}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Clock3 size={13} className="text-gray-400" />
                            <span>Created {format(new Date(lead.created_at), "MMM d, yyyy")}</span>
                          </div>
                          <div className={`flex items-center gap-2 font-medium ${contact.classes}`}>
                            <CalendarClock size={13} />
                            <span>{contact.label}</span>
                          </div>
                          <div className="crm-muted-surface px-3 py-2 text-[11px] leading-5 text-gray-600">
                            {lastMessagePreview ? `Last message: ${lastMessagePreview}` : "No messages yet"}
                          </div>
                        </div>

                        <div className="mt-4 grid grid-cols-2 gap-2">
                          <div className="crm-muted-surface px-3 py-2">
                            <p className="text-[10px] uppercase tracking-wide text-gray-400">Days</p>
                            <p className="mt-1 text-sm font-semibold text-gray-900">{daysInPipeline}</p>
                          </div>
                          <div className="crm-muted-surface px-3 py-2">
                            <p className="text-[10px] uppercase tracking-wide text-gray-400">Messages</p>
                            <p className="mt-1 text-sm font-semibold text-gray-900">{messageCount}</p>
                          </div>
                          <div className="crm-muted-surface px-3 py-2">
                            <p className="text-[10px] uppercase tracking-wide text-gray-400">Calls</p>
                            <p className="mt-1 text-sm font-semibold text-gray-900">{callCount}</p>
                          </div>
                          <div className="crm-muted-surface px-3 py-2">
                            <p className="text-[10px] uppercase tracking-wide text-gray-400">Tasks</p>
                            <p className="mt-1 text-sm font-semibold text-gray-900">{followupCount}</p>
                          </div>
                        </div>

                        <div className="mt-4 flex items-center justify-between">
                          <div className={`inline-flex items-center gap-1 text-[11px] ${isDueToday ? "font-medium text-rose-600" : "text-gray-500"}`}>
                            <FileText size={12} />
                            Next follow-up{" "}
                            {followUpDate ? format(followUpDate, "MMM d, h:mm a") : "not set"}
                          </div>
                        </div>

                        <div className="mt-3 grid gap-2">
                          <form action={updatePipelineStage} className="flex items-center gap-2">
                            <input type="hidden" name="id" value={lead.id} />
                            <select
                              name="stage"
                              defaultValue={stage}
                              className="min-w-0 flex-1 rounded-xl border border-gray-200 bg-white px-2 py-2 text-[11px] font-medium text-gray-700 outline-none"
                            >
                              <option>New Leads</option>
                              <option>Contacted</option>
                              <option>Replied</option>
                              <option>Qualified</option>
                              <option>Offer Sent</option>
                              <option>Dead</option>
                            </select>
                            <button className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-[11px] font-medium text-gray-700 shadow-sm">
                              Update
                            </button>
                          </form>

                          <div className="grid grid-cols-2 gap-2">
                          <form action={updateLeadStatus}>
                            <input type="hidden" name="id" value={lead.id} />
                            <input type="hidden" name="status" value="Hot" />
                            <button className="flex w-full items-center justify-center gap-1 rounded-xl border border-amber-200 bg-white px-2 py-2 text-[11px] font-medium text-amber-700">
                              <Flame size={12} />
                              Mark Hot
                            </button>
                          </form>

                          <form action={updateLeadStatus}>
                            <input type="hidden" name="id" value={lead.id} />
                            <input type="hidden" name="status" value="Dead" />
                            <button className="flex w-full items-center justify-center gap-1 rounded-xl border border-rose-200 bg-white px-2 py-2 text-[11px] font-medium text-rose-700">
                              <Skull size={12} />
                              Mark Dead
                            </button>
                          </form>

                          <form action={setFollowup}>
                            <input type="hidden" name="lead_id" value={lead.id} />
                            <input
                              type="hidden"
                              name="due_date"
                              value={new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10)}
                            />
                            <input
                              type="hidden"
                              name="next_follow_up_at"
                              value={new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 16)}
                            />
                            <input type="hidden" name="note" value="Follow up tomorrow from pipeline board." />
                            <button className="flex w-full items-center justify-center gap-1 rounded-xl border border-teal-200 bg-white px-2 py-2 text-[11px] font-medium text-teal-700">
                              <CalendarClock size={12} />
                              Tomorrow
                            </button>
                          </form>
                          </div>

                          <Link
                            href={`/leads/${lead.id}`}
                            className="crm-button-primary flex w-full items-center justify-center px-3 py-2 text-[11px]"
                          >
                            Open Lead
                          </Link>
                        </div>
                      </article>
                    )})
                  ) : (
                    <div className="crm-muted-surface border-dashed px-4 py-8 text-center text-sm text-gray-400">
                      No leads here yet
                    </div>
                  )}
                </div>
              </section>
            );
          })}
        </div>
        )}
      </div>
    </div>
  );
}
