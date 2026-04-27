"use client";

import Link from "next/link";
import { format } from "date-fns";
import {
  ArrowRight,
  CalendarClock,
  FileSpreadsheet,
  MessageCircleReply,
  MessageSquareText,
  PanelsTopLeft,
} from "lucide-react";

import { getClassificationLabel } from "@/lib/ai/classify-lead";
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
}

function classificationPill(classification: Lead["classification"]) {
  if (classification === "HOT") return "bg-[#eaf9f5] text-[#00c08b]";
  if (classification === "WARM") return "bg-[#fef3c7] text-[#92400e]";
  if (classification === "COLD") return "bg-[#ede9fe] text-[#5b21b6]";
  return "bg-[#f3f4f6] text-[#6b7280]";
}

export function DashboardClient({
  userName,
  counts,
  dueLeads,
  recentReplies,
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
      <div className="crm-page-header flex h-14 shrink-0 items-center justify-between px-8">
        <h1 className="crm-header-title">Dashboard</h1>
        <Link href="/pipeline" className="crm-button-primary">
          Open pipeline
        </Link>
      </div>

      <div className="flex-1 space-y-6 overflow-auto px-8 py-6">
        {/* Hero card */}
        <section className="relative overflow-hidden rounded-xl border border-[#e8edf2] bg-white">
          <div className="absolute bottom-0 left-0 top-0 w-1 bg-[#00c08b]" />
          <div className="px-7 py-6">
            <h2 className="text-[18px] font-semibold text-[#1a1f36]">
              Welcome back, {userName}.
            </h2>
            <p className="mt-1 text-[13px] text-[#6b7c93]">
              {counts.dueToday} follow-ups due today · {counts.repliesReceived} new replies waiting.
            </p>

            <div className="mt-5 grid grid-cols-2 gap-6 border-t border-[#e8edf2] pt-5 md:grid-cols-4">
              {heroStats.map((stat) => (
                <div key={stat.label}>
                  <p className="text-[11px] uppercase tracking-wide text-[#6b7c93]">{stat.label}</p>
                  <p className="mt-1.5 text-[28px] font-semibold leading-none text-[#1a1f36]">{stat.value}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Quick actions */}
        <section className="grid gap-4 lg:grid-cols-3">
          {quickActions.map((action) => (
            <div key={action.title} className="crm-panel p-5">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#eaf9f5]">
                <action.icon size={18} className="text-[#00c08b]" />
              </div>
              <h3 className="mt-4 text-[14px] font-semibold text-[#1a1f36]">{action.title}</h3>
              <p className="mt-1.5 text-[13px] text-[#6b7c93]">{action.description}</p>
              <Link
                href={action.href}
                className="mt-4 inline-flex items-center gap-1.5 text-[13px] font-medium text-[#1a1f36]"
              >
                Open
                <ArrowRight size={13} />
              </Link>
            </div>
          ))}
        </section>

        {/* Follow-ups + Replies */}
        <section className="grid gap-4 lg:grid-cols-2">
          <div className="crm-panel p-5">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="crm-section-title">Follow-ups due</h3>
              <span className="text-[12px] text-[#6b7c93]">{counts.dueToday} today</span>
            </div>
            <div className="space-y-2">
              {dueLeads.length ? (
                dueLeads.map((lead) => {
                  const followUpDate = lead.next_follow_up_at ? new Date(lead.next_follow_up_at) : null;
                  const isOverdue = followUpDate ? followUpDate < new Date() : true;
                  return (
                    <div key={lead.id} className="flex items-center justify-between rounded-lg border border-[#e8edf2] bg-white px-4 py-3">
                      <div className="min-w-0">
                        <p className="truncate text-[13px] font-medium text-[#1a1f36]">
                          {lead.first_name} {lead.last_name}
                        </p>
                        <p className="mt-0.5 truncate text-[12px] text-[#6b7c93]">{lead.property_address}</p>
                      </div>
                      <span className={`ml-4 shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium ${isOverdue ? "bg-[#fef2f2] text-[#e5484d]" : "bg-[#f3f4f6] text-[#6b7c93]"}`}>
                        <CalendarClock size={11} className="mr-1 inline" />
                        {followUpDate ? format(followUpDate, "h:mm a") : "Now"}
                      </span>
                    </div>
                  );
                })
              ) : (
                <p className="text-[13px] text-[#6b7c93]">No follow-ups are due right now.</p>
              )}
            </div>
          </div>

          <div className="crm-panel p-5">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="crm-section-title">Recent replies</h3>
              <span className="text-[12px] text-[#6b7c93]">{counts.repliesReceived} total</span>
            </div>
            <div className="space-y-2">
              {recentReplies.length ? (
                recentReplies.map(({ lead, message }) => (
                  <div key={message.id} className="rounded-lg border border-[#e8edf2] bg-white px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-[13px] font-medium text-[#1a1f36]">
                        {lead.first_name} {lead.last_name}
                      </p>
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${classificationPill(lead.classification)}`}>
                        {getClassificationLabel(lead.classification)}
                      </span>
                    </div>
                    <p className="mt-0.5 text-[12px] text-[#6b7c93]">{lead.property_address}</p>
                    <div className="mt-2 flex items-start gap-1.5 text-[13px] text-[#1a1f36]">
                      <MessageCircleReply size={13} className="mt-0.5 shrink-0 text-[#6b7c93]" />
                      <p className="line-clamp-2">{message.body}</p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-[13px] text-[#6b7c93]">No inbound replies yet.</p>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
