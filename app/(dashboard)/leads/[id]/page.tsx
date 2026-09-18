import Link from "next/link";
import { notFound } from "next/navigation";
import { differenceInCalendarDays, format, parseISO } from "date-fns";
import { ArrowLeft, MessageSquare, Phone } from "lucide-react";

import { getClassificationLabel } from "@/lib/ai/classify-lead";
import { getLeadDetailData } from "@/lib/data";
import { fallbackAddress, formatClassificationColor, formatStatusColor, leadDisplayName } from "@/lib/utils";
import { DealTermsForm } from "@/components/leads/deal-terms-form";
import { DealWorkspace } from "@/components/leads/deal-workspace";
import { LeadRow } from "@/components/leads/lead-row";

const moneyFormat = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

function getNextAction(lead: Awaited<ReturnType<typeof getLeadDetailData>>["lead"]) {
  if (lead.classification === "OPT_OUT") return "Do not contact";
  if (lead.classification === "HOT") return "Call now and qualify the offer";
  if (lead.classification === "WARM" || lead.status === "Replied") return "Follow up today";
  if (lead.classification === "DEAD") return "Close out this lead";
  if (lead.next_follow_up_at) return "Complete scheduled follow-up";
  if (lead.status === "New") return "Send first outreach";
  return "Gather missing info and qualify the lead";
}

