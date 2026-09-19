"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";

import type { BoardColumnData, BoardLead } from "@/lib/dashboard";
import { boardColumnFor, leadFullName, nextActionFor, urgencyFor, type Urgency } from "@/lib/board";
import { formatMoneyCompact, formatMoney, formatPhone, formatShort, isPast } from "@/lib/format";

export const urgencyStyle: Record<Urgency, string> = {
  Hot: "bg-[var(--c-rose-soft)] text-[var(--c-rose-text)]",
  Warm: "bg-[var(--c-amber-soft)] text-[var(--c-amber-text)]",
  Cold: "bg-[var(--slate-100)] text-[var(--slate-500)] dark:bg-white/10",
};

/** One lead on the compact dashboard board. */
function LeadCard({ lead }: { lead: BoardLead }) {
  const column = boardColumnFor({ stage: lead.stage, status: lead.status, is_dnc: false });
  const urgency = urgencyFor(lead.last_contacted_at);
  const action = nextActionFor(lead, column);
  const overdue = isPast(lead.next_follow_up_at);
  return (
    <Link href={`/leads/${lead.id}`} className="block rounded-xl border border-[var(--c-border)] bg-[var(--c-surface)] p-3 transition-shadow hover:shadow-md">
      <p className="truncate text-[13.5px] font-semibold text-[var(--c-text)]">{lead.property_address}</p>
      <p className="mt-0.5 truncate text-[12px] text-[var(--c-muted)]">{leadFullName(lead)}</p>
      <p className="num mt-1 text-[12px] text-[var(--c-text-2)]">{formatPhone(lead.phone)}</p>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${urgencyStyle[urgency]}`}>{urgency}</span>
        {lead.deal_value ? <span className="num rounded-full bg-[var(--c-emerald-soft)] px-2 py-0.5 text-[11px] font-medium text-[var(--c-emerald-text)]">{formatMoney(lead.deal_value)}</span> : null}
      </div>
      <p className={`mt-2 border-t border-[var(--c-border)] pt-2 text-[11.5px] ${overdue ? "text-[var(--c-rose-text)]" : "text-[var(--c-muted)]"}`}>
        {action.label}
        {action.at ? <span className="num"> · {formatShort(action.at)}</span> : null}
      </p>
    </Link>
  );
}

export function PipelineBoard({ columns }: { columns: BoardColumnData[] }) {
  return (
    <section aria-label="Pipeline" className="rounded-2xl border border-[var(--c-border)] bg-[var(--c-surface-2)] p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-[15px] font-semibold text-[var(--c-text)]">Pipeline</h2>
        <Link href="/pipeline" className="inline-flex items-center gap-1 text-[13px] font-medium text-[var(--c-accent-strong)] hover:underline">
          Open full board <ArrowRight size={14} aria-hidden />
        </Link>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {columns.map((column) => (
          <div key={column.key} className="flex min-w-0 flex-col">
            <div className="mb-2 flex items-center justify-between px-1">
              <span className="text-[12.5px] font-semibold text-[var(--c-text-2)]">
                {column.label} <span className="num ml-1 text-[var(--c-muted)]">{column.count}</span>
              </span>
              {column.value > 0 && <span className="num text-[11.5px] text-[var(--c-muted)]">{formatMoneyCompact(column.value)}</span>}
            </div>
            <div className="space-y-2">
              {column.leads.length ? (
                column.leads.map((lead) => <LeadCard key={lead.id} lead={lead} />)
              ) : (
                <Link href={column.emptyHref} className="flex min-h-[88px] items-center justify-center rounded-xl border border-dashed border-[var(--c-accent)]/60 px-3 text-center text-[13px] font-medium text-[var(--c-accent-strong)] hover:bg-[var(--c-accent-soft)]">
                  {column.emptyText}
                </Link>
              )}
              {column.count > column.leads.length && (
                <Link href="/pipeline" className="block px-1 text-[12px] text-[var(--c-muted)] hover:text-[var(--c-accent-strong)]">
                  + <span className="num">{column.count - column.leads.length}</span> more
                </Link>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
