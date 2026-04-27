import Link from "next/link";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import { ArrowLeft, CalendarClock, Mail, MapPin, MessageSquare, Phone } from "lucide-react";

import { getClassificationLabel } from "@/lib/ai/classify-lead";
import { getLeadDetailData } from "@/lib/data";
import { fallbackAddress, fallbackCampaignName, fallbackCampaignType, formatClassificationColor, formatPhoneDisplay, formatStatusColor, leadDisplayName } from "@/lib/utils";
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
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  try {
    const { lead, notes, followups, messages, campaign, lastInboundMessage } = await getLeadDetailData(id);
    const isLowInfo =
      ((!lead.property_address?.trim() && !lead.mailing_address?.trim()) ||
        ((lastInboundMessage?.body?.trim().length ?? 0) > 0 && (lastInboundMessage?.body?.trim().length ?? 0) < 10));

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

        <div className="grid flex-1 gap-4 overflow-auto px-6 py-4 xl:grid-cols-[1.15fr_0.85fr]">
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
                Update status, mock AI classification, notes, and follow-up details in one place.
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
