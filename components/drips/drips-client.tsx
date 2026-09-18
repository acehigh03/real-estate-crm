"use client";

import { useMemo, useState } from "react";
import { Plus, Play, Pause, Copy, X, MessageSquareText, Clock3, Users } from "lucide-react";

import { formatDelay } from "@/lib/drips";
import type { Database, DripWorkflowStatus } from "@/types/database";

type Workflow = Database["public"]["Tables"]["drip_workflows"]["Row"];
type Step = Database["public"]["Tables"]["drip_steps"]["Row"];

const statusStyle: Record<DripWorkflowStatus, string> = {
  active: "bg-emerald-50 text-emerald-700 border-emerald-100",
  draft: "bg-slate-100 text-slate-600 border-slate-200",
  paused: "bg-amber-50 text-amber-700 border-amber-100",
  archived: "bg-slate-50 text-slate-500 border-slate-200",
};

export function DripsClient({ workflows: initialWorkflows, steps, enrollments }: {
  workflows: Workflow[]; steps: Step[]; enrollments: Array<{ workflow_id: string; status: string }>;
}) {
  const [workflows, setWorkflows] = useState(initialWorkflows);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [name, setName] = useState("");
  const [continueAfterReply, setContinueAfterReply] = useState(false);
  const [draftSteps, setDraftSteps] = useState([{ delay_minutes: 0, message: "Hi {{first_name}}, this is Senay. Would you consider an offer for {{property_address}}? Reply STOP to opt out." }]);

  const byWorkflow = useMemo(() => {
    const map = new Map<string, Step[]>();
    steps.forEach((step) => map.set(step.workflow_id, [...(map.get(step.workflow_id) ?? []), step]));
    return map;
  }, [steps]);

  const activeEnrollments = (id: string) => enrollments.filter((item) => item.workflow_id === id && item.status === "active").length;

  async function createWorkflow() {
    setError("");
    if (!name.trim() || draftSteps.some((step) => !step.message.trim())) {
      setError("Give the workflow a name and complete every message step.");
      return;
    }
    setSaving(true);
    const response = await fetch("/api/drips", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name, continue_after_reply: continueAfterReply, steps: draftSteps }) });
    const data = await response.json();
    setSaving(false);
    if (!response.ok) return setError(data.error ?? "Could not create workflow.");
    setWorkflows((items) => [data.workflow, ...items]);
    setOpen(false); setName(""); setContinueAfterReply(false);
    setDraftSteps([{ delay_minutes: 0, message: "Hi {{first_name}}, this is Senay. Would you consider an offer for {{property_address}}? Reply STOP to opt out." }]);
  }

  async function setStatus(workflow: Workflow, status: DripWorkflowStatus) {
    const response = await fetch(`/api/drips/${workflow.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ status }) });
    if (!response.ok) return setError("Could not update the workflow. Please try again.");
    setWorkflows((items) => items.map((item) => item.id === workflow.id ? { ...item, status } : item));
  }

  return <div className="crm-page flex flex-1 flex-col overflow-hidden">
    <header className="crm-page-header flex shrink-0 flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-6">
      <div><h1 className="crm-header-title">Text Drips</h1><p className="crm-header-copy">Build follow-up sequences that stay personal and stop when a seller opts out.</p></div>
      <button onClick={() => setOpen(true)} className="crm-button-primary inline-flex items-center gap-2"><Plus size={16}/>New workflow</button>
    </header>
    <main className="flex-1 overflow-auto bg-[var(--bg)] px-4 py-5 sm:px-6">
      <div className="mx-auto max-w-[1320px]">
        <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Metric icon={<Play size={17}/>} label="Active workflows" value={workflows.filter(w => w.status === "active").length} />
          <Metric icon={<Users size={17}/>} label="Active enrollments" value={enrollments.filter(e => e.status === "active").length} />
          <Metric icon={<MessageSquareText size={17}/>} label="Messages queued" value="—" sub="Available after the execution worker is connected" />
        </div>
        {error && <div role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
        {workflows.length === 0 ? <Empty onCreate={() => setOpen(true)} /> : <div className="grid gap-4 lg:grid-cols-2">
          {workflows.map(workflow => {
            const workflowSteps = byWorkflow.get(workflow.id) ?? [];
            return <article key={workflow.id} className="dash-card p-5">
              <div className="flex items-start justify-between gap-4"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h2 className="truncate text-base font-semibold text-[var(--t1)]">{workflow.name}</h2><span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold capitalize ${statusStyle[workflow.status]}`}>{workflow.status}</span></div><p className="mt-1 text-sm text-[var(--t2)]">{workflowSteps.length} step{workflowSteps.length === 1 ? "" : "s"} · {activeEnrollments(workflow.id)} active lead{activeEnrollments(workflow.id) === 1 ? "" : "s"}</p></div><button aria-label="Duplicate workflow" className="rounded-lg border border-[var(--b1)] p-2 text-[var(--t2)] hover:bg-[var(--s2)]"><Copy size={15}/></button></div>
              <ol className="mt-5 space-y-3 border-l border-[var(--b1)] pl-4">{workflowSteps.slice(0, 3).map(step => <li key={step.id} className="relative"><span className="absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-emerald-500"/><p className="text-xs font-semibold text-[var(--t2)]">{step.step_number === 1 ? "Immediately" : `Wait ${formatDelay(step.delay_minutes)}`}</p><p className="mt-1 line-clamp-2 text-sm text-[var(--t1)]">{step.message}</p></li>)}</ol>
              <div className="mt-5 flex items-center justify-between border-t border-[var(--b1)] pt-4"><span className="text-xs text-[var(--t2)]">{workflow.continue_after_reply ? "Continues after a reply" : "Pauses after a reply"}</span>{workflow.status === "active" ? <button onClick={() => setStatus(workflow, "paused")} className="crm-button-secondary inline-flex items-center gap-1.5"><Pause size={14}/>Pause</button> : <button onClick={() => setStatus(workflow, "active")} className="crm-button-soft inline-flex items-center gap-1.5"><Play size={14}/>Activate</button>}</div>
            </article>;
          })}
        </div>}
      </div>
    </main>
    {open && <WorkflowModal name={name} setName={setName} steps={draftSteps} setSteps={setDraftSteps} continueAfterReply={continueAfterReply} setContinueAfterReply={setContinueAfterReply} saving={saving} error={error} onClose={() => { setOpen(false); setError(""); }} onSave={createWorkflow} />}
  </div>;
}

