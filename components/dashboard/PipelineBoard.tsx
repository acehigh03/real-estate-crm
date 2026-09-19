"use client";

import Link from "next/link";
import { ArrowRight, Handshake, Plus, Search, Send, type LucideIcon } from "lucide-react";

import type { BoardColumnData, BoardLead } from "@/lib/dashboard";
import { COLUMN_BY_KEY, cardIdentity, nextActionFor, urgencyFor, type BoardColumnKey, type Urgency } from "@/lib/board";
import { formatMoneyCompact, formatMoney, formatPhone, formatShort } from "@/lib/format";

export const urgencyStyle: Record<Urgency, string> = {
  Hot: "bg-[var(--c-rose-soft)] text-[var(--c-rose-text)]",
  Warm: "bg-[var(--c-amber-soft)] text-[var(--c-amber-text)]",
  Cold: "bg-[var(--slate-100)] text-[var(--slate-500)] dark:bg-white/10",
};

const EMPTY_ICON: Record<BoardColumnKey, LucideIcon> = { new: Plus, skip_traced: Search, contacted: Send, negotiating: Handshake };

/** Empty column: icon, a call to action when there is one (otherwise plain text), and a supporting hint. */
export function EmptyColumn({ columnKey, text, href, minHeight = 96 }: { columnKey: BoardColumnKey; text: string; href: string | null; minHeight?: number }) {
  const Icon = EMPTY_ICON[columnKey];
  const hint = COLUMN_BY_KEY[columnKey].emptyHint;
  const body = (
    <>
      <span aria-hidden className="icon-chip icon-chip-accent h-9 w-9 rounded-full"><Icon size={17} strokeWidth={2} /></span>
      <span className={`text-[13.5px] ${href ? "font-semibold text-[var(--c-accent-strong)]" : "font-medium text-[var(--c-text-2)]"}`}>{text}</span>
      <span className="max-w-[220px] text-[12px] leading-snug text-[var(--c-muted)]">{hint}</span>
    </>
  );
  const box = "flex flex-col items-center justify-center gap-1.5 rounded-2xl border border-dashed px-4 py-4 text-center";
  return href ? (
    <Link href={href} style={{ minHeight }} className={`${box} border-[var(--c-accent-border)] hover:bg-[var(--c-accent-soft)]`}>{body}</Link>
  ) : (
    <div style={{ minHeight }} className={`${box} border-[var(--c-border)]`}>{body}</div>
  );
}

/** Seller name, then address, then phone (small, muted, mono). */
export function CardIdentityLines({ lead }: { lead: Pick<BoardLead, "first_name" | "last_name" | "phone" | "property_address"> }) {
  const identity = cardIdentity(lead, formatPhone);
  return (
    <>
      <p className={`truncate text-[13.5px] text-[var(--c-text)] ${identity.phoneOnly ? "font-medium" : "font-semibold"}`} style={identity.phoneOnly ? { fontFamily: "var(--font-mono)" } : undefined}>{identity.primary}</p>
      {identity.secondary && <p className="mt-0.5 truncate text-[12px] text-[var(--c-text-2)]">{identity.secondary}</p>}
      {identity.phone && <p className="mt-0.5 truncate text-sm text-slate-400" style={{ fontFamily: "var(--font-mono)" }}>{identity.phone}</p>}
    </>
  );
}

/** One lead on the compact dashboard board. */
function LeadCard({ lead }: { lead: BoardLead }) {
  const urgency = urgencyFor(lead.last_contacted_at);
  const action = nextActionFor(lead);
  return (
    <Link href={`/leads/${lead.id}`} className="block rounded-2xl border border-[var(--c-border)] bg-[var(--c-surface)] p-3.5 shadow-sm transition-shadow hover:shadow-md">
      <CardIdentityLines lead={lead} />
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${urgencyStyle[urgency]}`}>{urgency}</span>
        {lead.deal_value ? <span className="num rounded-full bg-[var(--c-emerald-soft)] px-2 py-0.5 text-[11px] font-medium text-[var(--c-emerald-text)]">{formatMoney(lead.deal_value)}</span> : null}
      </div>
      <p className={`mt-2 border-t border-[var(--c-border)] pt-2 text-[11.5px] ${action.overdue ? "font-medium text-[var(--c-rose-text)]" : "text-[var(--c-muted)]"}`}>{action.label}</p>
    </Link>
  );
}

export function PipelineBoard({ columns }: { columns: BoardColumnData[] }) {
  return (
    <section aria-label="Pipeline" className="c-card p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-[17px] font-bold text-[var(--c-text)]">Pipeline</h2>
        <Link href="/pipeline" className="inline-flex items-center gap-1 text-[13px] font-medium text-[var(--c-accent-strong)] hover:underline">
          Open full board <ArrowRight size={14} aria-hidden />
        </Link>
      </div>
      <div className="grid grid-flow-col auto-cols-[minmax(160px,1fr)] gap-4 overflow-x-auto overscroll-x-contain pb-2">
        {columns.map((column) => (
          <div key={column.key} className="flex min-w-0 flex-col">
            <div className="mb-2 flex items-center justify-between px-1">
              <span className="text-[13.5px] font-bold text-[var(--c-text)]">
                {column.label} <span className="num ml-1 text-[var(--c-muted)]">{column.count}</span>
              </span>
              {column.value > 0 && <span className="num text-[11.5px] text-[var(--c-muted)]">{formatMoneyCompact(column.value)}</span>}
            </div>
            <div className="space-y-2">
              {column.leads.length ? (
                column.leads.map((lead) => <LeadCard key={lead.id} lead={lead} />)
              ) : (
                <EmptyColumn columnKey={column.key} text={column.emptyText} href={column.emptyHref} />
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
