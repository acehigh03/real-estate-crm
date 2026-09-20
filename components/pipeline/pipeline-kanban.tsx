"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import {
  closestCorners,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { CalendarClock, GripVertical, MessageSquare, Phone } from "lucide-react";

import { CardIdentityLines, EmptyColumn, urgencyStyle } from "@/components/dashboard/PipelineBoard";
import { COLUMN_BY_KEY, nextActionFor, urgencyFor, type BoardColumnKey } from "@/lib/board";
import type { BoardColumnData, BoardLead } from "@/lib/dashboard";
import { formatDate, formatMoney, formatMoneyCompact, isPast, timeAgo } from "@/lib/format";

type Board = Record<BoardColumnKey, BoardLead[]>;

const stageBadge: Record<string, string> = {
  New: "bg-[var(--slate-100)] text-[var(--slate-700)] dark:bg-white/10 dark:text-[var(--c-text-2)]",
  "Skip Traced": "bg-[var(--c-accent-soft)] text-[var(--c-accent-strong)]",
  Contacted: "bg-[var(--c-accent-soft)] text-[var(--c-accent-strong)]",
  Replied: "bg-[var(--c-emerald-soft)] text-[var(--c-emerald-text)]",
  "Follow Up": "bg-[var(--c-amber-soft)] text-[var(--c-amber-text)]",
  "Hot Lead": "bg-[var(--c-rose-soft)] text-[var(--c-rose-text)]",
  "Offer Sent": "bg-[var(--c-accent-soft)] text-[var(--c-accent-strong)]",
};

const findColumn = (board: Board, id: string): BoardColumnKey | null => {
  if (id in board) return id as BoardColumnKey;
  for (const key of Object.keys(board) as BoardColumnKey[]) if (board[key].some((lead) => lead.id === id)) return key;
  return null;
};

