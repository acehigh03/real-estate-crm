"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, Bell, Loader2, MessageSquareReply, Pencil, Plus, Sparkles, Tag, Trash2, X, Zap } from "lucide-react";

import { SENTIMENT_LABEL } from "@/components/automation/sentiment-badge";
import { REPLY_SENTIMENTS, STAGE_OPTIONS, TRIGGER_TYPES, type AutomationAction, type AutomationConditions, type ReplySentimentValue, type TriggerType } from "@/lib/automation/rules";
import type { Database } from "@/types/database";

type Responder = Database["public"]["Tables"]["auto_responders"]["Row"];
type ActionType = AutomationAction["type"];
type Draft = { id: string | null; name: string; is_active: boolean; trigger_type: TriggerType; trigger_value: string; stage: string; tag: string; actions: AutomationAction[] };

const TRIGGER_LABEL: Record<TriggerType, string> = { keyword: "Keyword match", any_reply: "Any reply", first_reply: "First reply", sentiment: "Sentiment" };
const TRIGGER_HELP: Record<TriggerType, string> = {
  keyword: "Fires when the seller's text contains one of your keywords.",
  any_reply: "Fires on every reply from a seller.",
  first_reply: "Fires only on a seller's very first reply.",
  sentiment: "Fires when AI reads the reply as interested, maybe, not interested, STOP or a question.",
};
const ACTION_LABEL: Record<ActionType, string> = { send_sms: "Send SMS", tag_lead: "Add tag", update_stage: "Move to stage", notify: "Notify me", cancel_drips: "Cancel active drips" };
const HELPERS = ["[[first_name]]", "[[address]]"] as const;

const newAction = (type: ActionType): AutomationAction =>
  type === "send_sms" ? { type, message: "" }
  : type === "tag_lead" ? { type, tag: "" }
  : type === "update_stage" ? { type, stage: "Replied" }
  : type === "notify" ? { type, message: "" }
  : { type };

const blankDraft = (): Draft => ({ id: null, name: "", is_active: true, trigger_type: "any_reply", trigger_value: "", stage: "", tag: "", actions: [{ type: "cancel_drips" }] });

function toDraft(row: Responder): Draft {
  const conditions = (row.conditions ?? {}) as AutomationConditions;
  return {
    id: row.id, name: row.name, is_active: row.is_active, trigger_type: row.trigger_type as TriggerType, trigger_value: row.trigger_value ?? "",
    stage: conditions.stage ?? "", tag: conditions.tag ?? "", actions: Array.isArray(row.actions) ? (row.actions as unknown as AutomationAction[]) : [],
  };
}

function triggerSummary(row: Responder) {
  const type = row.trigger_type as TriggerType;
  if (type === "keyword") return `Keyword: ${row.trigger_value ?? ""}`;
  if (type === "sentiment") return `Sentiment: ${SENTIMENT_LABEL[row.trigger_value as ReplySentimentValue] ?? row.trigger_value}`;
  return TRIGGER_LABEL[type];
}

function describe(action: AutomationAction) {
  switch (action.type) {
    case "send_sms": return `Text: “${action.message}”`;
    case "tag_lead": return `Tag “${action.tag}”`;
    case "update_stage": return `Move to ${action.stage}`;
    case "notify": return action.message ? `Notify: ${action.message}` : "Notify me";
    case "cancel_drips": return "Cancel active drips";
  }
}

const ActionIcon = ({ type }: { type: ActionType }) => type === "send_sms" ? <MessageSquareReply size={13}/> : type === "tag_lead" ? <Tag size={13}/> : type === "notify" ? <Bell size={13}/> : <Zap size={13}/>;

