import Link from "next/link";
import { format, isToday } from "date-fns";
import { CalendarClock, Clock3, FileText, Flame, Phone, Skull, User } from "lucide-react";

import { setFollowup, updateLeadStatus } from "@/app/actions";
import type { PipelineLeadCard, PipelineStage } from "@/lib/data";

const STAGE_STYLES: Record<PipelineStage, { accent: string; chip: string }> = {
  "New Leads": { accent: "bg-sky-500", chip: "bg-sky-50 text-sky-700" },
  Contacted: { accent: "bg-teal-500", chip: "bg-teal-50 text-teal-700" },
  Replied: { accent: "bg-emerald-500", chip: "bg-emerald-50 text-emerald-700" },
  Qualified: { accent: "bg-amber-500", chip: "bg-amber-50 text-amber-700" },
  "Offer Sent": { accent: "bg-violet-500", chip: "bg-violet-50 text-violet-700" },
  Dead: { accent: "bg-slate-500", chip: "bg-slate-100 text-slate-700" },
};

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

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-[#f6f7f9]">
      <div className="border-b bg-white px-8 py-5">
        <h1 className="text-2xl font-semibold tracking-tight text-gray-900">Pipeline Board</h1>
        <p className="mt-1 text-sm text-gray-500">Track seller leads across your acquisition workflow.</p>
      </div>

      <div className="flex-1 overflow-x-auto overflow-y-hidden px-6 py-6">
        <div className="grid min-w-[1500px] grid-cols-6 gap-4">
          {stageOrder.map((stage) => {
            const stageCards = cardsByStage.get(stage) ?? [];
            const styles = STAGE_STYLES[stage];

            return (
              <section
                key={stage}
                className="flex min-h-0 flex-col rounded-3xl border border-gray-100 bg-white shadow-sm"
              >
                <div className="border-b px-4 py-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className={`h-2.5 w-2.5 rounded-full ${styles.accent}`} />
                      <h2 className="text-sm font-semibold text-gray-900">
                        {stage} <span className="text-gray-400">({stageCards.length})</span>
                      </h2>
                    </div>
                  </div>
                </div>

                <div className="flex-1 space-y-3 overflow-y-auto p-3">
                  {stageCards.length ? (
                    stageCards.map(({ lead, messageCount, callCount, followupCount, daysInPipeline }) => {
                      const followUpDate = lead.next_follow_up_at ? new Date(lead.next_follow_up_at) : null;
                      const isDueToday = followUpDate ? isToday(followUpDate) : false;
                      const priorityBadge =
                        lead.classification === "HOT"
                          ? "bg-rose-100 text-rose-700"
                          : lead.classification === "WARM"
                            ? "bg-amber-100 text-amber-700"
                            : "bg-slate-100 text-slate-600";

                      return (
                      <article
                        key={lead.id}
                        className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm transition hover:border-teal-200 hover:shadow-md"
                      >
                        <div className="mb-3 flex items-start justify-between gap-2">
                          <p className="text-sm font-semibold leading-5 text-gray-900">{lead.property_address}</p>
                          <span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-medium uppercase tracking-wide ${priorityBadge}`}>
                            {lead.classification === "HOT" ? "HOT / 🔥" : lead.classification}
                          </span>
                        </div>

                        <div className="mt-3 space-y-2 text-xs text-gray-500">
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
                            <CalendarClock size={13} className="text-gray-400" />
                            <span>Updated {format(new Date(lead.updated_at), "MMM d, yyyy")}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Clock3 size={13} className="text-gray-400" />
                            <span>Created {format(new Date(lead.created_at), "MMM d, yyyy")}</span>
                          </div>
                        </div>

                        <div className="mt-4 grid grid-cols-2 gap-2">
                          <div className="rounded-xl bg-gray-50 px-3 py-2">
                            <p className="text-[10px] uppercase tracking-wide text-gray-400">Days</p>
                            <p className="mt-1 text-sm font-semibold text-gray-900">{daysInPipeline}</p>
                          </div>
                          <div className="rounded-xl bg-gray-50 px-3 py-2">
                            <p className="text-[10px] uppercase tracking-wide text-gray-400">Messages</p>
                            <p className="mt-1 text-sm font-semibold text-gray-900">{messageCount}</p>
                          </div>
                          <div className="rounded-xl bg-gray-50 px-3 py-2">
                            <p className="text-[10px] uppercase tracking-wide text-gray-400">Calls</p>
                            <p className="mt-1 text-sm font-semibold text-gray-900">{callCount}</p>
                          </div>
                          <div className="rounded-xl bg-gray-50 px-3 py-2">
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
                          <Link
                            href={`/leads/${lead.id}`}
                            className="rounded-full bg-[#16a37f] px-3 py-1.5 text-xs font-medium text-white transition hover:bg-[#128765]"
                          >
                            Open
                          </Link>
                        </div>

                        <div className="mt-3 grid grid-cols-3 gap-2">
                          <form action={updateLeadStatus}>
                            <input type="hidden" name="id" value={lead.id} />
                            <input type="hidden" name="status" value="Hot" />
                            <button className="flex w-full items-center justify-center gap-1 rounded-xl border border-amber-200 bg-amber-50 px-2 py-2 text-[11px] font-medium text-amber-700">
                              <Flame size={12} />
                              Mark Hot
                            </button>
                          </form>

                          <form action={updateLeadStatus}>
                            <input type="hidden" name="id" value={lead.id} />
                            <input type="hidden" name="status" value="Dead" />
                            <button className="flex w-full items-center justify-center gap-1 rounded-xl border border-rose-200 bg-rose-50 px-2 py-2 text-[11px] font-medium text-rose-700">
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
                            <button className="flex w-full items-center justify-center gap-1 rounded-xl border border-teal-200 bg-teal-50 px-2 py-2 text-[11px] font-medium text-teal-700">
                              <CalendarClock size={12} />
                              Tomorrow
                            </button>
                          </form>
                        </div>
                      </article>
                    )})
                  ) : (
                    <div className="rounded-2xl border border-dashed border-gray-200 px-4 py-8 text-center text-sm text-gray-400">
                      No leads in this stage.
                    </div>
                  )}
                </div>
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}
