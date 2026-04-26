"use client";

import { format } from "date-fns";
import { Bell } from "lucide-react";

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
    { label: "Total Leads", value: counts.totalLeads, tone: "text-gray-900" },
    { label: "Contacted Leads", value: counts.contactedLeads, tone: "text-[#16a37f]" },
    { label: "Replies Received", value: counts.repliesReceived, tone: "text-sky-600" },
    { label: "Hot Leads", value: counts.hotLeads, tone: "text-rose-600" },
    { label: "Follow-ups Due Today", value: counts.dueToday, tone: "text-amber-600" },
  ];

  return (
    <div className="flex flex-1 flex-col overflow-auto bg-white">
      <div className="flex shrink-0 items-center justify-between border-b bg-white px-8 py-5">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900">
            Seller follow-up
          </h1>
          <p className="mt-1 text-sm text-gray-500">Welcome back, {userName}</p>
        </div>
        <div className="flex items-center gap-3">
          <button className="rounded-full p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition">
            <Bell size={18} />
          </button>
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#16a37f] text-[13px] font-semibold text-white">
            {userInitials}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto px-8 py-6 space-y-6">
        <div className="grid grid-cols-2 gap-4 xl:grid-cols-5">
          {cards.map((card) => (
            <div
              key={card.label}
              className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm"
            >
              <p className="text-[12px] font-medium uppercase tracking-wider text-gray-400">
                {card.label}
              </p>
              <p className={`mt-2 text-3xl font-semibold ${card.tone}`}>{card.value}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <p className="text-[13px] font-semibold text-gray-800">Follow-ups Due</p>
              <span className="text-xs text-gray-400">{counts.dueToday} due today</span>
            </div>
            <div className="space-y-3">
              {dueLeads.length ? (
                dueLeads.map((lead) => (
                  <div key={lead.id} className="rounded-xl border border-gray-100 px-4 py-3">
                    <p className="font-medium text-gray-900">
                      {lead.first_name} {lead.last_name}
                    </p>
                    <p className="mt-1 text-sm text-gray-500">{lead.property_address}</p>
                    <p className="mt-2 text-xs text-gray-400">
                      Due {lead.next_follow_up_at ? format(new Date(lead.next_follow_up_at), "MMM d, yyyy h:mm a") : lead.follow_up_date ? format(new Date(lead.follow_up_date), "MMM d, yyyy") : "now"}
                    </p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-gray-400">No follow-ups are due right now.</p>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <p className="text-[13px] font-semibold text-gray-800">Recent Replies</p>
              <span className="text-xs text-gray-400">{counts.repliesReceived} replies received</span>
            </div>
            <div className="space-y-3">
              {recentReplies.length ? (
                recentReplies.map(({ lead, message }) => (
                  <div key={message.id} className="rounded-xl border border-gray-100 px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-medium text-gray-900">
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
