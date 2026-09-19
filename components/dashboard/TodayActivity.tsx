"use client";

import Link from "next/link";
import { ArrowDownLeft, ArrowUpRight, CalendarDays } from "lucide-react";

import type { TodayActivity as Activity } from "@/lib/dashboard";
import { formatShort } from "@/lib/format";
import { IconChip } from "./IconChip";

export function TodayActivity({ activity }: { activity: Activity }) {
  return (
    <section aria-label="Today's activity" className="c-card p-5">
      <h2 className="flex items-center gap-2.5 text-[16px] font-bold text-[var(--c-text)]"><IconChip icon={CalendarDays} tone="accent" size={34} shape="square" />Today</h2>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <div><p className="metric text-[28px] text-[var(--c-text)]">{activity.textsSent}</p><p className="text-[12px] text-[var(--c-muted)]">texts sent</p></div>
        <div><p className="metric text-[28px] text-[var(--c-text)]">{activity.repliesReceived}</p><p className="text-[12px] text-[var(--c-muted)]">replies received</p></div>
      </div>
      {activity.events.length > 0 && (
        <ul className="mt-3 space-y-2 border-t border-[var(--c-border)] pt-3">
          {activity.events.slice(0, 5).map((event) => (
            <li key={event.id} className="flex items-center gap-2 text-[12.5px]">
              {event.kind === "sent" ? <ArrowUpRight size={13} className="shrink-0 text-[var(--c-accent-strong)]" aria-hidden /> : <ArrowDownLeft size={13} className="shrink-0 text-[var(--c-emerald-text)]" aria-hidden />}
              {event.lead_id ? <Link href={`/messenger?lead=${event.lead_id}`} className="min-w-0 flex-1 truncate text-[var(--c-text-2)] hover:text-[var(--c-accent-strong)]">{event.name}</Link> : <span className="min-w-0 flex-1 truncate text-[var(--c-text-2)]">{event.name}</span>}
              <span className="num shrink-0 text-[11px] text-[var(--c-muted)]">{formatShort(event.at)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