function CardBody({
  lead,
  onValue,
  onFollowUp,
  handle,
}: {
  lead: BoardLead;
  onValue?: (id: string, value: number | null) => Promise<string | null>;
  onFollowUp?: (id: string, date: string) => Promise<string | null>;
  handle?: React.ReactNode;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [picking, setPicking] = useState(false);
  const [date, setDate] = useState("");
  const [error, setError] = useState("");
  const urgency = urgencyFor(lead.last_contacted_at);
  const overdue = isPast(lead.next_follow_up_at);
  const action = nextActionFor(lead);

  async function saveValue() {
    setEditing(false);
    const cleaned = draft.replace(/[^0-9.]/g, "");
    const next = cleaned === "" ? null : Number(cleaned);
    if (next === (lead.deal_value ?? null) || (next !== null && Number.isNaN(next))) return;
    const failure = await onValue?.(lead.id, next);
    if (failure) setError(failure);
  }

  async function saveFollowUp() {
    if (!date) return;
    const failure = await onFollowUp?.(lead.id, date);
    if (failure) return setError(failure);
    setPicking(false);
    setDate("");
  }

  return (
    <div className="rounded-xl border border-[var(--c-border)] bg-[var(--c-surface)] p-3.5 shadow-sm">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <Link href={`/leads/${lead.id}`} className="block hover:opacity-80"><CardIdentityLines lead={lead} /></Link>
        </div>
        {handle}
      </div>

      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
        <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${stageBadge[lead.stage ?? "New"] ?? stageBadge.New}`}>{lead.stage ?? "New"}</span>
        <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${urgencyStyle[urgency]}`}>{urgency}</span>
        {editing ? (
          <input
            autoFocus
            inputMode="numeric"
            aria-label="Deal value"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onBlur={() => void saveValue()}
            onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); if (event.key === "Escape") setEditing(false); }}
            className="num w-24 rounded-full border border-[var(--c-accent)] bg-[var(--c-surface)] px-2 py-0.5 text-[11.5px] text-[var(--c-text)] outline-none"
          />
        ) : (
          <button type="button" onClick={() => { setDraft(lead.deal_value ? String(lead.deal_value) : ""); setEditing(true); setError(""); }} title="Click to edit deal value" className={`num rounded-full px-2 py-0.5 text-[11.5px] font-medium ${lead.deal_value ? "bg-[var(--c-emerald-soft)] text-[var(--c-emerald-text)]" : "border border-dashed border-[var(--c-border)] text-[var(--c-muted)]"}`}>
            {lead.deal_value ? formatMoney(lead.deal_value) : "+ deal value"}
          </button>
        )}
      </div>

      <dl className="mt-2.5 grid grid-cols-2 gap-2 border-t border-[var(--c-border)] pt-2.5 text-[11.5px]">
        <div><dt className="text-[var(--c-muted)]">Last contact</dt><dd className="num text-[var(--c-text-2)]">{timeAgo(lead.last_contacted_at)}</dd></div>
        <div><dt className="text-[var(--c-muted)]">Next follow-up</dt><dd className={`num ${overdue ? "text-[var(--c-rose-text)]" : "text-[var(--c-text-2)]"}`}>{lead.next_follow_up_at ? formatDate(lead.next_follow_up_at) : "Not set"}</dd></div>
      </dl>

      <p className={`mt-2 text-[12px] ${action.overdue ? "font-medium text-[var(--c-rose-text)]" : "text-[var(--c-text-2)]"}`}>{action.label}</p>

      <div className="mt-3 flex items-center gap-1.5">
        <Link href={`/inbox?lead=${lead.id}`} className="inline-flex items-center gap-1 rounded-lg border border-[var(--c-border)] px-2.5 py-1.5 text-[12px] font-medium text-[var(--c-text-2)] hover:bg-[var(--c-surface-2)]"><MessageSquare size={13} aria-hidden />Text</Link>
        <a href={`tel:${lead.phone}`} className="inline-flex items-center gap-1 rounded-lg border border-[var(--c-border)] px-2.5 py-1.5 text-[12px] font-medium text-[var(--c-text-2)] hover:bg-[var(--c-surface-2)]"><Phone size={13} aria-hidden />Call</a>
        <button type="button" onClick={() => setPicking((open) => !open)} aria-expanded={picking} className="inline-flex items-center gap-1 rounded-lg border border-[var(--c-border)] px-2.5 py-1.5 text-[12px] font-medium text-[var(--c-text-2)] hover:bg-[var(--c-surface-2)]"><CalendarClock size={13} aria-hidden />Follow-up</button>
      </div>
      {picking && (
        <div className="mt-2 flex items-center gap-2">
          <input type="date" aria-label="Follow-up date" value={date} onChange={(event) => setDate(event.target.value)} className="min-w-0 flex-1 rounded-lg border border-[var(--c-border)] bg-[var(--c-surface)] px-2 py-1 text-[12px] text-[var(--c-text)]" />
          <button type="button" onClick={() => void saveFollowUp()} disabled={!date} className="rounded-lg bg-[var(--c-accent)] px-3 py-1.5 text-[12px] font-semibold text-white disabled:opacity-50">Save</button>
        </div>
      )}
      {error && <p role="alert" className="mt-2 text-[11.5px] text-[var(--c-rose-text)]">{error}</p>}
    </div>
  );
}

function SortableCard(props: { lead: BoardLead; onValue: (id: string, value: number | null) => Promise<string | null>; onFollowUp: (id: string, date: string) => Promise<string | null> }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: props.lead.id });
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.35 : 1 }}>
      <CardBody
        {...props}
        handle={
          <button ref={setActivatorNodeRef} type="button" aria-label="Drag to move or reorder" className="-mr-1 cursor-grab touch-none rounded p-1 text-[var(--c-muted)] hover:bg-[var(--c-surface-2)] active:cursor-grabbing" {...attributes} {...listeners}>
            <GripVertical size={16} aria-hidden />
          </button>
        }
      />
    </div>
  );
}