function Metric({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string | number; sub?: string }) { return <div className="dash-card flex items-center gap-3 px-4 py-4"><span className="rounded-lg bg-emerald-50 p-2 text-emerald-700">{icon}</span><div><p className="text-xs font-medium text-[var(--t2)]">{label}</p><p className="mt-0.5 text-xl font-semibold text-[var(--t1)]">{value}</p>{sub && <p className="mt-0.5 text-[11px] text-[var(--t3)]">{sub}</p>}</div></div>; }
function Empty({ onCreate }: { onCreate: () => void }) { return <div className="dash-card flex min-h-[320px] flex-col items-center justify-center px-6 text-center"><span className="rounded-2xl bg-emerald-50 p-4 text-emerald-700"><Clock3 size={26}/></span><h2 className="mt-4 text-lg font-semibold text-[var(--t1)]">Your follow-up system starts here</h2><p className="mt-2 max-w-md text-sm text-[var(--t2)]">Create a short, personal sequence for sellers who don’t reply right away. You’ll review leads before anyone is enrolled.</p><button onClick={onCreate} className="crm-button-primary mt-5 inline-flex items-center gap-2"><Plus size={16}/>Create first workflow</button></div>; }
function WorkflowModal(props: { name: string; setName: (v: string) => void; steps: Array<{delay_minutes:number;message:string}>; setSteps: React.Dispatch<React.SetStateAction<Array<{delay_minutes:number;message:string}>>>; continueAfterReply:boolean; setContinueAfterReply:(v:boolean)=>void; saving:boolean; error:string; onClose:()=>void; onSave:()=>void; }) { const { name,setName,steps,setSteps,continueAfterReply,setContinueAfterReply,saving,onClose,onSave } = props; return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/30 p-4"><section role="dialog" aria-modal="true" className="max-h-[90vh] w-full max-w-2xl overflow-auto rounded-2xl border border-[var(--b1)] bg-white shadow-2xl"><div className="flex items-center justify-between border-b border-[var(--b1)] px-5 py-4"><div><h2 className="font-semibold text-[var(--t1)]">New text drip</h2><p className="mt-0.5 text-sm text-[var(--t2)]">Messages are always editable before you activate.</p></div><button onClick={onClose} aria-label="Close" className="rounded-lg p-2 text-[var(--t2)] hover:bg-[var(--s2)]"><X size={18}/></button></div><div className="space-y-5 p-5"><label className="block text-sm font-medium text-[var(--t1)]">Workflow name<input autoFocus value={name} onChange={e=>setName(e.target.value)} placeholder="Cold seller follow-up" className="mt-1.5 w-full rounded-lg border border-[var(--b2)] px-3 py-2.5 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"/></label><div><div className="mb-2 flex items-center justify-between"><p className="text-sm font-medium text-[var(--t1)]">Sequence</p><button onClick={()=>setSteps(current=>[...current,{delay_minutes:1440,message:"Hi {{first_name}}, just following up about {{property_address}}. Would it make sense to talk?"}])} className="text-sm font-semibold text-emerald-700 hover:text-emerald-800">+ Add step</button></div><div className="space-y-3">{steps.map((step,index)=><div key={index} className="rounded-xl border border-[var(--b1)] bg-[var(--s2)] p-3"><div className="flex items-center justify-between gap-3"><p className="text-xs font-semibold text-[var(--t2)]">STEP {index+1}</p>{index>0&&<button onClick={()=>setSteps(current=>current.filter((_,i)=>i!==index))} className="text-xs font-medium text-red-600">Remove</button>}</div>{index>0&&<label className="mt-3 block text-xs font-medium text-[var(--t2)]">Wait before sending (minutes)<input type="number" min="0" value={step.delay_minutes} onChange={e=>setSteps(current=>current.map((item,i)=>i===index?{...item,delay_minutes:Math.max(0,Number(e.target.value))}:item))} className="mt-1 w-32 rounded-lg border border-[var(--b2)] bg-white px-2 py-1.5 text-sm"/></label>}<textarea value={step.message} maxLength={1600} onChange={e=>setSteps(current=>current.map((item,i)=>i===index?{...item,message:e.target.value}:item))} rows={3} className="mt-3 w-full resize-y rounded-lg border border-[var(--b2)] bg-white px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"/><p className="mt-1 text-right text-[11px] text-[var(--t3)]">{step.message.length}/1600</p></div>)}</div></div><label className="flex cursor-pointer items-start gap-3 rounded-xl border border-[var(--b1)] p-3"><input type="checkbox" checked={continueAfterReply} onChange={e=>setContinueAfterReply(e.target.checked)} className="mt-0.5 h-4 w-4 accent-emerald-600"/><span><span className="block text-sm font-medium text-[var(--t1)]">Continue after a seller replies</span><span className="mt-0.5 block text-xs text-[var(--t2)]">Off is safer for cold outreach. You can change it later.</span></span></label></div><div className="flex justify-end gap-3 border-t border-[var(--b1)] px-5 py-4"><button onClick={onClose} className="crm-button-secondary">Cancel</button><button disabled={saving} onClick={onSave} className="crm-button-primary disabled:opacity-50">{saving?"Saving…":"Save draft"}</button></div></section></div>; }
