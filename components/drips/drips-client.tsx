"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Play, Pause, Copy, X, MessageSquareText, Clock3, Users, Sparkles, UserPlus, Loader2 } from "lucide-react";

import { streamDripMessage } from "@/components/automation/ai-client";
import { EnrollDialog } from "@/components/automation/enroll-dialog";
import { formatDelay } from "@/lib/drips";
import type { Database, DripWorkflowStatus } from "@/types/database";

type Workflow = Database["public"]["Tables"]["drip_workflows"]["Row"];
type Step = Database["public"]["Tables"]["drip_steps"]["Row"];
type DraftStep = { delay_minutes: number; message: string };
interface Run {
  enrollment_id: string; lead_id: string; lead_name: string; phone: string | null; status: string; cancel_reason: string | null;
  enrolled_at: string; steps_total: number; steps_sent: number; next_step_number: number | null; next_due: string | null;
  workflow_id: string;
}

const statusStyle: Record<DripWorkflowStatus, string> = {
  active: "bg-emerald-50 text-emerald-700 border-emerald-100",
  draft: "bg-slate-100 text-slate-600 border-slate-200",
  paused: "bg-amber-50 text-amber-700 border-amber-100",
  archived: "bg-slate-50 text-slate-500 border-slate-200",
};
const runStyle: Record<string, string> = {
  active: "bg-emerald-50 text-emerald-700 border-emerald-100",
  completed: "bg-slate-100 text-slate-600 border-slate-200",
  cancelled: "bg-red-50 text-red-700 border-red-100",
  paused: "bg-amber-50 text-amber-700 border-amber-100",
};
const cancelReasonLabel: Record<string, string> = { STOP: "Seller said STOP", replied: "Seller replied", DNC: "Opted out", manual: "Cancelled by you" };

const DEFAULT_FIRST_STEP = "Hi [[first_name]], this is Senay. Would you consider an offer for [[address]]?";
const DEFAULT_NEXT_STEP = "Hi [[first_name]], just following up about [[address]]. Would it make sense to talk?";
const HELPERS = ["[[first_name]]", "[[address]]"] as const;

