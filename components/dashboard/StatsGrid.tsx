"use client";

import { DollarSign, MessageSquare, Send, Users } from "lucide-react";

import { formatMoneyCompact } from "@/lib/format";
import { IconChip } from "./IconChip";

export function StatsGrid({ contacted, replies, offersSent, pipelineValue }: { contacted: number; replies: number; offersSent: number; pipelineValue: number }) {
  const items = [
    { label: "Leads contacted", value: contacted.toLocaleString("en-US"), icon: Users, tone: "accent" as const },
    { label: "Replies", value: replies.toLocaleString("en-US"), icon: MessageSquare, tone: "emerald" as const },
    { label: "Offers sent", value: offersSent.toLocaleString("en-US"), icon: Send, tone: "accent" as const },
    { label: "Pipeline value", value: formatMoneyCompact(pipelineValue), icon: DollarSign, tone: "amber" as const },
  ];
  return (
    <section aria-label="Stats" className="grid grid-cols-2 gap-4">
      {items.map((item) => (
        <div key={item.label} className="c-card min-w-0 p-4">
          <div className="flex items-center gap-2.5">
            <IconChip icon={item.icon} tone={item.tone} size={34} shape="square" />
            <p className="min-w-0 text-[12.5px] font-medium leading-tight text-[var(--c-text-2)]">{item.label}</p>
          </div>
          <p className="metric mt-3 truncate text-[28px] text-[var(--c-text)]">{item.value}</p>
        </div>
      ))}
    </section>
  );
}
