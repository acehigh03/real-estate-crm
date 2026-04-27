import Link from "next/link";
import { format } from "date-fns";

import type { PipelineLeadCard, PipelineStage } from "@/lib/data";
import { fallbackCampaignName, fallbackAddress, leadDisplayName, messageSnippet } from "@/lib/utils";

const STAGE_STYLES: Record<PipelineStage, { accent: string; chip: string }> = {
  "New Leads": { accent: "bg-sky-500", chip: "bg-sky-50 text-sky-700" },
  Contacted: { accent: "bg-teal-500", chip: "bg-teal-50 text-teal-700" },
  Replied: { accent: "bg-emerald-500", chip: "bg-emerald-50 text-emerald-700" },
  Qualified: { accent: "bg-amber-500", chip: "bg-amber-50 text-amber-700" },
  "Offer Sent": { accent: "bg-violet-500", chip: "bg-violet-50 text-violet-700" },
  Dead: { accent: "bg-slate-500", chip: "bg-slate-100 text-slate-700" },
};

function displayLeadName(lead: PipelineLeadCard["lead"]) {
  return leadDisplayName(lead);
}

function propertyLabel(address: string | null, campaignName: string | null) {
  return address?.trim() ? fallbackAddress(address) : fallbackCampaignName(campaignName);
}

function priorityBadge(classification: string) {
  if (classification === "HOT") {
    return { label: "HOT", classes: "bg-[#eaf9f5] text-[#00c08b]" };
  }
  if (classification === "WARM") {
    return { label: "WARM", classes: "bg-[#fef3c7] text-[#92400e]" };
  }
  return { label: "COLD", classes: "bg-[#ede9fe] text-[#5b21b6]" };
}

function lastMessageSnippet(text: string | null) {
  return `Last: ${messageSnippet(text, 60)}`;
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
      <div className="crm-page-header px-8 py-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="crm-header-title">Pipeline</h1>
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

      <div className="flex-1 overflow-x-auto overflow-y-hidden px-6 py-4">
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

            return (
              <section
                key={stage}
                className="flex min-h-0 flex-col rounded-[10px] border border-[#eaecf0] bg-white"
              >
                <div className="border-b border-[#e8edf2] px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <h2 className="text-sm font-semibold text-[#0f1117]">
                      {stage}
                    </h2>
                    <span className="rounded-full bg-[#e8edf2] px-2 py-0.5 text-[11px] font-medium text-[#6b7c93]">
                      {stageCards.length}
                    </span>
                  </div>
                </div>

                <div className="flex-1 space-y-2.5 overflow-y-auto p-3">
                  {stageCards.length ? (
                    stageCards.map(({ lead, lastMessagePreview, campaignName }) => {
                      const priority = priorityBadge(lead.classification);
                      const leadName = displayLeadName(lead);
                      const address = propertyLabel(lead.property_address, campaignName);

                      return (
                      <article
                        key={lead.id}
                        className="rounded-[10px] border border-[#eaecf0] bg-white p-3"
                      >
                        <div className="mb-2 flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold leading-5 text-slate-900">{leadName}</p>
                            {address ? (
                              <p className="mt-0.5 truncate text-xs text-slate-500">{address}</p>
                            ) : null}
                            <p className="mt-1 truncate text-[11px] text-slate-400">
                              {fallbackCampaignName(campaignName)}
                            </p>
                          </div>
                          <span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-medium ${priority.classes}`}>
                            {priority.label}
                          </span>
                        </div>

                        <div className="space-y-2 text-xs text-slate-500">
                          <p className="text-xs text-slate-500">
                            Created {format(new Date(lead.created_at), "MMM d, yyyy")}
                          </p>
                          <p className="line-clamp-1 text-xs text-slate-500">
                            {lastMessageSnippet(lastMessagePreview)}
                          </p>
                        </div>

                        <div className="mt-3">
                          <Link
                            href={`/leads/${lead.id}`}
                            className="flex w-full items-center justify-center rounded-[6px] bg-[#1a1f36] px-3 py-2 text-[11px] font-medium text-white"
                          >
                            Open Lead
                          </Link>
                        </div>
                      </article>
                    )})
                  ) : (
                    <div className="rounded-[10px] border border-dashed border-[#eaecf0] px-4 py-8 text-center text-sm text-gray-400">
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