function Column({ column, leads, total, hidden, onValue, onFollowUp }: {
  column: Pick<BoardColumnData, "key" | "label" | "emptyText" | "emptyHref">;
  leads: BoardLead[];
  total: number;
  hidden: number;
  onValue: (id: string, value: number | null) => Promise<string | null>;
  onFollowUp: (id: string, date: string) => Promise<string | null>;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: column.key });
  return (
    <section aria-label={column.label} className="flex min-w-[290px] flex-1 flex-col rounded-2xl border border-[var(--c-border)] bg-[var(--c-surface-2)]">
      <header className="flex items-center justify-between px-4 pb-2 pt-3.5">
        <h2 className="text-[13.5px] font-semibold text-[var(--c-text)]">{column.label} <span className="num ml-1 font-medium text-[var(--c-muted)]">{leads.length + hidden}</span></h2>
        <span className="num text-[12.5px] font-medium text-[var(--c-text-2)]" title="Total deal value in this column">{formatMoneyCompact(total)}</span>
      </header>
      <div ref={setNodeRef} className={`flex min-h-[140px] flex-1 flex-col gap-2.5 rounded-b-2xl px-3 pb-3 transition-colors ${isOver ? "bg-[var(--c-accent-soft)]" : ""}`}>
        <SortableContext items={leads.map((lead) => lead.id)} strategy={verticalListSortingStrategy}>
          {leads.map((lead) => <SortableCard key={lead.id} lead={lead} onValue={onValue} onFollowUp={onFollowUp} />)}
        </SortableContext>
        {leads.length === 0 && (
          <EmptyColumn columnKey={column.key} text={column.emptyText} href={column.emptyHref} minHeight={96} />
        )}
        {hidden > 0 && <p className="px-1 text-[12px] text-[var(--c-muted)]"><span className="num">{hidden}</span> more not shown</p>}
      </div>
    </section>
  );
}

