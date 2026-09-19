"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, MessageSquare, Search, X } from "lucide-react";

import { EDITABLE_STAGES, leadFullName, writeForStage } from "@/lib/board";
import { formatDate, formatMoney, formatPhone, isPast, timeAgo } from "@/lib/format";
import type { Database, LeadStage } from "@/types/database";

type Lead = Database["public"]["Tables"]["leads"]["Row"];
type SortKey = "name" | "address" | "stage" | "deal_value" | "last_contact" | "next_follow_up" | "source";

const PAGE_SIZE = 50;

const stageBadge: Record<string, string> = {
  New: "bg-[var(--slate-100)] text-[var(--slate-700)] dark:bg-white/10 dark:text-[var(--c-text-2)]",
  "Skip Traced": "bg-[var(--c-accent-soft)] text-[var(--c-accent-strong)]",
  Contacted: "bg-[var(--c-accent-soft)] text-[var(--c-accent-strong)]",
  Replied: "bg-[var(--c-emerald-soft)] text-[var(--c-emerald-text)]",
  "Follow Up": "bg-[var(--c-amber-soft)] text-[var(--c-amber-text)]",
  "Hot Lead": "bg-[var(--c-rose-soft)] text-[var(--c-rose-text)]",
  "Offer Sent": "bg-[var(--c-accent-soft)] text-[var(--c-accent-strong)]",
  Dead: "bg-[var(--slate-100)] text-[var(--slate-500)] dark:bg-white/10",
  Closed: "bg-[var(--slate-100)] text-[var(--slate-500)] dark:bg-white/10",
  DNC: "bg-[var(--c-rose-soft)] text-[var(--c-rose-text)]",
};

const stageOf = (lead: Lead): string => (lead.is_dnc || lead.status === "DNC" ? "DNC" : lead.stage ?? "New");
const sourceOf = (lead: Lead) => lead.lead_source || lead.tag || "";
const time = (value: string | null) => (value ? new Date(value).getTime() : 0);

const sorters: Record<SortKey, (a: Lead, b: Lead) => number> = {
  name: (a, b) => leadFullName(a).localeCompare(leadFullName(b)),
  address: (a, b) => a.property_address.localeCompare(b.property_address),
  stage: (a, b) => stageOf(a).localeCompare(stageOf(b)),
  deal_value: (a, b) => Number(a.deal_value ?? -1) - Number(b.deal_value ?? -1),
  last_contact: (a, b) => time(a.last_contacted_at) - time(b.last_contacted_at),
  next_follow_up: (a, b) => (time(a.next_follow_up_at) || Infinity) - (time(b.next_follow_up_at) || Infinity),
  source: (a, b) => sourceOf(a).localeCompare(sourceOf(b)),
};

const dateInput = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("en-CA") : "");

