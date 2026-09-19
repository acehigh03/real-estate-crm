"use client";

import Link from "next/link";
import { ArrowDownLeft, ArrowUpRight } from "lucide-react";

import type { TodayActivity as Activity } from "@/lib/dashboard";
import { formatShort } from "@/lib/format";

export function TodayActivity({ activity }: { activity: Activity }) {
  return (
    <section aria-label="Today's activity" className="rounded-2xl border border-[var(--c-border)] bg-[var(--c-surface)] p-4">
      <h2 className="text-[15px] font-semibold text-[var(--c-text)]">Today</h2>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <div><p className="num text-2xl font-medium text-[var(--c-text)]">{activity.textsSent}</p><p className="text-[12px] text-[var(--c-muted)]">texts sent</p></div>
        <div><p className="num text-2xl font-medium text-[var(--c-text)]">{activity.repliesReceived}</p><p className="text-[12px] text-[var(--c-muted)]">replies received</p></div>
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
