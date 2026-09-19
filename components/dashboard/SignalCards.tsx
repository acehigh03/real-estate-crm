"use client";

import Link from "next/link";
import { ArrowUpRight, BarChart3, TriangleAlert, Users } from "lucide-react";

import { formatMoney, formatMoneyCompact } from "@/lib/format";
import { IconChip } from "./IconChip";

const card = "c-card group relative flex flex-col p-6";
const question = "text-[14px] font-medium text-[var(--c-text-2)]";
const arrow = "absolute right-5 top-5 text-[var(--c-muted)] opacity-0 transition-opacity group-hover:opacity-100";

export function SignalCards({ unreadReplies, newLeads, atRiskCount, atRiskValue, overdueFollowUps, staleOffers, pipelineValue, activeDeals }: {
  unreadReplies: number; newLeads: number; atRiskCount: number; atRiskValue: number; overdueFollowUps: number; staleOffers: number; pipelineValue: number; activeDeals: number;
}) {
  return (
    <section aria-label="Signals" className="grid gap-5 sm:grid-cols-2 sm:[&>*:nth-child(3)]:col-span-2 xl:grid-cols-3 xl:[&>*:nth-child(3)]:col-span-1">
      <Link href="/messenger" className={card}>
        <p className={question}>Who do I contact?</p>
        <div className="mt-4 flex items-center gap-3.5">
          <IconChip icon={Users} tone="accent" />
          <span className="metric text-[40px] text-[var(--c-text)]">{unreadReplies}</span>
        </div>
        <p className="mt-3 text-[13.5px] text-[var(--c-text-2)]">{unreadReplies === 1 ? "seller reply is" : "seller replies are"} waiting on you</p>
        <p className="mt-5 border-t border-[var(--c-border)] pt-4 text-[13px] text-[var(--c-muted)]">
          <span className="num text-[var(--c-text-2)]">{newLeads}</span> new {newLeads === 1 ? "lead" : "leads"} not yet texted
        </p>
        <ArrowUpRight size={16} className={arrow} aria-hidden />
      </Link>

      <Link href="/pipeline" className={card}>
        <p className={question}>What is at risk?</p>
        <div className="mt-4 flex items-center gap-3.5">
          <IconChip icon={TriangleAlert} tone="amber" />
          <span className="metric text-[40px] text-[var(--c-text)]">{atRiskCount}</span>
          <span className="text-[13px] text-[var(--c-text-2)]">{atRiskCount === 1 ? "deal" : "deals"} ·</span>
          <span className="num text-[15px] font-medium text-[var(--c-amber-text)]">{formatMoney(atRiskValue)}</span>
        </div>
        <ul className="mt-5 space-y-2 border-t border-[var(--c-border)] pt-4 text-[13px] text-[var(--c-text-2)]">
          <li className="flex justify-between"><span>Overdue follow-up</span><span className="num text-[var(--c-amber-text)]">{overdueFollowUps}</span></li>
          <li className="flex justify-between"><span>Stale offer (7+ days quiet)</span><span className="num text-[var(--c-amber-text)]">{staleOffers}</span></li>
        </ul>
        <ArrowUpRight size={16} className={arrow} aria-hidden />
      </Link>

      <Link href="/pipeline" className={card}>
        <p className={question}>How much money is moving?</p>
        <div className="mt-4 flex items-center gap-3.5">
          <IconChip icon={BarChart3} tone="accent" />
          <span title={formatMoney(pipelineValue)} className="metric truncate text-[40px] text-[var(--c-accent-strong)]">{formatMoneyCompact(pipelineValue)}</span>
        </div>
        <p className="mt-3 text-[13.5px] text-[var(--c-text-2)]">estimated pipeline value</p>
        <p className="mt-5 border-t border-[var(--c-border)] pt-4 text-[13px] text-[var(--c-muted)]">
          <span className="num text-[var(--c-text-2)]">{activeDeals}</span> {activeDeals === 1 ? "deal" : "deals"} in negotiation
        </p>
        <ArrowUpRight size={16} className={arrow} aria-hidden />
      </Link>
    </section>
  );
}