export default async function LeadDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { id } = await params;
  const { tab: initialTab } = await searchParams;

  try {
    const { lead, notes, followups, messages, campaign, lastInboundMessage } = await getLeadDetailData(id);
    const isLowInfo =
      ((!lead.property_address?.trim() && !lead.mailing_address?.trim()) ||
        ((lastInboundMessage?.body?.trim().length ?? 0) > 0 && (lastInboundMessage?.body?.trim().length ?? 0) < 10));

    // Next follow-up: the lead's own date, else the earliest still-open task.
    const openTaskDue = followups
      .filter((followup) => !followup.completed_at)
      .map((followup) => followup.due_date)
      .sort()[0];
    const nextFollowUp = lead.next_follow_up_at
      ? new Date(lead.next_follow_up_at)
      : openTaskDue
        ? new Date(`${openTaskDue}T23:59:59`)
        : null;
    const nextFollowUpOverdue = Boolean(nextFollowUp && nextFollowUp.getTime() < Date.now());
    const sellerWaiting = messages.at(-1)?.direction === "inbound";

    // Optional fields added by the deal-value/deadline migration: absent until it is applied.
    const dealValue = lead.deal_value != null && Number.isFinite(Number(lead.deal_value)) ? Number(lead.deal_value) : null;
    const deadlineDate = lead.deadline ? parseISO(lead.deadline) : null;
    const daysToDeadline = deadlineDate ? differenceInCalendarDays(deadlineDate, new Date()) : 0;
    const deadlineTone =
      !deadlineDate ? "text-gray-900" : daysToDeadline < 0 ? "text-rose-700" : daysToDeadline <= 7 ? "text-rose-700" : daysToDeadline <= 30 ? "text-amber-700" : "text-gray-900";

    return (
      <div className="flex flex-1 flex-col overflow-auto bg-white">
        <div className="border-b px-6 py-4">
          <Link href="/leads" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900">
            <ArrowLeft size={15} />
            Back to leads
          </Link>
          <div className="mt-3 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-gray-900">
                {leadDisplayName(lead)}
              </h1>
              <p className="mt-1 text-sm text-gray-500">{fallbackAddress(lead.property_address)}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${formatStatusColor(lead.status)}`}>
                {lead.status}
              </span>
              <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${formatClassificationColor(lead.classification)}`}>
                {getClassificationLabel(lead.classification)}
              </span>
              {isLowInfo ? (
                <span className="inline-flex rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">
                  LOW INFO — NEEDS QUALIFICATION
                </span>
              ) : null}
            </div>
          </div>
        </div>

        {/* At a glance: what is happening with this seller and the one thing to do next */}
        <div className="border-b border-gray-100 bg-gray-50/60 px-6 py-4">
          <div className="grid grid-cols-2 gap-2 sm:gap-3 xl:grid-cols-5">
            <div className="min-w-0 rounded-xl border border-gray-100 bg-white px-3 py-3 sm:px-4">
              <p className="text-xs font-medium text-gray-500">Status</p>
              <p className="mt-1.5 text-sm font-semibold text-gray-900">{lead.status}</p>
              <p className="mt-0.5 text-xs text-gray-500">{lead.stage && lead.stage !== lead.status ? lead.stage : "Current status"}</p>
            </div>
            <div className="min-w-0 rounded-xl border border-gray-100 bg-white px-3 py-3 sm:px-4">
              <p className="text-xs font-medium text-gray-500">Next follow-up</p>
              <p className={`mt-1.5 text-sm font-semibold ${nextFollowUpOverdue ? "text-rose-700" : "text-gray-900"}`}>
                {nextFollowUp ? format(nextFollowUp, "MMM d, yyyy") : "Not scheduled"}
              </p>
              <p className={`mt-0.5 text-xs ${nextFollowUpOverdue ? "font-medium text-rose-700" : "text-gray-500"}`}>
                {nextFollowUp ? (nextFollowUpOverdue ? "Overdue" : "Upcoming") : "Set one to stay on this seller"}
              </p>
            </div>
            <div className="min-w-0 rounded-xl border border-gray-100 bg-white px-3 py-3 sm:px-4">
              <p className="text-xs font-medium text-gray-500">Deadline</p>
              {deadlineDate ? (
                <>
                  <p className={`mt-1.5 text-sm font-semibold ${deadlineTone}`}>{format(deadlineDate, "MMM d, yyyy")}</p>
                  <p className={`mt-0.5 text-xs ${deadlineTone === "text-gray-900" ? "text-gray-500" : `font-medium ${deadlineTone}`}`}>
                    {daysToDeadline < 0
                      ? "Deadline passed"
                      : daysToDeadline === 0
                        ? "Due today"
                        : `In ${daysToDeadline} ${daysToDeadline === 1 ? "day" : "days"}`}
                  </p>
                </>
              ) : (
                <>
                  <p className="mt-1.5 text-sm font-semibold text-gray-900">None on file</p>
                  <p className="mt-0.5 text-xs text-gray-500">Add one under Deal terms</p>
                </>
              )}
            </div>
            <div className="min-w-0 rounded-xl border border-gray-100 bg-white px-3 py-3 sm:px-4">
              <p className="text-xs font-medium text-gray-500">Deal value</p>
              <p className="mt-1.5 text-sm font-semibold text-gray-900">
                {dealValue != null ? moneyFormat.format(dealValue) : "Not set"}
              </p>
              <p className="mt-0.5 text-xs text-gray-500">{dealValue != null ? "Estimated" : "Add under Deal terms"}</p>
            </div>
            <div className="col-span-2 min-w-0 rounded-xl border border-gray-100 bg-white px-3 py-3 sm:px-4 xl:col-span-1">
              <p className="text-xs font-medium text-gray-500">Last seller message</p>
              {lastInboundMessage ? (
                <>
                  <p className="mt-1.5 line-clamp-2 text-sm font-medium text-gray-900">
                    “{lastInboundMessage.body}”
                  </p>
                  <p className="mt-0.5 text-xs text-gray-500">{format(new Date(lastInboundMessage.created_at), "MMM d, h:mm a")}</p>
                </>
              ) : (
                <>
                  <p className="mt-1.5 text-sm font-semibold text-gray-900">No reply yet</p>
                  <p className="mt-0.5 text-xs text-gray-500">{messages.length ? "Waiting on the seller" : "No texts sent yet"}</p>
                </>
              )}
            </div>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            {sellerWaiting ? (
              <Link href={`/inbox?lead=${lead.id}`} className="inline-flex h-9 items-center gap-1.5 rounded-md bg-emerald-700 px-3.5 text-[13px] font-medium text-white hover:bg-emerald-800">
                <MessageSquare size={14} aria-hidden />
                Draft Reply
              </Link>
            ) : null}
            {lead.phone ? (
              <a
                href={`tel:${lead.phone}`}
                className={
                  sellerWaiting
                    ? "inline-flex h-9 items-center gap-1.5 rounded-md border border-gray-200 bg-white px-3.5 text-[13px] font-medium text-gray-900 hover:bg-gray-50"
                    : "inline-flex h-9 items-center gap-1.5 rounded-md bg-emerald-700 px-3.5 text-[13px] font-medium text-white hover:bg-emerald-800"
                }
              >
                <Phone size={14} aria-hidden />
                Call Lead
              </a>
            ) : null}
            <Link href={`/leads/${lead.id}?tab=offer#deal-workspace`} className="inline-flex h-9 items-center rounded-md border border-gray-200 bg-white px-3.5 text-[13px] font-medium text-gray-900 hover:bg-gray-50">
              Create Offer
            </Link>
            <Link href={`/leads/${lead.id}?tab=tasks#deal-workspace`} className="inline-flex h-9 items-center rounded-md border border-gray-200 bg-white px-3.5 text-[13px] font-medium text-gray-900 hover:bg-gray-50">
              Set Follow-up
            </Link>
          </div>

          <DealTermsForm leadId={lead.id} dealValue={dealValue} deadline={lead.deadline ?? null} />
        </div>

        <div className="grid flex-1 grid-cols-[minmax(0,1fr)] gap-4 overflow-auto px-4 py-4 sm:px-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
          <div className="xl:col-span-2">
            <DealWorkspace
              lead={lead}
              messages={messages}
              notes={notes}
              followups={followups}
              campaignName={campaign?.name ?? null}
              initialTab={initialTab}
              nextAction={getNextAction(lead)}
            />
          </div>

          <div className="space-y-4 xl:col-span-2">
            <section className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
              <h2 className="text-sm font-semibold text-gray-900">Lead actions</h2>
              <p className="mt-2 text-sm text-gray-500">
                Update status, classification, notes, and follow-up details in one place.
              </p>
              <div className="mt-4">
                <LeadRow lead={lead} notes={notes} followups={followups} />
              </div>
            </section>
          </div>
        </div>
      </div>
    );
  } catch {
    notFound();
  }
}