export function ContactsTable({ initialLeads, loadError }: { initialLeads: Lead[]; loadError: string }) {
  const [leads, setLeads] = useState(initialLeads);
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState("all");
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "last_contact", dir: "desc" });
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [openId, setOpenId] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ tone: "ok" | "error"; text: string } | null>(loadError ? { tone: "error", text: loadError } : null);
  const [bulkStage, setBulkStage] = useState("");
  const [bulkBusy, setBulkBusy] = useState(false);
  const [textOpen, setTextOpen] = useState(false);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    const digits = query.replace(/\D/g, "");
    const rows = leads.filter((lead) => {
      if (stageFilter !== "all" && stageOf(lead) !== stageFilter) return false;
      if (!query) return true;
      return (
        leadFullName(lead).toLowerCase().includes(query) ||
        lead.property_address.toLowerCase().includes(query) ||
        (digits.length >= 3 && lead.phone.replace(/\D/g, "").includes(digits))
      );
    });
    const compare = sorters[sort.key];
    return [...rows].sort((a, b) => (sort.dir === "asc" ? compare(a, b) : compare(b, a)));
  }, [leads, search, stageFilter, sort]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const rows = filtered.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);
  useEffect(() => { setPage(0); }, [search, stageFilter, sort]);

  const allOnPage = rows.length > 0 && rows.every((lead) => selected.has(lead.id));
  const open = openId ? leads.find((lead) => lead.id === openId) ?? null : null;

  const toggleSort = (key: SortKey) => setSort((current) => (current.key === key ? { key, dir: current.dir === "asc" ? "desc" : "asc" } : { key, dir: key === "name" || key === "address" || key === "source" || key === "stage" ? "asc" : "desc" }));
  const toggleRow = (id: string) => setSelected((current) => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next; });

  async function applyBulkStage() {
    if (!bulkStage || !selected.size) return;
    setBulkBusy(true);
    setNotice(null);
    try {
      const ids = [...selected];
      const response = await fetch("/api/leads/stage", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ lead_ids: ids, stage: bulkStage }) });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error ?? "Couldn't change the stage.");
      const write = writeForStage(bulkStage as LeadStage);
      setLeads((current) => current.map((lead) => (selected.has(lead.id) && write ? { ...lead, ...write, classification: write.classification ?? lead.classification } : lead)));
      setNotice({ tone: "ok", text: `Moved ${data?.moved ?? ids.length} ${ids.length === 1 ? "contact" : "contacts"} to ${bulkStage}.` });
      setSelected(new Set());
      setBulkStage("");
    } catch (caught) {
      setNotice({ tone: "error", text: caught instanceof Error ? caught.message : "Couldn't change the stage." });
    } finally {
      setBulkBusy(false);
    }
  }

  const header = (key: SortKey, label: string, className = "") => (
    <th scope="col" aria-sort={sort.key === key ? (sort.dir === "asc" ? "ascending" : "descending") : "none"} className={`px-3 py-2.5 text-left ${className}`}>
      <button type="button" onClick={() => toggleSort(key)} className="inline-flex items-center gap-1 text-[12px] font-semibold uppercase tracking-wide text-[var(--c-muted)] hover:text-[var(--c-text)]">
        {label}
        {sort.key === key && (sort.dir === "asc" ? <ArrowUp size={12} aria-hidden /> : <ArrowDown size={12} aria-hidden />)}
      </button>
    </th>
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-[var(--c-page)]">
      <header className="shrink-0 border-b border-[var(--c-border)] bg-[var(--c-surface)] px-4 py-4 sm:px-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="h-display text-[26px]">Contacts</h1>
            <p className="mt-0.5 text-[13px] text-[var(--c-muted)]"><span className="num">{filtered.length.toLocaleString("en-US")}</span> of <span className="num">{leads.length.toLocaleString("en-US")}</span> leads</p>
          </div>
          <Link href="/import" className="rounded-lg border border-[var(--c-border)] px-3 py-2 text-[13px] font-medium text-[var(--c-text-2)] hover:bg-[var(--c-surface-2)]">Import CSV</Link>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2.5">
          <div className="relative min-w-[240px] flex-1 sm:max-w-md">
            <Search size={15} aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--c-muted)]" />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name, phone or address" aria-label="Search contacts" className="w-full rounded-lg border border-[var(--c-border)] bg-[var(--c-surface-2)] py-2 pl-9 pr-3 text-[13.5px] text-[var(--c-text)] outline-none focus:border-[var(--c-accent)]" />
          </div>
          <select value={stageFilter} onChange={(event) => setStageFilter(event.target.value)} aria-label="Filter by stage" className="rounded-lg border border-[var(--c-border)] bg-[var(--c-surface)] px-3 py-2 text-[13.5px] text-[var(--c-text)]">
            <option value="all">All stages</option>
            {[...EDITABLE_STAGES, "DNC" as const].map((stage) => <option key={stage} value={stage}>{stage}</option>)}
          </select>
        </div>
      </header>

      {selected.size > 0 && (
        <div className="flex shrink-0 flex-wrap items-center gap-3 border-b border-[var(--c-accent-border)] bg-[var(--c-accent-soft)] px-4 py-2.5 sm:px-8">
          <span className="text-[13px] font-semibold text-[var(--c-accent-strong)]"><span className="num">{selected.size}</span> selected</span>
          <select value={bulkStage} onChange={(event) => setBulkStage(event.target.value)} aria-label="Change stage to" className="rounded-lg border border-[var(--c-border)] bg-[var(--c-surface)] px-2.5 py-1.5 text-[13px] text-[var(--c-text)]">
            <option value="">Change stage to…</option>
            {EDITABLE_STAGES.map((stage) => <option key={stage} value={stage}>{stage}</option>)}
          </select>
          <button type="button" onClick={() => void applyBulkStage()} disabled={!bulkStage || bulkBusy} className="rounded-lg bg-[var(--c-accent)] px-3 py-1.5 text-[13px] font-semibold text-white disabled:opacity-50">{bulkBusy ? "Applying…" : "Apply"}</button>
          <button type="button" onClick={() => setTextOpen(true)} className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--c-border)] bg-[var(--c-surface)] px-3 py-1.5 text-[13px] font-medium text-[var(--c-text-2)]"><MessageSquare size={14} aria-hidden />Text selected</button>
          <button type="button" onClick={() => setSelected(new Set())} className="ml-auto text-[13px] font-medium text-[var(--c-muted)] hover:text-[var(--c-text)]">Clear</button>
        </div>
      )}
      {notice && <div role={notice.tone === "error" ? "alert" : "status"} className={`mx-4 mt-3 rounded-xl px-4 py-2.5 text-[13px] sm:mx-8 ${notice.tone === "error" ? "border border-[var(--c-rose)]/30 bg-[var(--c-rose-soft)] text-[var(--c-rose-text)]" : "border border-[var(--c-emerald)]/30 bg-[var(--c-emerald-soft)] text-[var(--c-emerald-text)]"}`}>{notice.text}</div>}

      <main className="min-h-0 flex-1 overflow-auto px-4 py-4 sm:px-8">
        <div className="overflow-x-auto rounded-2xl border border-[var(--c-border)] bg-[var(--c-surface)]">
          <table className="w-full min-w-[980px] border-collapse text-[13.5px]">
            <thead className="border-b border-[var(--c-border)] bg-[var(--c-surface-2)]">
              <tr>
                <th scope="col" className="w-10 px-3 py-2.5"><input type="checkbox" aria-label="Select all on this page" checked={allOnPage} onChange={() => setSelected((current) => { const next = new Set(current); if (allOnPage) rows.forEach((lead) => next.delete(lead.id)); else rows.forEach((lead) => next.add(lead.id)); return next; })} className="h-4 w-4 accent-[var(--indigo-600)]" /></th>
                {header("name", "Name / phone")}
                {header("address", "Address")}
                {header("stage", "Stage")}
                {header("deal_value", "Deal value", "text-right")}
                {header("last_contact", "Last contact")}
                {header("next_follow_up", "Next follow-up")}
                {header("source", "Source")}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--c-border)]">
              {rows.length === 0 && (
                <tr><td colSpan={8} className="px-4 py-14 text-center text-[13.5px] text-[var(--c-muted)]">{leads.length === 0 ? <>No contacts yet. <Link href="/import" className="font-medium text-[var(--c-accent-strong)] hover:underline">Import your first list →</Link></> : "No contacts match your filters."}</td></tr>
              )}
              {rows.map((lead) => {
                const stage = stageOf(lead);
                return (
                  <tr key={lead.id} onClick={() => setOpenId(lead.id)} className={`cursor-pointer hover:bg-[var(--c-surface-2)] ${selected.has(lead.id) ? "bg-[var(--c-accent-soft)]" : ""}`}>
                    <td className="px-3 py-3" onClick={(event) => event.stopPropagation()}><input type="checkbox" aria-label={`Select ${leadFullName(lead)}`} checked={selected.has(lead.id)} onChange={() => toggleRow(lead.id)} className="h-4 w-4 accent-[var(--indigo-600)]" /></td>
                    <td className="px-3 py-3"><p className="font-medium text-[var(--c-text)]">{leadFullName(lead)}</p><p className="num text-[12px] text-[var(--c-muted)]">{formatPhone(lead.phone)}</p></td>
                    <td className="max-w-[240px] truncate px-3 py-3 text-[var(--c-text-2)]">{lead.property_address}{lead.city ? <span className="text-[var(--c-muted)]">, {lead.city}</span> : null}</td>
                    <td className="px-3 py-3"><span className={`rounded-full px-2 py-0.5 text-[11.5px] font-semibold ${stageBadge[stage] ?? stageBadge.New}`}>{stage}</span></td>
                    <td className="num px-3 py-3 text-right text-[var(--c-text-2)]">{lead.deal_value ? formatMoney(lead.deal_value) : <span className="text-[var(--c-muted)]">—</span>}</td>
                    <td className="num px-3 py-3 text-[var(--c-text-2)]">{timeAgo(lead.last_contacted_at)}</td>
                    <td className={`num px-3 py-3 ${isPast(lead.next_follow_up_at) ? "text-[var(--c-rose-text)]" : "text-[var(--c-text-2)]"}`}>{lead.next_follow_up_at ? formatDate(lead.next_follow_up_at) : <span className="text-[var(--c-muted)]">—</span>}</td>
                    <td className="px-3 py-3">{sourceOf(lead) ? <span className="rounded-md bg-[var(--c-surface-2)] px-2 py-0.5 text-[12px] text-[var(--c-text-2)] ring-1 ring-[var(--c-border)]">{sourceOf(lead)}</span> : <span className="text-[var(--c-muted)]">—</span>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {pageCount > 1 && (
          <div className="mt-3 flex items-center justify-between text-[13px] text-[var(--c-muted)]">
            <span>Page <span className="num">{safePage + 1}</span> of <span className="num">{pageCount}</span></span>
            <div className="flex gap-2">
              <button type="button" onClick={() => setPage(Math.max(0, safePage - 1))} disabled={safePage === 0} aria-label="Previous page" className="rounded-lg border border-[var(--c-border)] p-1.5 disabled:opacity-40"><ChevronLeft size={16} /></button>
              <button type="button" onClick={() => setPage(Math.min(pageCount - 1, safePage + 1))} disabled={safePage >= pageCount - 1} aria-label="Next page" className="rounded-lg border border-[var(--c-border)] p-1.5 disabled:opacity-40"><ChevronRight size={16} /></button>
            </div>
          </div>
        )}
      </main>

      {open && (
        <SlideOver
          key={open.id}
          lead={open}
          onClose={() => setOpenId(null)}
          onSaved={(saved) => { setLeads((current) => current.map((lead) => (lead.id === saved.id ? saved : lead))); setNotice({ tone: "ok", text: `Saved ${leadFullName(saved)}.` }); setOpenId(null); }}
        />
      )}
      {textOpen && (
        <BulkText
          leads={leads.filter((lead) => selected.has(lead.id))}
          onClose={() => setTextOpen(false)}
          onDone={(text) => { setNotice({ tone: "ok", text }); setTextOpen(false); setSelected(new Set()); }}
        />
      )}
    </div>
  );
}

// ── Slide-over: full lead detail + edit form ──────────────────────────────────────────────────

function SlideOver({ lead, onClose, onSaved }: { lead: Lead; onClose: () => void; onSaved: (lead: Lead) => void }) {
  const [form, setForm] = useState({
    first_name: lead.first_name, last_name: lead.last_name, phone: formatPhone(lead.phone), email: lead.email ?? "",
    property_address: lead.property_address, city: lead.city ?? "", state: lead.state ?? "", zip: lead.zip ?? "",
    stage: stageOf(lead) === "DNC" ? "" : stageOf(lead), deal_value: lead.deal_value ? String(lead.deal_value) : "",
    next_follow_up: dateInput(lead.next_follow_up_at), deadline: lead.deadline ?? "", tag: lead.tag ?? "", lead_source: lead.lead_source ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const set = (key: keyof typeof form) => (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm((current) => ({ ...current, [key]: event.target.value }));

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    const value = form.deal_value.replace(/[^0-9.]/g, "");
    if (value && Number.isNaN(Number(value))) return setError("Enter a valid deal value.");
    const body: Record<string, unknown> = {
      first_name: form.first_name, last_name: form.last_name, phone: form.phone, email: form.email || null,
      property_address: form.property_address, city: form.city || null, state: form.state || null, zip: form.zip || null,
      deal_value: value ? Number(value) : null,
      next_follow_up_at: form.next_follow_up ? new Date(`${form.next_follow_up}T09:00:00`).toISOString() : null,
      deadline: form.deadline || null, tag: form.tag || null, lead_source: form.lead_source || null,
    };
    // Only write the stage when it actually changed (it also rewrites status/classification).
    if (form.stage && form.stage !== stageOf(lead)) body.stage = form.stage;
    setSaving(true);
    try {
      const response = await fetch(`/api/leads/${lead.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const data = await response.json().catch(() => null);
      if (!response.ok) return setError(data?.error ?? "Couldn't save the contact.");
      onSaved(data.lead as Lead);
    } catch {
      setError("Couldn't reach the server. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  const input = "mt-1 w-full rounded-lg border border-[var(--c-border)] bg-[var(--c-surface)] px-3 py-2 text-[13.5px] text-[var(--c-text)] outline-none focus:border-[var(--c-accent)]";
  const label = "block text-[12px] font-medium text-[var(--c-muted)]";

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/30" onClick={onClose}>
      <aside role="dialog" aria-modal="true" aria-label={`Edit ${leadFullName(lead)}`} onClick={(event) => event.stopPropagation()} className="flex h-full w-full max-w-md flex-col bg-[var(--c-surface)] shadow-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-[var(--c-border)] px-5 py-4">
          <div className="min-w-0">
            <h2 className="truncate text-[16px] font-semibold text-[var(--c-text)]">{leadFullName(lead)}</h2>
            <p className="num text-[12.5px] text-[var(--c-muted)]">{formatPhone(lead.phone)} · added {formatDate(lead.created_at)}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-lg p-1.5 text-[var(--c-muted)] hover:bg-[var(--c-surface-2)]"><X size={18} /></button>
        </div>
        <form onSubmit={save} className="flex min-h-0 flex-1 flex-col">
          <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
            <div className="flex gap-2">
              <Link href={`/messenger?lead=${lead.id}`} className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--c-border)] px-3 py-1.5 text-[13px] font-medium text-[var(--c-text-2)] hover:bg-[var(--c-surface-2)]"><MessageSquare size={14} aria-hidden />Open conversation</Link>
              <Link href={`/leads/${lead.id}`} className="rounded-lg border border-[var(--c-border)] px-3 py-1.5 text-[13px] font-medium text-[var(--c-text-2)] hover:bg-[var(--c-surface-2)]">Full lead page</Link>
            </div>
            {(lead.is_dnc || lead.status === "DNC") && <p className="rounded-lg bg-[var(--c-rose-soft)] px-3 py-2 text-[12.5px] text-[var(--c-rose-text)]">Opted out{lead.dnc_reason ? ` — ${lead.dnc_reason}` : ""}. This contact can’t be texted.</p>}
            <div className="grid grid-cols-2 gap-3">
              <label className={label}>First name<input required value={form.first_name} onChange={set("first_name")} className={input} /></label>
              <label className={label}>Last name<input value={form.last_name} onChange={set("last_name")} className={input} /></label>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className={label}>Phone<input required value={form.phone} onChange={set("phone")} className={`${input} num`} /></label>
              <label className={label}>Email<input type="email" value={form.email} onChange={set("email")} className={input} /></label>
            </div>
            <label className={label}>Property address<input required value={form.property_address} onChange={set("property_address")} className={input} /></label>
            <div className="grid grid-cols-3 gap-3">
              <label className={`${label} col-span-1`}>City<input value={form.city} onChange={set("city")} className={input} /></label>
              <label className={label}>State<input value={form.state} onChange={set("state")} className={input} /></label>
              <label className={label}>ZIP<input value={form.zip} onChange={set("zip")} className={`${input} num`} /></label>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className={label}>Stage
                <select value={form.stage} onChange={set("stage")} className={input}>
                  {!form.stage && <option value="">Opted out</option>}
                  {EDITABLE_STAGES.map((stage) => <option key={stage} value={stage}>{stage}</option>)}
                </select>
              </label>
              <label className={label}>Deal value ($)<input inputMode="numeric" value={form.deal_value} onChange={set("deal_value")} placeholder="25000" className={`${input} num`} /></label>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className={label}>Next follow-up<input type="date" value={form.next_follow_up} onChange={set("next_follow_up")} className={`${input} num`} /></label>
              <label className={label}>Deadline<input type="date" value={form.deadline} onChange={set("deadline")} className={`${input} num`} /></label>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className={label}>Source<input value={form.lead_source} onChange={set("lead_source")} className={input} /></label>
              <label className={label}>Tag<input value={form.tag} onChange={set("tag")} className={input} /></label>
            </div>
            {lead.notes_summary && <div><p className={label}>Notes</p><p className="mt-1 whitespace-pre-wrap rounded-lg bg-[var(--c-surface-2)] px-3 py-2 text-[13px] text-[var(--c-text-2)]">{lead.notes_summary}</p></div>}
            <dl className="grid grid-cols-2 gap-3 text-[12.5px]">
              <div><dt className="text-[var(--c-muted)]">Last contact</dt><dd className="num text-[var(--c-text-2)]">{timeAgo(lead.last_contacted_at)}</dd></div>
              <div><dt className="text-[var(--c-muted)]">Last reply</dt><dd className="num text-[var(--c-text-2)]">{timeAgo(lead.last_replied_at)}</dd></div>
            </dl>
            {error && <p role="alert" className="rounded-lg border border-[var(--c-rose)]/30 bg-[var(--c-rose-soft)] px-3 py-2 text-[13px] text-[var(--c-rose-text)]">{error}</p>}
          </div>
          <div className="flex justify-end gap-2 border-t border-[var(--c-border)] px-5 py-3">
            <button type="button" onClick={onClose} className="rounded-lg border border-[var(--c-border)] px-4 py-2 text-[13.5px] font-medium text-[var(--c-text-2)]">Cancel</button>
            <button type="submit" disabled={saving} className="rounded-lg bg-[var(--c-accent)] px-4 py-2 text-[13.5px] font-semibold text-white disabled:opacity-60">{saving ? "Saving…" : "Save changes"}</button>
          </div>
        </form>
      </aside>
    </div>
  );
}

// ── Bulk text (uses the existing bulk SMS endpoint, which skips opted-out leads) ───────────────

function BulkText({ leads, onClose, onDone }: { leads: Lead[]; onClose: () => void; onDone: (message: string) => void }) {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const optedOut = leads.filter((lead) => lead.is_dnc || lead.status === "DNC").length;

  async function send() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/send-bulk-sms", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ leadIds: leads.map((lead) => lead.id), message }) });
      const data = await response.json().catch(() => null);
      if (!response.ok) return setError(data?.error ?? "Couldn't send those texts.");
      onDone(`Sent ${data.sent} ${data.sent === 1 ? "text" : "texts"}${data.failed ? `, ${data.failed} failed` : ""}${data.skipped ? `, ${data.skipped} skipped (opted out)` : ""}.`);
    } catch {
      setError("Couldn't reach the server. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/30 p-4">
      <section role="dialog" aria-modal="true" aria-label="Text selected contacts" className="w-full max-w-lg rounded-2xl border border-[var(--c-border)] bg-[var(--c-surface)] shadow-2xl">
        <div className="flex items-center justify-between border-b border-[var(--c-border)] px-5 py-4">
          <h2 className="text-[15px] font-semibold text-[var(--c-text)]">Text {leads.length} {leads.length === 1 ? "contact" : "contacts"}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-lg p-1.5 text-[var(--c-muted)] hover:bg-[var(--c-surface-2)]"><X size={18} /></button>
        </div>
        <div className="space-y-3 px-5 py-4">
          <textarea autoFocus rows={4} maxLength={1600} value={message} onChange={(event) => setMessage(event.target.value)} aria-label="Message" placeholder="Type your message…" className="w-full resize-y rounded-lg border border-[var(--c-border)] bg-[var(--c-surface)] px-3 py-2 text-[14px] text-[var(--c-text)] outline-none focus:border-[var(--c-accent)]" />
          <p className="text-[12.5px] text-[var(--c-muted)]">“Reply STOP to opt out.” is added automatically.{optedOut > 0 ? ` ${optedOut} opted-out ${optedOut === 1 ? "contact" : "contacts"} will be skipped.` : ""}</p>
          {error && <p role="alert" className="text-[13px] text-[var(--c-rose-text)]">{error}</p>}
        </div>
        <div className="flex justify-end gap-2 border-t border-[var(--c-border)] px-5 py-3">
          <button type="button" onClick={onClose} className="rounded-lg border border-[var(--c-border)] px-4 py-2 text-[13.5px] font-medium text-[var(--c-text-2)]">Cancel</button>
          <button type="button" onClick={() => void send()} disabled={busy || !message.trim()} className="rounded-lg bg-[var(--c-accent)] px-4 py-2 text-[13.5px] font-semibold text-white disabled:opacity-50">{busy ? "Sending…" : "Send"}</button>
        </div>
      </section>
    </div>
  );
}
