"use client";

import Link from "next/link";
import { format } from "date-fns";
import { ArrowRight, FileSpreadsheet, MessageSquareText, PanelsTopLeft } from "lucide-react";

import { formatPhoneDisplay, leadDisplayName, messageSnippet } from "@/lib/utils";
import type { Database } from "@/types/database";

type Lead = Database["public"]["Tables"]["leads"]["Row"];
type Message = Database["public"]["Tables"]["messages"]["Row"];

interface Props {
  userName: string;
  userInitials: string;
  counts: {
    totalLeads: number;
    contactedLeads: number;
    repliesReceived: number;
    hotLeads: number;
    dueToday: number;
  };
  dueLeads: Lead[];
  recentReplies: Array<{ lead: Lead; message: Message }>;
  hotLeadRows: Array<{ lead: Lead; lastMessage: Message | null }>;
  campaignPerformance: Array<{
    id: string;
    name: string;
    campaign_type: string | null;
    messaged_count: number;
    replied_count: number;
    hot_count: number;
    total_leads: number;
    conversionRate: number;
  }>;
}

export function DashboardClient({
  userName,
  counts,
  dueLeads,
  recentReplies,
  hotLeadRows,
  campaignPerformance,
}: Props) {
  const quickActions = [
    {
      title: "Import CSV",
      description: "Upload fresh seller records and start sorting opportunities.",
      href: "/leads",
      icon: FileSpreadsheet,
    },
    {
      title: "Start SMS",
      description: "Open your inbox and begin conversations with motivated sellers.",
      href: "/inbox",
      icon: MessageSquareText,
    },
    {
      title: "Pipeline Board",
      description: "Review every active deal stage in one focused workspace.",
      href: "/pipeline",
      icon: PanelsTopLeft,
    },
  ];

  const heroStats = [
    { label: "Total Leads", value: counts.totalLeads },
    { label: "Hot Leads", value: counts.hotLeads },
    { label: "Replies", value: counts.repliesReceived },
    { label: "Due Today", value: counts.dueToday },
  ];

  return (
    <div className="crm-page flex flex-1 flex-col overflow-auto">
      <div className="crm-page-header flex h-14 shrink-0 items-center justify-between px-6">
        <h1 className="crm-header-title">Dashboard</h1>
        <Link href="/pipeline" className="crm-button-primary">
          Open pipeline
        </Link>
      </div>

      <div className="flex-1 space-y-4 overflow-auto px-6 py-4">
        <section className="relative overflow-hidden rounded-xl border border-[#e8edf2] bg-white">
          <div className="absolute bottom-0 left-0 top-0 w-1 bg-[#00c08b]" />
          <div className="px-5 py-4">
            <h2 className="text-[18px] font-semibold text-[#1a1f36]">Welcome back, {userName}.</h2>
            <p className="mt-1 text-[13px] text-[#6b7c93]">
              {counts.dueToday} follow-ups due today · {counts.repliesReceived} new replies waiting.
            </p>

            <div className="mt-4 grid grid-cols-2 gap-4 border-t border-[#e8edf2] pt-4 md:grid-cols-4">
              {heroStats.map((stat) => (
                <div key={stat.label}>
                  <p className="text-[11px] text-[#6b7c93]">{stat.label}</p>
                  <p className="mt-1 text-[22px] font-semibold leading-none text-[#1a1f36]">{stat.value}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-3">
          {quickActions.map((action) => (
            <div key={action.title} className="crm-panel p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#eaf9f5]">
                <action.icon size={18} className="text-[#00c08b]" />
              </div>
              <h3 className="mt-3 text-[14px] font-semibold text-[#1a1f36]">{action.title}</h3>
              <p className="mt-1 text-[13px] text-[#6b7c93]">{action.description}</p>
              <Link href={action.href} className="mt-3 inline-flex items-center gap-1.5 text-[13px] font-medium text-[#1a1f36]">
                Open
                <ArrowRight size={13} />
              </Link>
            </div>
          ))}
        </section>

        <section className="grid gap-4 xl:grid-cols-2">
          <div className="crm-panel p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="crm-section-title">Hot Leads</h3>
              <span className="text-[12px] text-[#6b7c93]">{counts.hotLeads}</span>
            </div>
            <div className="space-y-2">
              {hotLeadRows.length ? (
                hotLeadRows.map(({ lead, lastMessage }) => (
                  <div key={lead.id} className="flex items-center justify-between gap-3 rounded-lg border border-[#e8edf2] px-3 py-2.5">
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-medium text-[#1a1f36]">{leadDisplayName(lead)}</p>
                      <p className="truncate text-[12px] text-[#6b7c93]">
                        {formatPhoneDisplay(lead.phone)} · {messageSnippet(lastMessage?.body, 36)}
                      </p>
                    </div>
                    <Link href={`/leads/${lead.id}`} className="rounded-[6px] bg-[#1a1f36] px-3 py-2 text-[11px] font-medium text-white">
                      Open
                    </Link>
                  </div>
                ))
              ) : (
                <p className="text-[13px] text-[#6b7c93]">No hot leads yet</p>
              )}
            </div>
          </div>

          <div className="crm-panel p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="crm-section-title">New Replies</h3>
              <span className="text-[12px] text-[#6b7c93]">{counts.repliesReceived}</span>
            </div>
            <div className="space-y-2">
              {recentReplies.length ? (
                recentReplies.map(({ lead, message }) => (
                  <div key={message.id} className="rounded-lg border border-[#e8edf2] px-3 py-2.5">
                    <div className="flex items-center justify-between gap-3">
                      <p className="truncate text-[13px] font-medium text-[#1a1f36]">{leadDisplayName(lead)}</p>
                      <span className="text-[11px] text-[#6b7c93]">{format(new Date(message.created_at), "h:mm a")}</span>
                    </div>
                    <p className="mt-1 truncate text-[12px] text-[#6b7c93]">{messageSnippet(message.body, 60)}</p>
                  </div>
                ))
              ) : (
                <p className="text-[13px] text-[#6b7c93]">No replies yet</p>
              )}
            </div>
          </div>
        </section>

        <section className="grid gap-4 xl:grid-cols-2">
          <div className="crm-panel p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="crm-section-title">Follow-ups Due</h3>
              <span className="text-[12px] text-[#6b7c93]">{counts.dueToday}</span>
            </div>
            <div className="space-y-2">
              {dueLeads.length ? (
                dueLeads.map((lead) => {
                  const followUpDate = lead.next_follow_up_at ? new Date(lead.next_follow_up_at) : null;
                  return (
                    <div key={lead.id} className="flex items-center justify-between gap-3 rounded-lg border border-[#e8edf2] px-3 py-2.5">
                      <div className="min-w-0">
                        <p className="truncate text-[13px] font-medium text-[#1a1f36]">{leadDisplayName(lead)}</p>
                        <p className="truncate text-[12px] text-[#6b7c93]">
                          {followUpDate ? format(followUpDate, "MMM d, h:mm a") : "Now"}
                        </p>
                      </div>
                      <Link href="/inbox" className="rounded-[6px] border border-[#e8edf2] px-3 py-2 text-[11px] font-medium text-[#1a1f36]">
                        Send Now
                      </Link>
                    </div>
                  );
                })
              ) : (
                <p className="text-[13px] text-[#6b7c93]">No follow-ups yet</p>
              )}
            </div>
          </div>

          <div className="crm-panel p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="crm-section-title">Campaign Performance</h3>
              <span className="text-[12px] text-[#6b7c93]">{campaignPerformance.length}</span>
            </div>
            {campaignPerformance.length ? (
              <div className="overflow-hidden rounded-lg border border-[#e8edf2]">
                <table className="w-full text-left text-[12px]">
                  <thead className="bg-[#f8f9fb] text-[#6b7c93]">
                    <tr>
                      <th className="px-3 py-2 font-medium">Campaign</th>
                      <th className="px-3 py-2 font-medium">Sent</th>
                      <th className="px-3 py-2 font-medium">Replied</th>
                      <th className="px-3 py-2 font-medium">Hot</th>
                      <th className="px-3 py-2 font-medium">Conv.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {campaignPerformance.slice(0, 6).map((campaign) => (
                      <tr key={campaign.id} className="border-t border-[#e8edf2]">
                        <td className="px-3 py-2 text-[#1a1f36]">{campaign.name}</td>
                        <td className="px-3 py-2 text-[#6b7c93]">{campaign.messaged_count}</td>
                        <td className="px-3 py-2 text-[#6b7c93]">{campaign.replied_count}</td>
                        <td className="px-3 py-2 text-[#6b7c93]">{campaign.hot_count}</td>
                        <td className="px-3 py-2 text-[#1a1f36]">{campaign.conversionRate}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-[13px] text-[#6b7c93]">No campaign performance yet</p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
