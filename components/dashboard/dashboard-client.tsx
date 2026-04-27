"use client";

import { format } from "date-fns";
import { Bell, Flame, Inbox, MessageCircleReply, Users, CalendarClock } from "lucide-react";

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

export function DashboardClient({
  userName,
  userInitials,
  counts,
  dueLeads,
  recentReplies,
}: Props) {
  const cards = [
    { label: "Total leads", value: counts.totalLeads, icon: Users },
    { label: "Contacted", value: counts.contactedLeads, icon: Inbox },
    { label: "Replies", value: counts.repliesReceived, icon: MessageCircleReply },
    { label: "Hot leads", value: counts.hotLeads, icon: Flame },
    { label: "Due today", value: counts.dueToday, icon: CalendarClock },
  ];

  return (
    <div className="crm-page flex flex-1 flex-col overflow-auto">
      <div className="crm-page-header flex shrink-0 items-center justify-between px-8 py-6">
        <div>
          <h1 className="crm-header-title">Seller Pipeline</h1>
          <p className="crm-header-copy">Welcome back, {userName}</p>
        </div>
        <div className="flex items-center gap-3">
          <button className="rounded-md border border-slate-200 bg-white p-2 text-gray-400 hover:bg-gray-50 hover:text-gray-600 transition">
            <Bell size={18} />
          </button>
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#16a37f] text-[13px] font-semibold text-white">
            {userInitials}
          </div>
        </div>
      </div>

      <div className="flex-1 space-y-8 overflow-auto px-8 py-8">
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-5">
          {cards.map((card) => (
            <div
              key={card.label}
              className="rounded-lg border border-slate-200 bg-white p-4"
            >
              <div className="flex items-center justify-between">
                <p className="text-xs tracking-wide text-slate-400">
                  {card.label}
                </p>
                <div className="flex h-7 w-7 items-center justify-center rounded-md bg-slate-50 text-slate-400">
                  <card.icon size={14} strokeWidth={1.6} />
                </div>
              </div>
              <p className="mt-3 text-[2rem] font-bold leading-none text-slate-900">{card.value}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="crm-panel p-6">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <p className="crm-section-title">Follow-ups Due</p>
              </div>
              <span className="text-xs text-gray-400">{counts.dueToday} due today</span>
            </div>
            <div className="space-y-3">
              {dueLeads.length ? (
                dueLeads.map((lead) => (
                  <div key={lead.id} className="crm-muted-surface px-4 py-4">
                    <p className="text-sm font-semibold text-gray-900">
                      {lead.first_name} {lead.last_name}
                    </p>
                    <p className="mt-1 text-sm text-gray-500">{lead.property_address}</p>
                    <p className="mt-2 text-xs text-gray-400">
                      Due {lead.next_follow_up_at ? format(new Date(lead.next_follow_up_at), "MMM d, yyyy h:mm a") : "now"}
                    </p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-gray-400">No follow-ups are due right now.</p>
              )}
            </div>
          </div>

          <div className="crm-panel p-6">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <p className="crm-section-title">Recent Replies</p>
              </div>
              <span className="text-xs text-gray-400">{counts.repliesReceived} replies received</span>
            </div>
            <div className="space-y-3">
              {recentReplies.length ? (
                recentReplies.map(({ lead, message }) => (
                  <div key={message.id} className="crm-muted-surface px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-gray-900">
                        {lead.first_name} {lead.last_name}
                      </p>
                      <span className="text-xs text-gray-400">
                        {format(new Date(message.created_at), "MMM d")}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-gray-500">{lead.property_address}</p>
                    <p className="mt-2 text-sm text-gray-700 line-clamp-2">{message.body}</p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-gray-400">No inbound replies yet.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
