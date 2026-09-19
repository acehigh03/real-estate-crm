"use client";

import { useCallback, useEffect, useState } from "react";
import { format, parseISO } from "date-fns";
import { Loader2, UserPlus } from "lucide-react";

import { EnrollDialog, type EnrollWorkflow } from "@/components/automation/enroll-dialog";
import { SentimentBadge } from "@/components/automation/sentiment-badge";

interface Execution { id: string; step_number: number; scheduled_for: string; sent_at: string | null; status: string; error: string | null; message: string }
interface Run { enrollment_id: string; workflow_id: string; workflow_name: string; status: string; cancel_reason: string | null; started_at: string; next_due: string | null; executions: Execution[] }
interface HistoryRow { id: string; automation_type: string | null; automation_name: string | null; action_taken: string | null; result: string | null; created_at: string }
interface Payload {
  lead: { id: string; first_name: string | null; last_name: string | null; phone: string | null; is_dnc: boolean };
  runs: Run[]; history: HistoryRow[]; last_sentiment: string | null; workflows: EnrollWorkflow[];
}

const when = (iso: string | null) => {
  if (!iso) return "—";
  const date = parseISO(iso);
  return Number.isNaN(date.getTime()) ? "—" : format(date, "MMM d, h:mm a");
};
const runBadge: Record<string, string> = {
  active: "bg-emerald-50 text-emerald-700 border-emerald-100",
  completed: "bg-gray-100 text-gray-600 border-gray-200",
  cancelled: "bg-red-50 text-red-700 border-red-100",
  paused: "bg-amber-50 text-amber-700 border-amber-100",
};
const execBadge: Record<string, string> = {
  queued: "text-gray-500", processing: "text-blue-600", sent: "text-emerald-700", delivered: "text-emerald-700", failed: "text-red-600", skipped: "text-amber-700", cancelled: "text-gray-400",
};
const reasonLabel: Record<string, string> = { STOP: "Seller said STOP", replied: "Seller replied", DNC: "Opted out", manual: "Cancelled by you" };

