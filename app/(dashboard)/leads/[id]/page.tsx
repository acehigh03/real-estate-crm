import Link from "next/link";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import { ArrowLeft, CalendarClock, Mail, MapPin, MessageSquare, Phone } from "lucide-react";

import { getClassificationLabel } from "@/lib/ai/classify-lead";
import { getLeadDetailData } from "@/lib/data";
import { fallbackAddress, fallbackCampaignName, fallbackCampaignType, formatClassificationColor, formatPhoneDisplay, formatStatusColor, leadDisplayName } from "@/lib/utils";
import { DealWorkspace } from "@/components/leads/deal-workspace";
import { LeadRow } from "@/components/leads/lead-row";

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
          <div className="grid grid-cols-2 gap-2 sm:gap-3 xl:grid-cols-4">
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
              {/* No tax-sale / auction date is stored on leads yet. */}
              <p className="mt-1.5 text-sm font-semibold text-gray-900">None on file</p>
              <p className="mt-0.5 text-xs text-gray-500">Tax sale or auction date</p>
            </div>
            <div className="min-w-0 rounded-xl border border-gray-100 bg-white px-3 py-3 sm:px-4">
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
            />
          </div>

          <div className="space-y-4">
            <section className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
              <h2 className="text-sm font-semibold text-gray-900">Lead profile</h2>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <div className="rounded-xl bg-gray-50 px-4 py-3">
                  <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-gray-400">
                    <Phone size={13} />
                    Phone
                  </div>
                  <p className="mt-2 text-sm font-medium text-gray-900">{formatPhoneDisplay(lead.phone)}</p>
                </div>
                <div className="rounded-xl bg-gray-50 px-4 py-3">
                  <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-gray-400">
                    <Mail size={13} />
                    Email
                  </div>
                  <p className="mt-2 text-sm font-medium text-gray-900">{lead.email ?? "No email on file"}</p>
                </div>
                <div className="rounded-xl bg-gray-50 px-4 py-3">
                  <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-gray-400">
                    <MapPin size={13} />
                    Property address
                  </div>
                  <p className="mt-2 text-sm font-medium text-gray-900">{fallbackAddress(lead.property_address)}</p>
                </div>
                <div className="rounded-xl bg-gray-50 px-4 py-3">
                  <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-gray-400">
                    <MapPin size={13} />
                    Campaign
                  </div>
                  <p className="mt-2 text-sm font-medium text-gray-900">
                    {fallbackCampaignName(campaign?.name)} · {fallbackCampaignType(campaign?.campaign_type)}
                  </p>
                </div>
                <div className="rounded-xl bg-gray-50 px-4 py-3">
                  <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-gray-400">
                    <CalendarClock size={13} />
                    Follow-up due
                  </div>
                  <p className="mt-2 text-sm font-medium text-gray-900">
                    {lead.next_follow_up_at
                      ? format(new Date(lead.next_follow_up_at), "MMM d, yyyy h:mm a")
                      : "Not scheduled"}
                  </p>
                </div>
                <div className="rounded-xl bg-gray-50 px-4 py-3">
                  <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-gray-400">
                    <CalendarClock size={13} />
                    Last contacted
                  </div>
                  <p className="mt-2 text-sm font-medium text-gray-900">
                    {lead.last_contacted_at ? format(new Date(lead.last_contacted_at), "MMM d, yyyy h:mm a") : "Not contacted yet"}
                  </p>
                </div>
              </div>

              <div className="mt-3 rounded-xl bg-gray-50 px-4 py-3">
                <p className="text-xs uppercase tracking-wide text-gray-400">Summary</p>
                <p className="mt-2 text-sm text-gray-700">{lead.notes_summary ?? "No summary yet — waiting for more info"}</p>
              </div>

              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <div className="rounded-xl bg-gray-50 px-4 py-3">
                  <p className="text-xs uppercase tracking-wide text-gray-400">Motivation score</p>
                  <p className="mt-2 text-2xl font-semibold text-gray-900">{lead.motivation_score}</p>
                </div>
                <div className="rounded-xl bg-gray-50 px-4 py-3">
                  <p className="text-xs uppercase tracking-wide text-gray-400">Next action</p>
                  <p className="mt-2 text-sm font-medium text-gray-900">{getNextAction(lead)}</p>
                </div>
              </div>
            </section>

            <section className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
              <div className="flex items-center gap-2">
                <MessageSquare size={15} className="text-gray-400" />
                <h2 className="text-sm font-semibold text-gray-900">Message history</h2>
              </div>
              <div className="mt-3 space-y-3">
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
                        {message.direction === "outbound" ? "Outbound" : "Inbound"} • {format(new Date(message.created_at), "MMM d, yyyy h:mm a")}
                      </p>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-gray-400">No messages for this lead yet.</p>
                )}
              </div>
            </section>
          </div>

          <div className="space-y-4">
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
