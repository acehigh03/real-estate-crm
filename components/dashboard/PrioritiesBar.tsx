"use client";

import Link from "next/link";
import { AlarmClock, Flame, Hourglass } from "lucide-react";

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** The three things to do first: hot replies (loudest), overdue follow-ups, stalled offers. */
export function PrioritiesBar({ unreadReplies, overdueFollowUps, stalledOffers }: { unreadReplies: number; overdueFollowUps: number; stalledOffers: number }) {
  return (
    <section aria-label="Today's priorities" className="flex flex-wrap items-center gap-2.5">
      <Link
        href="/messenger"
        className="inline-flex items-center gap-2 rounded-xl bg-[var(--c-rose)] px-4 py-2.5 text-[13.5px] font-semibold text-white shadow-sm transition-colors hover:bg-[#e11d48]"
      >
        <Flame size={16} aria-hidden />
        {unreadReplies > 0 ? (
          <>
            <span className="num">{unreadReplies}</span> hot {unreadReplies === 1 ? "reply" : "replies"} waiting
          </>
        ) : (
          "No replies waiting"
        )}
      </Link>
      <Link
        href="/pipeline"
        className="inline-flex items-center gap-1.5 rounded-full border border-[var(--c-amber)]/40 bg-[var(--c-amber-soft)] px-3 py-1.5 text-[13px] font-medium text-[var(--c-amber-text)]"
      >
        <AlarmClock size={14} aria-hidden />
        <span className="num">{overdueFollowUps}</span> overdue {overdueFollowUps === 1 ? "follow-up" : "follow-ups"}
      </Link>
      <Link
        href="/pipeline"
        className="inline-flex items-center gap-1.5 rounded-full border border-[var(--c-accent-border)] bg-[var(--c-accent-soft)] px-3 py-1.5 text-[13px] font-medium text-[var(--c-accent-strong)]"
      >
        <Hourglass size={14} aria-hidden />
        <span className="num">{stalledOffers}</span> stalled {plural(stalledOffers, "offer").replace(/^\d+ /, "")}
      </Link>
    </section>
  );
}
