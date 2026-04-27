"use client";

import Link from "next/link";
import { format } from "date-fns";
import {
  ArrowRight,
  CalendarClock,
  FileSpreadsheet,
  Flame,
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
  if (classification === "HOT") {
    return "bg-emerald-50 text-emerald-700";
  }
  if (classification === "WARM") {
    return "bg-amber-50 text-amber-700";
  }
  if (classification === "COLD") {
    return "bg-indigo-50 text-indigo-700";
  }
  return "bg-gray-100 text-gray-600";
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
      iconClasses: "bg-emerald-50 text-emerald-600",
    },
    {
      title: "Start SMS",
      description: "Open your inbox and begin conversations with motivated sellers.",
      href: "/inbox",
      icon: MessageSquareText,
      iconClasses: "bg-amber-50 text-amber-600",
    },
    {
      title: "Pipeline Board",
      description: "Review every active deal stage in one focused workspace.",
      href: "/pipeline",
      icon: PanelsTopLeft,
      iconClasses: "bg-blue-50 text-blue-600",
    },
  ];

  const heroStats = [
    { label: "Total leads", value: counts.totalLeads },
    { label: "Hot leads", value: counts.hotLeads },
    { label: "Replies", value: counts.repliesReceived },
    { label: "Due today", value: counts.dueToday },
  ];

  return (
    <div className="crm-page flex flex-1 flex-col overflow-auto">
      <div className="crm-page-header flex items-center justify-between px-8 py-4">
        <div>
          <h1 className="text-[14px] font-medium text-[#0f1117]">Dashboard</h1>
        </div>
        <Link href="/pipeline" className="crm-button-primary">
          Open pipeline
        </Link>
      </div>

      <div className="flex-1 space-y-8 overflow-auto px-8 py-8">
        <section className="relative overflow-hidden rounded-[10px] bg-[linear-gradient(135deg,#0f1117,#1a2540,#0f3460)] px-7 py-7 text-white">
          <div className="absolute right-[-5rem] top-[-3rem] h-52 w-52 rounded-full bg-[radial-gradient(circle,_rgba(16,185,129,0.35),_transparent_65%)]" />
          <div className="relative max-w-3xl">
            <span className="inline-flex items-center rounded-full bg-emerald-500/18 px-3 py-1 text-xs font-medium text-emerald-200">
              LIVE
            </span>
            <h2 className="mt-4 text-[2rem] font-semibold tracking-tight">
              Welcome back, {userName}.
            </h2>
            <p className="mt-2 text-sm text-slate-300">
              {counts.dueToday} follow-ups due today and {counts.repliesReceived} new replies waiting for you.
            </p>

            <div className="mt-6 grid grid-cols-2 gap-4 rounded-[10px] border border-white/10 bg-white/5 p-4 md:grid-cols-4">
              {heroStats.map((stat) => (
                <div key={stat.label}>
                  <p className="text-xs text-slate-300">{stat.label}</p>
                  <p className="mt-2 text-2xl font-semibold text-white">{stat.value}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-3">
          {quickActions.map((action) => (
            <div key={action.title} className="crm-panel p-5">
              <div className={`flex h-10 w-10 items-center justify-center rounded-[10px] ${action.iconClasses}`}>
                <action.icon size={18} />
              </div>
              <h3 className="mt-4 text-base font-semibold text-[#0f1117]">{action.title}</h3>
              <p className="mt-2 text-sm text-[#6b7280]">{action.description}</p>
              <Link
                href={action.href}
                className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-[#0f1117]"
              >
                Open
                <ArrowRight size={14} />
              </Link>
            </div>
          ))}
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <div className="crm-panel p-5">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-base font-semibold text-[#0f1117]">Follow-ups due</h3>
              <span className="text-xs text-[#6b7280]">{counts.dueToday} today</span>
            </div>
            <div className="space-y-3">
              {dueLeads.length ? (
                dueLeads.map((lead) => (
                  <div key={lead.id} className="flex items-center justify-between rounded-[10px] border border-[#eaecf0] bg-white px-4 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-[#0f1117]">
                        {lead.first_name} {lead.last_name}
                      </p>
                      <p className="mt-1 truncate text-sm text-[#6b7280]">{lead.property_address}</p>
                    </div>
                    <span className="ml-4 shrink-0 rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700">
                      {lead.next_follow_up_at
                        ? format(new Date(lead.next_follow_up_at), "h:mm a")
                        : "Now"}
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-sm text-[#6b7280]">No follow-ups are due right now.</p>
              )}
            </div>
          </div>

          <div className="crm-panel p-5">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-base font-semibold text-[#0f1117]">Recent replies</h3>
              <span className="text-xs text-[#6b7280]">{counts.repliesReceived} total</span>
            </div>
            <div className="space-y-3">
              {recentReplies.length ? (
                recentReplies.map(({ lead, message }) => (
                  <div key={message.id} className="rounded-[10px] border border-[#eaecf0] bg-white px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-medium text-[#0f1117]">
                        {lead.first_name} {lead.last_name}
                      </p>
                      <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${classificationPill(lead.classification)}`}>
                        {getClassificationLabel(lead.classification)}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-[#6b7280]">{lead.property_address}</p>
                    <div className="mt-3 flex items-start gap-2 text-sm text-[#4b5563]">
                      <MessageCircleReply size={14} className="mt-0.5 text-[#9ca3af]" />
                      <p className="line-clamp-2">{message.body}</p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-[#6b7280]">No inbound replies yet.</p>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
