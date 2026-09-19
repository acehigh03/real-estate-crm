"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, Loader2, Search, X } from "lucide-react";

import { formatDelay } from "@/lib/drips";

export interface EnrollWorkflow { id: string; name: string; status: string }
interface LeadHit { id: string; first_name: string | null; last_name: string | null; phone: string | null; property_address: string | null; city: string | null; is_dnc: boolean; status: string }
interface PreviewRow { lead_id: string; name: string; phone: string | null; blocked: "opted_out" | "no_phone" | null; steps: Array<{ step_number: number; delay_minutes: number; message: string }> }

const nameOf = (lead: Pick<LeadHit, "first_name" | "last_name" | "phone">) => `${lead.first_name ?? ""} ${lead.last_name ?? ""}`.trim() || lead.phone || "Unknown lead";
const blockedLabel = { opted_out: "Opted out — can't be texted", no_phone: "No phone number" } as const;

/**
 * Enroll one or more leads in a drip: pick leads → preview every message with their real data → confirm.
 * Nothing is sent by enrolling; messages go out on schedule during your send window.
 */
export function EnrollDialog({ workflows, workflowId: initialWorkflowId, lockedLead, onClose, onEnrolled }: {
  workflows: EnrollWorkflow[];
  workflowId?: string;
  /** When set, the lead is fixed (used from the lead page) and the search step is skipped. */
  lockedLead?: { id: string; name: string };
  onClose: () => void;
  onEnrolled: (result: { enrolled: number; skipped: number }) => void;
}) {
  const enrollable = workflows.filter((workflow) => workflow.status === "active");
  const [workflowId, setWorkflowId] = useState(initialWorkflowId && enrollable.some((w) => w.id === initialWorkflowId) ? initialWorkflowId : (enrollable[0]?.id ?? ""));
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<LeadHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<Map<string, string>>(new Map(lockedLead ? [[lockedLead.id, lockedLead.name]] : []));
  const [previews, setPreviews] = useState<PreviewRow[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState<{ enrolled: number; skipped: number } | null>(null);
  const searchSeq = useRef(0);

  useEffect(() => {
    if (lockedLead || previews) return;
    const term = query.trim();
    if (term.length < 2) { setHits([]); setSearching(false); return; }
    const seq = ++searchSeq.current;
    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(`/api/leads/search?q=${encodeURIComponent(term)}`);
        const data = await response.json();
        if (seq === searchSeq.current) setHits(response.ok ? data.leads ?? [] : []);
      } catch {
        if (seq === searchSeq.current) setHits([]);
      } finally {
        if (seq === searchSeq.current) setSearching(false);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [query, lockedLead, previews]);

  const sendable = useMemo(() => (previews ?? []).filter((row) => !row.blocked), [previews]);

  async function loadPreview() {
    setError("");
    if (!workflowId) return setError("Activate a workflow first — only active workflows can enroll leads.");
    if (!selected.size) return setError("Choose at least one lead.");
    setBusy(true);
    try {
      const response = await fetch(`/api/drips/${workflowId}/enroll`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ lead_ids: [...selected.keys()], preview: true }) });
      const data = await response.json();
      if (!response.ok) return setError(data.error ?? "Couldn't build the preview.");
      setPreviews(data.previews ?? []);
    } catch {
      setError("Couldn't reach the server. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function confirm() {
    if (!sendable.length) return;
    setError("");
    setBusy(true);
    try {
      const response = await fetch(`/api/drips/${workflowId}/enroll`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ lead_ids: sendable.map((row) => row.lead_id) }) });
      const data = await response.json();
      if (!response.ok) return setError(data.error ?? "Couldn't enroll the selected leads.");
      const result = { enrolled: data.enrolled as number, skipped: data.skipped as number };
      setDone(result);
      onEnrolled(result);
    } catch {
      setError("Couldn't reach the server. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  const workflowName = workflows.find((workflow) => workflow.id === workflowId)?.name ?? "workflow";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/30 p-4">
      <section role="dialog" aria-modal="true" aria-label="Enroll leads" className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-[var(--b1)] bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-[var(--b1)] px-5 py-4">
          <div>
            <h2 className="font-semibold text-[var(--t1)]">{lockedLead ? `Enroll ${lockedLead.name} in a drip` : "Enroll leads in a drip"}</h2>
            <p className="mt-0.5 text-sm text-[var(--t2)]">{previews ? "Review exactly what each seller will receive." : "Nothing is sent until you confirm the preview."}</p>
          </div>
          <button onClick={onClose} aria-label="Close" className="rounded-lg p-2 text-[var(--t2)] hover:bg-[var(--s2)]"><X size={18} /></button>
        </div>

        <div className="flex-1 space-y-4 overflow-auto p-5">
          {done ? (
            <div className="flex flex-col items-center py-8 text-center">
              <span className="rounded-full bg-emerald-50 p-3 text-emerald-700"><CheckCircle2 size={28} /></span>
              <h3 className="mt-4 text-base font-semibold text-[var(--t1)]">{done.enrolled} lead{done.enrolled === 1 ? "" : "s"} enrolled in {workflowName}</h3>
              <p className="mt-2 max-w-sm text-sm text-[var(--t2)]">The first message goes out at the next scheduled run, inside your send window. Opt-outs and replies stop the sequence automatically.{done.skipped ? ` ${done.skipped} skipped (opted out or already enrolled).` : ""}</p>
              <button onClick={onClose} className="crm-button-primary mt-5">Done</button>
            </div>
          ) : !previews ? (
            <>
              <label className="block text-sm font-medium text-[var(--t1)]">Workflow
                <select value={workflowId} onChange={(event) => setWorkflowId(event.target.value)} className="mt-1.5 w-full rounded-lg border border-[var(--b2)] bg-white px-3 py-2.5 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100">
                  {workflows.map((workflow) => <option key={workflow.id} value={workflow.id} disabled={workflow.status !== "active"}>{workflow.name}{workflow.status === "enrolled" ? " (already enrolled)" : workflow.status !== "active" ? ` (${workflow.status} — activate to enroll)` : ""}</option>)}
                </select>
              </label>
              {!enrollable.length && <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">No workflow is active yet. Activate one from the Workflows tab, then come back to enroll leads.</p>}

              {!lockedLead && (
                <div>
                  <label htmlFor="enroll-search" className="text-sm font-medium text-[var(--t1)]">Find leads</label>
                  <div className="relative mt-1.5">
                    <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--t3)]" />
                    <input id="enroll-search" autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by name, phone or address" className="w-full rounded-lg border border-[var(--b2)] py-2.5 pl-9 pr-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100" />
                    {searching && <Loader2 size={15} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-[var(--t3)]" />}
                  </div>
                  {query.trim().length >= 2 && !searching && !hits.length && <p className="mt-2 text-sm text-[var(--t2)]">No leads match “{query.trim()}”.</p>}
                  {hits.length > 0 && (
                    <ul className="mt-2 divide-y divide-[var(--b1)] overflow-hidden rounded-xl border border-[var(--b1)]">
                      {hits.map((lead) => {
                        const picked = selected.has(lead.id);
                        const blocked = lead.is_dnc || lead.status === "DNC";
                        return (
                          <li key={lead.id}>
                            <button type="button" disabled={blocked} onClick={() => setSelected((current) => { const next = new Map(current); if (picked) next.delete(lead.id); else next.set(lead.id, nameOf(lead)); return next; })} className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left hover:bg-[var(--s2)] disabled:cursor-not-allowed disabled:opacity-50">
                              <span className="min-w-0"><span className="block truncate text-sm font-medium text-[var(--t1)]">{nameOf(lead)}</span><span className="block truncate text-xs text-[var(--t2)]">{[lead.phone, lead.property_address].filter(Boolean).join(" · ")}</span></span>
                              <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${blocked ? "border-red-100 bg-red-50 text-red-700" : picked ? "border-emerald-100 bg-emerald-50 text-emerald-700" : "border-[var(--b1)] text-[var(--t2)]"}`}>{blocked ? "Opted out" : picked ? "Selected" : "Add"}</span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              )}

              {selected.size > 0 && !lockedLead && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-[var(--t2)]">{selected.size} selected</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {[...selected].map(([id, label]) => (
                      <span key={id} className="inline-flex items-center gap-1 rounded-full border border-emerald-100 bg-emerald-50 py-1 pl-3 pr-1.5 text-xs font-medium text-emerald-800">{label}<button aria-label={`Remove ${label}`} onClick={() => setSelected((current) => { const next = new Map(current); next.delete(id); return next; })} className="rounded-full p-0.5 hover:bg-emerald-100"><X size={12} /></button></span>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <>
              <p className="text-sm text-[var(--t2)]"><span className="font-semibold text-[var(--t1)]">{workflowName}</span> · {sendable.length} of {previews.length} lead{previews.length === 1 ? "" : "s"} will be enrolled. Step 1 automatically ends with “Reply STOP to opt out.”</p>
              <div className="space-y-3">
                {previews.map((row, index) => (
                  <details key={row.lead_id} open={index === 0} className="rounded-xl border border-[var(--b1)]">
                    <summary className="flex cursor-pointer items-center justify-between gap-3 px-4 py-3 text-sm font-semibold text-[var(--t1)]">
                      <span className="truncate">{row.name}{row.phone && <span className="ml-2 font-normal text-[var(--t2)]">{row.phone}</span>}</span>
                      {row.blocked && <span className="shrink-0 rounded-full border border-red-100 bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-700">{blockedLabel[row.blocked]}</span>}
                    </summary>
                    <ol className="space-y-3 border-t border-[var(--b1)] px-4 py-3">
                      {row.steps.map((step) => (
                        <li key={step.step_number}>
                          <p className="text-xs font-semibold text-[var(--t2)]">Step {step.step_number} · {step.step_number === 1 ? "on the next run" : `after ${formatDelay(step.delay_minutes)}`}</p>
                          <p className="mt-1 whitespace-pre-wrap rounded-lg bg-[var(--s2)] px-3 py-2 text-sm text-[var(--t1)]">{step.message}</p>
                        </li>
                      ))}
                    </ol>
                  </details>
                ))}
              </div>
            </>
          )}
          {error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
        </div>

        {!done && (
          <div className="flex items-center justify-between gap-3 border-t border-[var(--b1)] px-5 py-4">
            {previews ? <button onClick={() => { setPreviews(null); setError(""); }} className="crm-button-secondary">Back</button> : <button onClick={onClose} className="crm-button-secondary">Cancel</button>}
            {previews
              ? <button disabled={busy || !sendable.length} onClick={confirm} className="crm-button-primary disabled:opacity-50">{busy ? "Enrolling…" : `Enroll ${sendable.length} lead${sendable.length === 1 ? "" : "s"}`}</button>
              : <button disabled={busy || !selected.size || !workflowId} onClick={loadPreview} className="crm-button-primary disabled:opacity-50">{busy ? "Building preview…" : "Preview messages"}</button>}
          </div>
        )}
      </section>
    </div>
  );
}
