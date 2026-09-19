"use client";

import { formatMoney } from "@/lib/format";

export function StatsGrid({ contacted, replies, offersSent, pipelineValue }: { contacted: number; replies: number; offersSent: number; pipelineValue: number }) {
  const items = [
    { label: "Leads contacted", value: contacted.toLocaleString("en-US") },
    { label: "Replies", value: replies.toLocaleString("en-US") },
    { label: "Offers sent", value: offersSent.toLocaleString("en-US") },
    { label: "Pipeline value", value: formatMoney(pipelineValue) },
  ];
  return (
    <section aria-label="Stats" className="grid grid-cols-2 gap-3">
      {items.map((item) => (
        <div key={item.label} className="rounded-2xl border border-[var(--c-border)] bg-[var(--c-surface)] p-4">
          <p className="text-[12px] font-medium text-[var(--c-muted)]">{item.label}</p>
          <p className="num mt-1.5 truncate text-[22px] font-medium text-[var(--c-text)]">{item.value}</p>
        </div>
      ))}
    </section>
  );
}