export function PipelineKanban({ initialColumns }: { initialColumns: BoardColumnData[] }) {
  const meta = useMemo(() => initialColumns.map((column) => ({ key: column.key, label: column.label, emptyText: column.emptyText, emptyHref: column.emptyHref })), [initialColumns]);
  // Count and value that exist beyond the leads loaded on screen; constant while dragging.
  const hidden = useMemo(
    () => Object.fromEntries(initialColumns.map((column) => [column.key, { count: Math.max(0, column.count - column.leads.length), value: Math.max(0, column.value - column.leads.reduce((sum, lead) => sum + Number(lead.deal_value ?? 0), 0)) }])) as Record<BoardColumnKey, { count: number; value: number }>,
    [initialColumns]
  );

  const [board, setBoard] = useState<Board>(() => Object.fromEntries(initialColumns.map((column) => [column.key, column.leads])) as Board);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const snapshot = useRef<Board | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const activeLead = activeId ? Object.values(board).flat().find((lead) => lead.id === activeId) ?? null : null;
  const grandTotal = (Object.keys(board) as BoardColumnKey[]).reduce((sum, key) => sum + hidden[key].value + board[key].reduce((s, lead) => s + Number(lead.deal_value ?? 0), 0), 0);

  function onDragStart(event: DragStartEvent) {
    snapshot.current = board;
    setActiveId(String(event.active.id));
  }

  function onDragOver(event: DragOverEvent) {
    const { active, over } = event;
    if (!over) return;
    const from = findColumn(board, String(active.id));
    const to = findColumn(board, String(over.id));
    if (!from || !to || from === to) return;
    setBoard((current) => {
      const moving = current[from].find((lead) => lead.id === active.id);
      if (!moving) return current;
      const overIndex = current[to].findIndex((lead) => lead.id === over.id);
      const insertAt = overIndex >= 0 ? overIndex : current[to].length;
      return { ...current, [from]: current[from].filter((lead) => lead.id !== active.id), [to]: [...current[to].slice(0, insertAt), moving, ...current[to].slice(insertAt)] };
    });
  }

  async function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveId(null);
    const before = snapshot.current;
    snapshot.current = null;
    if (!over || !before) return;

    const originalColumn = findColumn(before, String(active.id));
    const column = findColumn(board, String(active.id));
    if (!column || !originalColumn) return;

    // Same-column reorder (cross-column moves were already applied in onDragOver).
    let next = board;
    const overIndex = board[column].findIndex((lead) => lead.id === over.id);
    const activeIndex = board[column].findIndex((lead) => lead.id === active.id);
    if (overIndex >= 0 && overIndex !== activeIndex) {
      next = { ...board, [column]: arrayMove(board[column], activeIndex, overIndex) };
      setBoard(next);
    }

    const orderedIds = next[column].map((lead) => lead.id);
    const orderChanged = orderedIds.join() !== before[column].map((lead) => lead.id).join();
    if (column === originalColumn && !orderChanged) return;

    setError("");
    try {
      const response = await fetch("/api/leads/stage", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(
          column !== originalColumn
            ? { lead_ids: [String(active.id)], column, ordered_ids: orderedIds }
            : { lead_ids: orderedIds, ordered_ids: orderedIds }
        ),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error ?? "Couldn't save that move.");
      if (column !== originalColumn) {
        const stage = COLUMN_BY_KEY[column].write.stage;
        setBoard((current) => ({ ...current, [column]: current[column].map((lead) => (lead.id === active.id ? { ...lead, stage } : lead)) }));
      }
      if (data?.positioned === false) setError("Moved — but card order can't be saved until the latest database update is applied.");
    } catch (caught) {
      setBoard(before);
      setError(caught instanceof Error ? caught.message : "Couldn't save that move.");
    }
  }

  const mapLeads = (id: string, change: Partial<BoardLead>) =>
    setBoard((current) => Object.fromEntries((Object.keys(current) as BoardColumnKey[]).map((key) => [key, current[key].map((lead) => (lead.id === id ? { ...lead, ...change } : lead))])) as Board);

  async function saveValue(id: string, value: number | null): Promise<string | null> {
    const response = await fetch(`/api/leads/${id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ deal_value: value }) }).catch(() => null);
    const data = await response?.json().catch(() => null);
    if (!response?.ok) return data?.error ?? "Couldn't save the deal value.";
    mapLeads(id, { deal_value: value });
    return null;
  }

  async function saveFollowUp(id: string, date: string): Promise<string | null> {
    const at = new Date(`${date}T09:00:00`).toISOString();
    const response = await fetch(`/api/leads/${id}/followup`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ date, at }) }).catch(() => null);
    const data = await response?.json().catch(() => null);
    if (!response?.ok) return data?.error ?? "Couldn't schedule the follow-up.";
    mapLeads(id, { next_follow_up_at: at });
    return null;
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-[var(--c-page)]">
      <header className="flex shrink-0 flex-wrap items-end justify-between gap-3 border-b border-[var(--c-border)] bg-[var(--c-surface)] px-4 py-4 sm:px-8">
        <div>
          <h1 className="h-display text-[26px]">Pipeline</h1>
          <p className="mt-0.5 text-[13px] text-[var(--c-muted)]">Drag cards between columns to change stage, or up and down to reorder. Click a deal value to edit it.</p>
        </div>
        <div className="text-right"><p className="text-[12px] text-[var(--c-muted)]">Pipeline value</p><p className="metric text-[26px] text-[var(--c-accent-strong)]">{formatMoney(grandTotal)}</p></div>
      </header>
      {error && <div role="alert" className="mx-4 mt-3 rounded-xl border border-[var(--c-rose)]/30 bg-[var(--c-rose-soft)] px-4 py-2.5 text-[13px] text-[var(--c-rose-text)] sm:mx-8">{error}</div>}
      <main className="flex-1 overflow-auto px-4 py-5 sm:px-8">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={onDragStart}
          onDragOver={onDragOver}
          onDragEnd={(event) => void onDragEnd(event)}
          onDragCancel={() => { if (snapshot.current) setBoard(snapshot.current); snapshot.current = null; setActiveId(null); }}
        >
          <div className="flex min-h-full gap-4">
            {meta.map((column) => (
              <Column
                key={column.key}
                column={column}
                leads={board[column.key]}
                hidden={hidden[column.key].count}
                total={hidden[column.key].value + board[column.key].reduce((sum, lead) => sum + Number(lead.deal_value ?? 0), 0)}
                onValue={saveValue}
                onFollowUp={saveFollowUp}
              />
            ))}
          </div>
          <DragOverlay>{activeLead ? <div className="rotate-1 opacity-95"><CardBody lead={activeLead} /></div> : null}</DragOverlay>
        </DndContext>
      </main>
    </div>
  );
}