/** The lead page's "Automations" tab: drips this lead is in, their send log, sentiment and automation history. */
export function LeadAutomationsPanel({ leadId, leadName }: { leadId: string; leadName: string }) {
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [enrolling, setEnrolling] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError("");
    try {
      const response = await fetch(`/api/leads/${leadId}/automations`, { cache: "no-store" });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error ?? "Couldn't load automations.");
      setData(json);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Couldn't load automations.");
    } finally {
      setLoading(false);
    }
  }, [leadId]);

  useEffect(() => { void load(); }, [load]);

  async function cancel(run: Run) {
    if (!window.confirm(`Stop “${run.workflow_name}” for ${leadName}? Their remaining messages won't be sent.`)) return;
    setBusy(run.enrollment_id);
    setError("");
    try {
      const response = await fetch(`/api/drips/enrollments/${run.enrollment_id}/cancel`, { method: "POST" });
      if (!response.ok) throw new Error((await response.json().catch(() => null))?.error ?? "Couldn't cancel that drip.");
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Couldn't cancel that drip.");
    } finally {
      setBusy(null);
    }
  }

  if (loading) return <p className="flex items-center gap-2 py-6 text-sm text-gray-400"><Loader2 size={15} className="animate-spin" />Loading automations…</p>;
  if (!data) return (
    <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
      {error || "Couldn't load automations."} <button onClick={() => { setLoading(true); void load(); }} className="ml-2 font-semibold underline">Try again</button>
    </div>
  );

  const alreadyActive = new Set(data.runs.filter((run) => run.status === "active").map((run) => run.workflow_id));
  const optedOut = data.lead.is_dnc;

  return (
    <div className="space-y-6">
      {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 text-sm text-gray-600">
          <span>Latest reply sentiment</span>
          {data.last_sentiment ? <SentimentBadge sentiment={data.last_sentiment} /> : <span className="text-gray-400">No replies classified yet</span>}
        </div>
        <button onClick={() => setEnrolling(true)} disabled={optedOut} title={optedOut ? "This lead opted out and can't be enrolled" : undefined} className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"><UserPlus size={15} />Enroll in drip</button>
      </div>
      {optedOut && <p className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">This lead opted out. No automation will text them.</p>}

      <section>
        <h3 className="text-sm font-semibold text-gray-900">Text drips</h3>
        {data.runs.length === 0 ? (
          <p className="mt-2 text-sm text-gray-400">{leadName} isn’t in any drip. Use “Enroll in drip” to preview and start one.</p>
        ) : (
          <div className="mt-3 space-y-3">
            {data.runs.map((run) => (
              <div key={run.enrollment_id} className="rounded-xl border border-gray-100">
                <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2"><p className="text-sm font-semibold text-gray-900">{run.workflow_name}</p><span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold capitalize ${runBadge[run.status] ?? runBadge.completed}`}>{run.status}</span></div>
                    <p className="mt-1 text-xs text-gray-500">
                      Started {when(run.started_at)}
                      {run.status === "active" && run.next_due ? ` · Next message ${when(run.next_due)}` : ""}
                      {run.cancel_reason ? ` · ${reasonLabel[run.cancel_reason] ?? run.cancel_reason}` : ""}
                    </p>
                  </div>
                  {run.status === "active" && <button disabled={busy === run.enrollment_id} onClick={() => void cancel(run)} className="rounded-xl border border-red-200 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50">{busy === run.enrollment_id ? "Cancelling…" : "Cancel drip"}</button>}
                </div>
                <details className="border-t border-gray-100">
                  <summary className="cursor-pointer px-4 py-2.5 text-xs font-medium text-gray-500">Execution log ({run.executions.length} step{run.executions.length === 1 ? "" : "s"})</summary>
                  <ol className="space-y-3 px-4 pb-4">
                    {run.executions.map((execution) => (
                      <li key={execution.id} className="rounded-lg bg-gray-50 px-3 py-2.5">
                        <div className="flex flex-wrap items-center justify-between gap-2 text-xs"><span className="font-semibold text-gray-700">Step {execution.step_number}</span><span className={`font-medium capitalize ${execBadge[execution.status] ?? "text-gray-500"}`}>{execution.status}{execution.sent_at ? ` · ${when(execution.sent_at)}` : execution.status === "queued" ? ` · due ${when(execution.scheduled_for)}` : ""}</span></div>
                        <p className="mt-1 whitespace-pre-wrap text-sm text-gray-800">{execution.message}</p>
                        {execution.error && <p className="mt-1 text-xs text-red-600">{execution.error}</p>}
                      </li>
                    ))}
                  </ol>
                </details>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h3 className="text-sm font-semibold text-gray-900">Automation history</h3>
        {data.history.length === 0 ? (
          <p className="mt-2 text-sm text-gray-400">Nothing has run for this lead yet.</p>
        ) : (
          <ol className="mt-3 space-y-3 border-l border-gray-200 pl-4">
            {data.history.map((row) => (
              <li key={row.id} className="relative">
                <span className="absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-emerald-500" />
                <p className="text-sm font-medium text-gray-900">{row.action_taken ?? "Automation ran"}</p>
                <p className="text-xs text-gray-500">{[row.automation_type === "drip" ? "Drip" : row.automation_type === "auto_responder" ? "Auto-responder" : row.automation_type, row.automation_name].filter(Boolean).join(" · ")} · {when(row.created_at)}</p>
                {row.result && <p className="mt-0.5 text-xs text-gray-500">{row.result}</p>}
              </li>
            ))}
          </ol>
        )}
      </section>

      {enrolling && (
        <EnrollDialog
          workflows={data.workflows.map((workflow) => ({ ...workflow, status: alreadyActive.has(workflow.id) ? "enrolled" : workflow.status }))}
          lockedLead={{ id: data.lead.id, name: leadName }}
          onClose={() => setEnrolling(false)}
          onEnrolled={() => void load()}
        />
      )}
    </div>
  );
}