export function AutoRespondersClient({ initial, loadError }: { initial: Responder[]; loadError: string }) {
  const [items, setItems] = useState(initial);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState(loadError);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function toggle(row: Responder) {
    setError("");
    setBusyId(row.id);
    const next = !row.is_active;
    setItems((current) => current.map((item) => item.id === row.id ? { ...item, is_active: next } : item));
    const response = await fetch(`/api/auto-responders/${row.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ is_active: next }) }).catch(() => null);
    setBusyId(null);
    if (!response?.ok) {
      setItems((current) => current.map((item) => item.id === row.id ? { ...item, is_active: row.is_active } : item));
      setError("Couldn't update that auto-responder. Please try again.");
    }
  }

  async function remove(row: Responder) {
    if (!window.confirm(`Delete “${row.name}”? This can't be undone.`)) return;
    setError("");
    setBusyId(row.id);
    const response = await fetch(`/api/auto-responders/${row.id}`, { method: "DELETE" }).catch(() => null);
    setBusyId(null);
    if (!response?.ok) return setError("Couldn't delete that auto-responder. Please try again.");
    setItems((current) => current.filter((item) => item.id !== row.id));
  }

  return (
    <div className="crm-page flex flex-1 flex-col overflow-hidden">
      <header className="crm-page-header flex shrink-0 flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-6">
        <div><h1 className="crm-header-title">Auto Responders</h1><p className="crm-header-copy">Automatic actions when a seller replies — tag, move, notify, stop drips, or text back.</p></div>
        <button onClick={() => setDraft(blankDraft())} className="crm-button-primary inline-flex items-center gap-2"><Plus size={16}/>New auto-responder</button>
      </header>
      <main className="flex-1 overflow-auto bg-[var(--bg)] px-4 py-5 sm:px-6">
        <div className="mx-auto max-w-[1000px] space-y-3">
          {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
          <p className="rounded-xl border border-[var(--b1)] bg-white px-4 py-3 text-sm text-[var(--t2)]">A seller who replies STOP is opted out immediately and is never texted back, whatever these rules say. Auto-replies are limited to one per 10 minutes per lead.</p>
          {items.length === 0 && !loadError ? (
            <div className="dash-card flex min-h-[300px] flex-col items-center justify-center px-6 text-center">
              <span className="rounded-2xl bg-emerald-50 p-4 text-emerald-700"><Zap size={26}/></span>
              <h2 className="mt-4 text-lg font-semibold text-[var(--t1)]">No auto-responders yet</h2>
              <p className="mt-2 max-w-md text-sm text-[var(--t2)]">Start with “when a seller says they’re interested → tag them, move them to Qualified, stop the drip and text back.”</p>
              <button onClick={() => setDraft(blankDraft())} className="crm-button-primary mt-5 inline-flex items-center gap-2"><Plus size={16}/>Create your first auto-responder</button>
            </div>
          ) : items.map((row) => {
            const actions = (Array.isArray(row.actions) ? row.actions : []) as unknown as AutomationAction[];
            const conditions = (row.conditions ?? {}) as AutomationConditions;
            return (
              <article key={row.id} className={`dash-card p-4 sm:p-5 ${row.is_active ? "" : "opacity-70"}`}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-base font-semibold text-[var(--t1)]">{row.name}</h2>
                      <span className="rounded-full border border-blue-100 bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700">{triggerSummary(row)}</span>
                      <span className="rounded-full border border-[var(--b1)] px-2 py-0.5 text-[11px] font-medium text-[var(--t2)]">{actions.length} action{actions.length === 1 ? "" : "s"}</span>
                    </div>
                    {(conditions.stage || conditions.tag) && <p className="mt-1 text-xs text-[var(--t2)]">Only when {[conditions.stage && `stage is ${conditions.stage}`, conditions.tag && `tagged “${conditions.tag}”`].filter(Boolean).join(" and ")}</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    <button role="switch" aria-checked={row.is_active} aria-label={`${row.name} is ${row.is_active ? "active" : "paused"}`} disabled={busyId === row.id} onClick={() => void toggle(row)} className={`relative h-6 w-11 rounded-full transition-colors disabled:opacity-60 ${row.is_active ? "bg-emerald-500" : "bg-slate-300"}`}><span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${row.is_active ? "left-[22px]" : "left-0.5"}`}/></button>
                    <span className="w-12 text-xs font-medium text-[var(--t2)]">{row.is_active ? "Active" : "Paused"}</span>
                    <button aria-label={`Edit ${row.name}`} onClick={() => setDraft(toDraft(row))} className="rounded-lg border border-[var(--b1)] p-2 text-[var(--t2)] hover:bg-[var(--s2)]"><Pencil size={15}/></button>
                    <button aria-label={`Delete ${row.name}`} disabled={busyId === row.id} onClick={() => void remove(row)} className="rounded-lg border border-[var(--b1)] p-2 text-red-600 hover:bg-red-50 disabled:opacity-60"><Trash2 size={15}/></button>
                  </div>
                </div>
                <ol className="mt-3 flex flex-wrap gap-2">
                  {actions.map((action, index) => <li key={index} className="inline-flex max-w-full items-center gap-1.5 rounded-lg bg-[var(--s2)] px-2.5 py-1.5 text-xs text-[var(--t1)]"><span className="text-[var(--t3)]">{index + 1}</span><ActionIcon type={action.type}/><span className="truncate">{describe(action)}</span></li>)}
                </ol>
              </article>
            );
          })}
        </div>
      </main>
      {draft && <Editor draft={draft} onClose={() => setDraft(null)} onSaved={(saved) => { setItems((current) => current.some((item) => item.id === saved.id) ? current.map((item) => item.id === saved.id ? saved : item) : [saved, ...current]); setDraft(null); setError(""); }} />}
    </div>
  );
}

function Editor({ draft: initial, onClose, onSaved }: { draft: Draft; onClose: () => void; onSaved: (row: Responder) => void }) {
  const [draft, setDraft] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const set = (change: Partial<Draft>) => setDraft((current) => ({ ...current, ...change }));
  const setAction = (index: number, action: AutomationAction) => setDraft((current) => ({ ...current, actions: current.actions.map((item, i) => i === index ? action : item) }));
  const move = (index: number, by: number) => setDraft((current) => {
    const target = index + by;
    if (target < 0 || target >= current.actions.length) return current;
    const next = [...current.actions];
    [next[index], next[target]] = [next[target], next[index]];
    return { ...current, actions: next };
  });

  const stopWithSms = draft.trigger_type === "sentiment" && draft.trigger_value === "stop" && draft.actions.some((action) => action.type === "send_sms");

  async function suggest() {
    setError(""); setNote("");
    if (draft.trigger_type === "sentiment" && !draft.trigger_value) return setError("Choose a sentiment first, then ask for suggestions.");
    if (draft.trigger_type === "keyword" && !draft.trigger_value.trim()) return setError("Enter your keywords first, then ask for suggestions.");
    setSuggesting(true);
    try {
      const response = await fetch("/api/ai/suggest-actions", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ trigger_type: draft.trigger_type, trigger_value: draft.trigger_value || null }) });
      const data = await response.json();
      if (!response.ok) return setError(data.error ?? "Couldn't get suggestions.");
      set({ actions: data.actions });
      setNote(data.source === "ai" ? "AI suggested these actions — review and edit before saving." : "Suggested a sensible starting chain — review and edit before saving.");
    } catch {
      setError("Couldn't reach the server. Please try again.");
    } finally {
      setSuggesting(false);
    }
  }

  async function save() {
    setError("");
    if (!draft.name.trim()) return setError("Give this auto-responder a name.");
    if (!draft.actions.length) return setError("Add at least one action.");
    if (stopWithSms) return setError("Don't send a text in reply to STOP — opted-out sellers can't be contacted.");
    const conditions: AutomationConditions = {};
    if (draft.stage) conditions.stage = draft.stage as AutomationConditions["stage"];
    if (draft.tag.trim()) conditions.tag = draft.tag.trim();
    const body = { name: draft.name.trim(), is_active: draft.is_active, trigger_type: draft.trigger_type, trigger_value: draft.trigger_type === "keyword" || draft.trigger_type === "sentiment" ? draft.trigger_value.trim() : null, conditions, actions: draft.actions };
    setSaving(true);
    try {
      const response = await fetch(draft.id ? `/api/auto-responders/${draft.id}` : "/api/auto-responders", { method: draft.id ? "PATCH" : "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const data = await response.json();
      if (!response.ok) return setError(data.error ?? "Couldn't save the auto-responder.");
      onSaved(data.auto_responder);
    } catch {
      setError("Couldn't reach the server. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  const field = "mt-1.5 w-full rounded-lg border border-[var(--b2)] bg-white px-3 py-2.5 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/30 p-4">
      <section role="dialog" aria-modal="true" aria-label="Auto-responder" className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-[var(--b1)] bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-[var(--b1)] px-5 py-4">
          <h2 className="font-semibold text-[var(--t1)]">{draft.id ? "Edit auto-responder" : "New auto-responder"}</h2>
          <button onClick={onClose} aria-label="Close" className="rounded-lg p-2 text-[var(--t2)] hover:bg-[var(--s2)]"><X size={18}/></button>
        </div>
        <div className="flex-1 space-y-5 overflow-auto p-5">
          <label className="block text-sm font-medium text-[var(--t1)]">Name<input autoFocus value={draft.name} onChange={(event) => set({ name: event.target.value })} placeholder="Interested → qualify and reply" className={field}/></label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm font-medium text-[var(--t1)]">When a seller…
              <select value={draft.trigger_type} onChange={(event) => set({ trigger_type: event.target.value as TriggerType, trigger_value: "" })} className={field}>
                {TRIGGER_TYPES.map((type) => <option key={type} value={type}>{TRIGGER_LABEL[type]}</option>)}
              </select>
            </label>
            {draft.trigger_type === "keyword" && <label className="block text-sm font-medium text-[var(--t1)]">Keywords<input value={draft.trigger_value} onChange={(event) => set({ trigger_value: event.target.value })} placeholder="price, how much, offer" className={field}/></label>}
            {draft.trigger_type === "sentiment" && (
              <label className="block text-sm font-medium text-[var(--t1)]">Sentiment
                <select value={draft.trigger_value} onChange={(event) => set({ trigger_value: event.target.value })} className={field}>
                  <option value="">Choose…</option>
                  {REPLY_SENTIMENTS.map((sentiment) => <option key={sentiment} value={sentiment}>{SENTIMENT_LABEL[sentiment]}</option>)}
                </select>
              </label>
            )}
          </div>
          <p className="-mt-3 text-xs text-[var(--t2)]">{TRIGGER_HELP[draft.trigger_type]}{draft.trigger_type === "keyword" && " Separate keywords with commas."}</p>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm font-medium text-[var(--t1)]">Only if stage is <span className="font-normal text-[var(--t3)]">(optional)</span>
              <select value={draft.stage} onChange={(event) => set({ stage: event.target.value })} className={field}><option value="">Any stage</option>{STAGE_OPTIONS.map((stage) => <option key={stage} value={stage}>{stage}</option>)}</select>
            </label>
            <label className="block text-sm font-medium text-[var(--t1)]">Only if tagged <span className="font-normal text-[var(--t3)]">(optional)</span><input value={draft.tag} onChange={(event) => set({ tag: event.target.value })} placeholder="Probate" className={field}/></label>
          </div>

          <div>
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-medium text-[var(--t1)]">Then, in order</p>
              <button type="button" onClick={() => void suggest()} disabled={suggesting} className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 disabled:opacity-60">{suggesting ? <Loader2 size={13} className="animate-spin"/> : <Sparkles size={13}/>}{suggesting ? "Thinking…" : "Suggest actions"}</button>
            </div>
            {note && <p className="mt-2 text-xs text-emerald-700">{note}</p>}
            <ol className="mt-3 space-y-3">
              {draft.actions.map((action, index) => (
                <li key={index} className="rounded-xl border border-[var(--b1)] bg-[var(--s2)] p-3">
                  <div className="flex items-center gap-2">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white text-xs font-semibold text-[var(--t2)]">{index + 1}</span>
                    <select aria-label={`Action ${index + 1} type`} value={action.type} onChange={(event) => setAction(index, newAction(event.target.value as ActionType))} className="min-w-0 flex-1 rounded-lg border border-[var(--b2)] bg-white px-2.5 py-1.5 text-sm">
                      {(Object.keys(ACTION_LABEL) as ActionType[]).map((type) => <option key={type} value={type}>{ACTION_LABEL[type]}</option>)}
                    </select>
                    <button type="button" aria-label="Move up" disabled={index === 0} onClick={() => move(index, -1)} className="rounded-md p-1.5 text-[var(--t2)] hover:bg-white disabled:opacity-30"><ArrowUp size={14}/></button>
                    <button type="button" aria-label="Move down" disabled={index === draft.actions.length - 1} onClick={() => move(index, 1)} className="rounded-md p-1.5 text-[var(--t2)] hover:bg-white disabled:opacity-30"><ArrowDown size={14}/></button>
                    <button type="button" aria-label="Remove action" onClick={() => set({ actions: draft.actions.filter((_, i) => i !== index) })} className="rounded-md p-1.5 text-red-600 hover:bg-white"><Trash2 size={14}/></button>
                  </div>
                  {action.type === "send_sms" && (
                    <div className="mt-2.5">
                      <textarea aria-label="SMS text" rows={2} maxLength={320} value={action.message} onChange={(event) => setAction(index, { type: "send_sms", message: event.target.value })} placeholder="Great, [[first_name]]! What's a good time to talk about [[address]]?" className="w-full resize-y rounded-lg border border-[var(--b2)] bg-white px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"/>
                      <div className="mt-1 flex items-center justify-between gap-2">
                        <div className="flex gap-1.5">{HELPERS.map((token) => <button key={token} type="button" onClick={() => setAction(index, { type: "send_sms", message: `${action.message}${token}`.slice(0, 320) })} className="rounded-md border border-[var(--b2)] bg-white px-2 py-0.5 font-mono text-[11px] text-[var(--t2)] hover:border-emerald-300 hover:text-emerald-700">{token}</button>)}</div>
                        <span className="text-[11px] text-[var(--t3)]">{action.message.length}/320</span>
                      </div>
                    </div>
                  )}
                  {action.type === "tag_lead" && <input aria-label="Tag" value={action.tag} maxLength={40} onChange={(event) => setAction(index, { type: "tag_lead", tag: event.target.value.replace(/,/g, "") })} placeholder="Tag name, e.g. Interested" className="mt-2.5 w-full rounded-lg border border-[var(--b2)] bg-white px-3 py-2 text-sm outline-none focus:border-emerald-500"/>}
                  {action.type === "update_stage" && <select aria-label="Stage" value={action.stage} onChange={(event) => setAction(index, { type: "update_stage", stage: event.target.value as (typeof STAGE_OPTIONS)[number] })} className="mt-2.5 w-full rounded-lg border border-[var(--b2)] bg-white px-3 py-2 text-sm">{STAGE_OPTIONS.map((stage) => <option key={stage} value={stage}>{stage}</option>)}</select>}
                  {action.type === "notify" && <input aria-label="Note" value={action.message ?? ""} maxLength={200} onChange={(event) => setAction(index, { type: "notify", message: event.target.value })} placeholder="Note to leave on the lead, e.g. Hot reply — call now" className="mt-2.5 w-full rounded-lg border border-[var(--b2)] bg-white px-3 py-2 text-sm outline-none focus:border-emerald-500"/>}
                  {action.type === "cancel_drips" && <p className="mt-2 text-xs text-[var(--t2)]">Stops every active text drip for this lead.</p>}
                </li>
              ))}
            </ol>
            <div className="mt-3 flex flex-wrap gap-2">
              {(Object.keys(ACTION_LABEL) as ActionType[]).map((type) => <button key={type} type="button" disabled={draft.actions.length >= 8} onClick={() => set({ actions: [...draft.actions, newAction(type)] })} className="inline-flex items-center gap-1 rounded-lg border border-[var(--b1)] px-2.5 py-1.5 text-xs font-medium text-[var(--t2)] hover:bg-[var(--s2)] disabled:opacity-50"><Plus size={12}/>{ACTION_LABEL[type]}</button>)}
            </div>
            {stopWithSms && <p role="alert" className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">A seller who replies STOP is opted out and can’t be texted. Remove the “Send SMS” action.</p>}
          </div>

          <label className="flex cursor-pointer items-center gap-3 text-sm text-[var(--t1)]"><input type="checkbox" checked={draft.is_active} onChange={(event) => set({ is_active: event.target.checked })} className="h-4 w-4 accent-emerald-600"/>Active — start running as soon as it’s saved</label>
          {error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
        </div>
        <div className="flex justify-end gap-3 border-t border-[var(--b1)] px-5 py-4">
          <button onClick={onClose} className="crm-button-secondary">Cancel</button>
          <button disabled={saving} onClick={() => void save()} className="crm-button-primary disabled:opacity-50">{saving ? "Saving…" : draft.id ? "Save changes" : "Create auto-responder"}</button>
        </div>
      </section>
    </div>
  );
}