function formatDue(iso: string | null) {
  if (!iso) return "—";
  const date = new Date(iso);
  const diff = date.getTime() - Date.now();
  if (diff <= 0) return "Due now";
  return date.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export function DripsClient({ workflows: initialWorkflows, steps, enrollments, queued }: {
  workflows: Workflow[]; steps: Step[]; enrollments: Array<{ workflow_id: string; status: string }>; queued: number;
}) {
  const [workflows, setWorkflows] = useState(initialWorkflows);
  const [tab, setTab] = useState<"workflows" | "runs">("workflows");
  const [open, setOpen] = useState(false);
  const [enrollFor, setEnrollFor] = useState<string | null | undefined>(undefined); // undefined = closed, null = no preselected workflow
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [modalError, setModalError] = useState("");
  const [name, setName] = useState("");
  const [continueAfterReply, setContinueAfterReply] = useState(false);
  const [draftSteps, setDraftSteps] = useState<DraftStep[]>([{ delay_minutes: 0, message: DEFAULT_FIRST_STEP }]);
  const [runs, setRuns] = useState<Run[]>([]);
  const [runsLoading, setRunsLoading] = useState(false);
  const [runsError, setRunsError] = useState("");
  const [runFilter, setRunFilter] = useState("all");
  const router = useRouter();
  // Counts come from the server; router.refresh() after enrolling/cancelling brings fresh props.
  const stats = { enrollments, queued };

  const byWorkflow = useMemo(() => {
    const map = new Map<string, Step[]>();
    steps.forEach((step) => map.set(step.workflow_id, [...(map.get(step.workflow_id) ?? []), step]));
    return map;
  }, [steps]);

  const activeEnrollments = (id: string) => stats.enrollments.filter((item) => item.workflow_id === id && item.status === "active").length;

  const loadRuns = useCallback(async () => {
    setRunsLoading(true);
    setRunsError("");
    try {
      const results = await Promise.all(workflows.map(async (workflow) => {
        const response = await fetch(`/api/drips/${workflow.id}/runs`);
        if (!response.ok) throw new Error("runs");
        const data = await response.json();
        return (data.runs as Omit<Run, "workflow_id">[]).map((run) => ({ ...run, workflow_id: workflow.id }));
      }));
      setRuns(results.flat());
    } catch {
      setRunsError("Couldn't load active runs. Please try again.");
    } finally {
      setRunsLoading(false);
    }
  }, [workflows]);

  useEffect(() => { if (tab === "runs") void loadRuns(); }, [tab, loadRuns]);

  function openNewModal() {
    setName(""); setContinueAfterReply(false); setModalError("");
    setDraftSteps([{ delay_minutes: 0, message: DEFAULT_FIRST_STEP }]);
    setOpen(true);
  }

  function duplicate(workflow: Workflow) {
    const source = byWorkflow.get(workflow.id) ?? [];
    setName(`${workflow.name} (copy)`);
    setContinueAfterReply(workflow.continue_after_reply);
    setModalError("");
    setDraftSteps(source.length ? source.map((step) => ({ delay_minutes: step.delay_minutes, message: step.message })) : [{ delay_minutes: 0, message: DEFAULT_FIRST_STEP }]);
    setOpen(true);
  }

  async function createWorkflow() {
    setModalError("");
    if (!name.trim() || draftSteps.some((step) => !step.message.trim())) {
      setModalError("Give the workflow a name and complete every message step.");
      return;
    }
    setSaving(true);
    try {
      const response = await fetch("/api/drips", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name, continue_after_reply: continueAfterReply, steps: draftSteps }) });
      const data = await response.json();
      if (!response.ok) return setModalError(data.error ?? "Could not create workflow.");
      // Reload so the new workflow's steps appear on the card.
      window.location.reload();
    } catch {
      setModalError("Couldn't reach the server. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function setStatus(workflow: Workflow, status: DripWorkflowStatus) {
    setError("");
    const response = await fetch(`/api/drips/${workflow.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ status }) });
    if (!response.ok) return setError("Could not update the workflow. Please try again.");
    setWorkflows((items) => items.map((item) => item.id === workflow.id ? { ...item, status } : item));
  }

  async function cancelRun(run: Run) {
    if (!window.confirm(`Stop this drip for ${run.lead_name}? Their remaining messages won't be sent.`)) return;
    setRunsError("");
    const response = await fetch(`/api/drips/enrollments/${run.enrollment_id}/cancel`, { method: "POST" });
    if (!response.ok) {
      const data = await response.json().catch(() => null);
      return setRunsError(data?.error ?? "Couldn't cancel that run.");
    }
    await loadRuns();
    router.refresh();
  }

  const visibleRuns = runs.filter((run) => runFilter === "all" || run.workflow_id === runFilter);
  const workflowName = (id: string) => workflows.find((workflow) => workflow.id === id)?.name ?? "Workflow";
  const activeRunCount = stats.enrollments.filter((item) => item.status === "active").length;

  return <div className="crm-page flex flex-1 flex-col overflow-hidden">
    <header className="crm-page-header flex shrink-0 flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-6">
      <div><h1 className="crm-header-title">Text Drips</h1><p className="crm-header-copy">Build follow-up sequences that stay personal and stop when a seller replies or opts out.</p></div>
      <div className="flex flex-wrap items-center gap-2">
        <button onClick={() => setEnrollFor(null)} className="crm-button-secondary inline-flex items-center gap-2"><UserPlus size={16}/>Enroll leads</button>
        <button onClick={openNewModal} className="crm-button-primary inline-flex items-center gap-2"><Plus size={16}/>New workflow</button>
      </div>
    </header>
    <main className="flex-1 overflow-auto bg-[var(--bg)] px-4 py-5 sm:px-6">
      <div className="mx-auto max-w-[1320px]">
        <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Metric icon={<Play size={17}/>} label="Active workflows" value={workflows.filter(w => w.status === "active").length} />
          <Metric icon={<Users size={17}/>} label="Active enrollments" value={activeRunCount} />
          <Metric icon={<MessageSquareText size={17}/>} label="Messages queued" value={stats.queued} sub="Sent on schedule, inside your send window" />
        </div>

        <div role="tablist" aria-label="Drip views" className="mb-4 inline-flex rounded-lg border border-[var(--b1)] bg-white p-1">
          {([["workflows", "Workflows"], ["runs", "Active runs"]] as const).map(([key, label]) => (
            <button key={key} role="tab" aria-selected={tab === key} onClick={() => setTab(key)} className={`rounded-md px-3.5 py-1.5 text-sm font-medium ${tab === key ? "bg-emerald-50 text-emerald-800" : "text-[var(--t2)] hover:text-[var(--t1)]"}`}>{label}</button>
          ))}
        </div>

        {error && <div role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

        {tab === "workflows" ? (
          workflows.length === 0 ? <Empty onCreate={openNewModal} /> : <div className="grid gap-4 lg:grid-cols-2">
            {workflows.map(workflow => {
              const workflowSteps = byWorkflow.get(workflow.id) ?? [];
              const shown = workflowSteps.slice(0, 3);
              return <article key={workflow.id} className="dash-card p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2"><h2 className="truncate text-base font-semibold text-[var(--t1)]">{workflow.name}</h2><span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold capitalize ${statusStyle[workflow.status]}`}>{workflow.status}</span></div>
                    <p className="mt-1 text-sm text-[var(--t2)]">{workflowSteps.length} step{workflowSteps.length === 1 ? "" : "s"} · {activeEnrollments(workflow.id)} active lead{activeEnrollments(workflow.id) === 1 ? "" : "s"}</p>
                  </div>
                  <button onClick={() => duplicate(workflow)} aria-label={`Duplicate ${workflow.name}`} title="Duplicate and edit as a new workflow" className="rounded-lg border border-[var(--b1)] p-2 text-[var(--t2)] hover:bg-[var(--s2)]"><Copy size={15}/></button>
                </div>
                <ol className="mt-5 space-y-3 border-l border-[var(--b1)] pl-4">
                  {shown.map(step => <li key={step.id} className="relative"><span className="absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-emerald-500"/><p className="text-xs font-semibold text-[var(--t2)]">{step.step_number === 1 ? "Immediately" : `Wait ${formatDelay(step.delay_minutes)}`}</p><p className="mt-1 line-clamp-2 text-sm text-[var(--t1)]">{step.message}</p></li>)}
                  {workflowSteps.length > shown.length && <li className="text-xs font-medium text-[var(--t2)]">+ {workflowSteps.length - shown.length} more step{workflowSteps.length - shown.length === 1 ? "" : "s"}</li>}
                </ol>
                <div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-[var(--b1)] pt-4">
                  <span className="text-xs text-[var(--t2)]">{workflow.continue_after_reply ? "Continues after a reply" : "Stops after a reply"}</span>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setEnrollFor(workflow.id)} disabled={workflow.status !== "active"} title={workflow.status !== "active" ? "Activate this workflow to enroll leads" : undefined} className="crm-button-secondary inline-flex items-center gap-1.5 disabled:opacity-50"><UserPlus size={14}/>Enroll lead</button>
                    {workflow.status === "active" ? <button onClick={() => setStatus(workflow, "paused")} className="crm-button-secondary inline-flex items-center gap-1.5"><Pause size={14}/>Pause</button> : <button onClick={() => setStatus(workflow, "active")} className="crm-button-soft inline-flex items-center gap-1.5"><Play size={14}/>Activate</button>}
                  </div>
                </div>
              </article>;
            })}
          </div>
        ) : (
          <div className="dash-card overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--b1)] px-4 py-3">
              <label className="flex items-center gap-2 text-sm text-[var(--t2)]">Workflow
                <select value={runFilter} onChange={(event) => setRunFilter(event.target.value)} className="rounded-lg border border-[var(--b2)] bg-white px-2.5 py-1.5 text-sm text-[var(--t1)]">
                  <option value="all">All workflows</option>
                  {workflows.map((workflow) => <option key={workflow.id} value={workflow.id}>{workflow.name}</option>)}
                </select>
              </label>
              <button onClick={() => void loadRuns()} className="crm-button-secondary">Refresh</button>
            </div>
            {runsError && <div role="alert" className="border-b border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{runsError}</div>}
            {runsLoading && !runs.length ? (
              <p className="flex items-center gap-2 px-4 py-10 text-sm text-[var(--t2)]"><Loader2 size={15} className="animate-spin"/>Loading runs…</p>
            ) : visibleRuns.length === 0 ? (
              <div className="flex flex-col items-center px-6 py-14 text-center"><span className="rounded-2xl bg-emerald-50 p-3 text-emerald-700"><Users size={22}/></span><h3 className="mt-3 text-base font-semibold text-[var(--t1)]">No leads are in a drip yet</h3><p className="mt-1.5 max-w-sm text-sm text-[var(--t2)]">Enroll leads to a workflow and you’ll see each one’s progress and next message here.</p><button onClick={() => setEnrollFor(null)} className="crm-button-primary mt-4 inline-flex items-center gap-2"><UserPlus size={15}/>Enroll leads</button></div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-left text-sm">
                  <thead className="border-b border-[var(--b1)] text-xs uppercase tracking-wide text-[var(--t2)]"><tr><th className="px-4 py-2.5 font-semibold">Lead</th><th className="px-4 py-2.5 font-semibold">Workflow</th><th className="px-4 py-2.5 font-semibold">Status</th><th className="px-4 py-2.5 font-semibold">Progress</th><th className="px-4 py-2.5 font-semibold">Next message</th><th className="px-4 py-2.5"><span className="sr-only">Actions</span></th></tr></thead>
                  <tbody className="divide-y divide-[var(--b1)]">
                    {visibleRuns.map((run) => (
                      <tr key={run.enrollment_id}>
                        <td className="px-4 py-3"><a href={`/leads/${run.lead_id}`} className="font-medium text-[var(--t1)] hover:text-emerald-700">{run.lead_name}</a>{run.phone && <p className="text-xs text-[var(--t2)]">{run.phone}</p>}</td>
                        <td className="px-4 py-3 text-[var(--t2)]">{workflowName(run.workflow_id)}</td>
                        <td className="px-4 py-3"><span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold capitalize ${runStyle[run.status] ?? runStyle.completed}`}>{run.status}</span>{run.cancel_reason && <p className="mt-1 text-xs text-[var(--t2)]">{cancelReasonLabel[run.cancel_reason] ?? run.cancel_reason}</p>}</td>
                        <td className="px-4 py-3 text-[var(--t2)]">{run.steps_sent} of {run.steps_total} sent</td>
                        <td className="px-4 py-3 text-[var(--t2)]">{run.status === "active" && run.next_step_number ? `Step ${run.next_step_number} · ${formatDue(run.next_due)}` : "—"}</td>
                        <td className="px-4 py-3 text-right">{run.status === "active" && <button onClick={() => void cancelRun(run)} className="text-sm font-medium text-red-600 hover:text-red-700">Cancel</button>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
    {open && <WorkflowModal name={name} setName={setName} steps={draftSteps} setSteps={setDraftSteps} continueAfterReply={continueAfterReply} setContinueAfterReply={setContinueAfterReply} saving={saving} error={modalError} onClose={() => { setOpen(false); setModalError(""); }} onSave={createWorkflow} />}
    {enrollFor !== undefined && <EnrollDialog workflows={workflows} workflowId={enrollFor ?? undefined} onClose={() => setEnrollFor(undefined)} onEnrolled={() => { router.refresh(); if (tab === "runs") void loadRuns(); }} />}
  </div>;
}

function Metric({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string | number; sub?: string }) { return <div className="dash-card flex items-center gap-3 px-4 py-4"><span className="rounded-lg bg-emerald-50 p-2 text-emerald-700">{icon}</span><div><p className="text-xs font-medium text-[var(--t2)]">{label}</p><p className="mt-0.5 text-xl font-semibold text-[var(--t1)]">{value}</p>{sub && <p className="mt-0.5 text-[11px] text-[var(--t3)]">{sub}</p>}</div></div>; }
function Empty({ onCreate }: { onCreate: () => void }) { return <div className="dash-card flex min-h-[320px] flex-col items-center justify-center px-6 text-center"><span className="rounded-2xl bg-emerald-50 p-4 text-emerald-700"><Clock3 size={26}/></span><h2 className="mt-4 text-lg font-semibold text-[var(--t1)]">Your follow-up system starts here</h2><p className="mt-2 max-w-md text-sm text-[var(--t2)]">Create a short, personal sequence for sellers who don’t reply right away. You’ll review leads before anyone is enrolled.</p><button onClick={onCreate} className="crm-button-primary mt-5 inline-flex items-center gap-2"><Plus size={16}/>Create first workflow</button></div>; }

function WorkflowModal(props: {
  name: string; setName: (v: string) => void; steps: DraftStep[]; setSteps: React.Dispatch<React.SetStateAction<DraftStep[]>>;
  continueAfterReply: boolean; setContinueAfterReply: (v: boolean) => void; saving: boolean; error: string; onClose: () => void; onSave: () => void;
}) {
  const { name, setName, steps, setSteps, continueAfterReply, setContinueAfterReply, saving, error, onClose, onSave } = props;
  const [aiIndex, setAiIndex] = useState<number | null>(null);
  const [aiError, setAiError] = useState<{ index: number; message: string } | null>(null);
  const textareas = useRef<Array<HTMLTextAreaElement | null>>([]);
  const abort = useRef<AbortController | null>(null);
  useEffect(() => () => abort.current?.abort(), []);

  const patch = (index: number, change: Partial<DraftStep>) => setSteps((current) => current.map((item, i) => i === index ? { ...item, ...change } : item));

  function insertToken(index: number, token: string) {
    const area = textareas.current[index];
    const current = steps[index].message;
    const start = area?.selectionStart ?? current.length;
    const end = area?.selectionEnd ?? current.length;
    patch(index, { message: `${current.slice(0, start)}${token}${current.slice(end)}`.slice(0, 1600) });
    requestAnimationFrame(() => { area?.focus(); area?.setSelectionRange(start + token.length, start + token.length); });
  }

  async function writeWithAi(index: number) {
    abort.current?.abort();
    const controller = new AbortController();
    abort.current = controller;
    const previous = steps[index].message;
    setAiError(null);
    setAiIndex(index);
    patch(index, { message: "" });
    const result = await streamDripMessage(
      { workflow_name: name.trim() || "Follow-up", step_number: index + 1, delay_minutes: steps[index].delay_minutes, prior_messages: steps.slice(0, index).map((step) => step.message).filter(Boolean).slice(-6) },
      (text) => patch(index, { message: text.slice(0, 1600) }),
      controller.signal
    );
    if (controller.signal.aborted) return;
    setAiIndex(null);
    if (!result.ok) {
      patch(index, { message: previous });
      setAiError({ index, message: result.error });
    }
  }

  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/30 p-4"><section role="dialog" aria-modal="true" aria-label="Text drip" className="max-h-[90vh] w-full max-w-2xl overflow-auto rounded-2xl border border-[var(--b1)] bg-white shadow-2xl">
    <div className="flex items-center justify-between border-b border-[var(--b1)] px-5 py-4"><div><h2 className="font-semibold text-[var(--t1)]">New text drip</h2><p className="mt-0.5 text-sm text-[var(--t2)]">Saved as a draft — nothing sends until you activate it and enroll leads.</p></div><button onClick={onClose} aria-label="Close" className="rounded-lg p-2 text-[var(--t2)] hover:bg-[var(--s2)]"><X size={18}/></button></div>
    <div className="space-y-5 p-5">
      <label className="block text-sm font-medium text-[var(--t1)]">Workflow name<input autoFocus value={name} onChange={e => setName(e.target.value)} placeholder="Cold seller follow-up" className="mt-1.5 w-full rounded-lg border border-[var(--b2)] px-3 py-2.5 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"/></label>
      <div>
        <div className="mb-2 flex items-center justify-between"><p className="text-sm font-medium text-[var(--t1)]">Sequence</p><button onClick={() => setSteps(current => [...current, { delay_minutes: 1440, message: DEFAULT_NEXT_STEP }])} disabled={steps.length >= 12} className="text-sm font-semibold text-emerald-700 hover:text-emerald-800 disabled:opacity-50">+ Add step</button></div>
        <div className="space-y-3">
          {steps.map((step, index) => <div key={index} className="rounded-xl border border-[var(--b1)] bg-[var(--s2)] p-3">
            <div className="flex items-center justify-between gap-3"><p className="text-xs font-semibold text-[var(--t2)]">STEP {index + 1}</p>{index > 0 && <button onClick={() => setSteps(current => current.filter((_, i) => i !== index))} className="text-xs font-medium text-red-600">Remove</button>}</div>
            {index > 0 && <label className="mt-3 block text-xs font-medium text-[var(--t2)]">Wait before sending (minutes)<input type="number" min="0" value={step.delay_minutes} onChange={e => patch(index, { delay_minutes: Math.max(0, Number(e.target.value) || 0) })} className="mt-1 w-32 rounded-lg border border-[var(--b2)] bg-white px-2 py-1.5 text-sm"/><span className="ml-2 text-[var(--t3)]">{formatDelay(step.delay_minutes)}</span></label>}
            <textarea ref={(node) => { textareas.current[index] = node; }} value={step.message} maxLength={1600} onChange={e => patch(index, { message: e.target.value })} readOnly={aiIndex === index} rows={3} aria-label={`Step ${index + 1} message`} className="mt-3 w-full resize-y rounded-lg border border-[var(--b2)] bg-white px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"/>
            <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-1.5">
                {HELPERS.map((token) => <button key={token} type="button" onClick={() => insertToken(index, token)} className="rounded-md border border-[var(--b2)] bg-white px-2 py-0.5 font-mono text-[11px] text-[var(--t2)] hover:border-emerald-300 hover:text-emerald-700">{token}</button>)}
                <button type="button" onClick={() => void writeWithAi(index)} disabled={aiIndex !== null} className="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-800 hover:bg-emerald-100 disabled:opacity-60">{aiIndex === index ? <Loader2 size={11} className="animate-spin"/> : <Sparkles size={11}/>}{aiIndex === index ? "Writing…" : "Write with AI"}</button>
              </div>
              <p className="text-[11px] text-[var(--t3)]">{step.message.length}/1600</p>
            </div>
            {aiError?.index === index && aiError.message && <p role="alert" className="mt-1.5 text-xs text-red-600">{aiError.message}</p>}
            {index === 0 && <p className="mt-1.5 text-[11px] text-[var(--t3)]">“Reply STOP to opt out.” is added to this first message automatically.</p>}
          </div>)}
        </div>
      </div>
      <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-[var(--b1)] p-3"><input type="checkbox" checked={continueAfterReply} onChange={e => setContinueAfterReply(e.target.checked)} className="mt-0.5 h-4 w-4 accent-emerald-600"/><span><span className="block text-sm font-medium text-[var(--t1)]">Continue after a seller replies</span><span className="mt-0.5 block text-xs text-[var(--t2)]">Off is safer for cold outreach — a reply stops the sequence. A STOP always stops it.</span></span></label>
      {error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
    </div>
    <div className="flex justify-end gap-3 border-t border-[var(--b1)] px-5 py-4"><button onClick={onClose} className="crm-button-secondary">Cancel</button><button disabled={saving || aiIndex !== null} onClick={onSave} className="crm-button-primary disabled:opacity-50">{saving ? "Saving…" : "Save draft"}</button></div>
  </section></div>;
}
