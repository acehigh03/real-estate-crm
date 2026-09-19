"use client";

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

import { formatMoney } from "@/lib/format";

const card = "group relative flex flex-col rounded-2xl border border-[var(--c-border)] bg-[var(--c-surface)] p-5 transition-shadow hover:shadow-md";

export function SignalCards({ unreadReplies, newLeads, atRiskCount, atRiskValue, overdueFollowUps, staleOffers, pipelineValue, activeDeals }: {
  unreadReplies: number; newLeads: number; atRiskCount: number; atRiskValue: number; overdueFollowUps: number; staleOffers: number; pipelineValue: number; activeDeals: number;
}) {
  return (
    <section aria-label="Signals" className="grid gap-4 md:grid-cols-3">
      <Link href="/messenger" className={card}>
        <p className="text-[13px] font-medium text-[var(--c-muted)]">Who do I contact?</p>
        <p className="num mt-3 text-4xl font-medium text-[var(--c-text)]">{unreadReplies}</p>
        <p className="mt-1 text-[13px] text-[var(--c-text-2)]">{unreadReplies === 1 ? "seller reply is" : "seller replies are"} waiting on you</p>
        <p className="mt-4 border-t border-[var(--c-border)] pt-3 text-[12.5px] text-[var(--c-muted)]">
          <span className="num text-[var(--c-text-2)]">{newLeads}</span> new {newLeads === 1 ? "lead" : "leads"} not yet texted
        </p>
        <ArrowUpRight size={16} className="absolute right-4 top-4 text-[var(--c-muted)] opacity-0 transition-opacity group-hover:opacity-100" aria-hidden />
      </Link>

      <Link href="/pipeline" className={`${card}`}>
        <p className="text-[13px] font-medium text-[var(--c-muted)]">What is at risk?</p>
        <p className="mt-3 flex items-baseline gap-2">
          <span className="num text-4xl font-medium text-[var(--c-text)]">{atRiskCount}</span>
          <span className="text-[13px] text-[var(--c-text-2)]">{atRiskCount === 1 ? "deal" : "deals"} ·</span>
          <span className="num text-[15px] font-medium text-[var(--c-amber-text)]">{formatMoney(atRiskValue)}</span>
        </p>
        <ul className="mt-4 space-y-1.5 border-t border-[var(--c-border)] pt-3 text-[12.5px] text-[var(--c-text-2)]">
          <li className="flex justify-between"><span>Overdue follow-up</span><span className="num text-[var(--c-amber-text)]">{overdueFollowUps}</span></li>
          <li className="flex justify-between"><span>Stale offer (7+ days quiet)</span><span className="num text-[var(--c-amber-text)]">{staleOffers}</span></li>
        </ul>
        <ArrowUpRight size={16} className="absolute right-4 top-4 text-[var(--c-muted)] opacity-0 transition-opacity group-hover:opacity-100" aria-hidden />
      </Link>

      <Link href="/pipeline" className={card}>
        <p className="text-[13px] font-medium text-[var(--c-muted)]">How much money is moving?</p>
        <p className="num mt-3 text-4xl font-medium text-[var(--c-accent-strong)]">{formatMoney(pipelineValue)}</p>
        <p className="mt-1 text-[13px] text-[var(--c-text-2)]">estimated pipeline value</p>
        <p className="mt-4 border-t border-[var(--c-border)] pt-3 text-[12.5px] text-[var(--c-muted)]">
          <span className="num text-[var(--c-text-2)]">{activeDeals}</span> {activeDeals === 1 ? "deal" : "deals"} in negotiation
        </p>
        <ArrowUpRight size={16} className="absolute right-4 top-4 text-[var(--c-muted)] opacity-0 transition-opacity group-hover:opacity-100" aria-hidden />
      </Link>
    </section>
  );
}
