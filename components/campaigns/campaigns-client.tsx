"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Pencil, Plus, X } from "lucide-react";

import type { CampaignStats } from "@/lib/campaigns";
import { formatShort } from "@/lib/format";
import { DEFAULT_FIRST_SMS_TEMPLATES } from "@/lib/sms/templates";
import { readSavedMessageTemplates, type SavedMessageTemplates } from "@/lib/sms/template-settings";
import type { CampaignType } from "@/types/database";

const TYPE_LABELS: Record<CampaignType, string> = {
  cash_offer: "Cash Offer",
  foreclosure_help: "Foreclosure",
  probate: "Probate",
  tax_sale: "Tax Sale",
  custom: "Custom",
};

const statusStyle = (status: string | null) =>
  (status ?? "active") === "active" ? "bg-[var(--c-emerald-soft)] text-[var(--c-emerald-text)]" : "bg-[var(--slate-100)] text-[var(--slate-500)] dark:bg-white/10";

export function CampaignsClient({ campaigns }: { campaigns: CampaignStats[] }) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<CampaignStats | null>(null);

  const totalLeads = campaigns.reduce((sum, campaign) => sum + campaign.leadCount, 0);
  const totalSent = campaigns.reduce((sum, campaign) => sum + campaign.sends, 0);
  const totalReplies = campaigns.reduce((sum, campaign) => sum + campaign.replies, 0);
  const rated = campaigns.filter((campaign) => campaign.replyRate !== null);
  const avgRate = rated.length ? rated.reduce((sum, campaign) => sum + (campaign.replyRate ?? 0), 0) / rated.length : null;

  const stats = [
    { label: "Campaigns", value: campaigns.length.toLocaleString("en-US") },
    { label: "Leads", value: totalLeads.toLocaleString("en-US") },
    { label: "Texts sent", value: totalSent.toLocaleString("en-US") },
    { label: "Replies", value: totalReplies.toLocaleString("en-US") },
    { label: "Avg reply rate", value: avgRate !== null ? `${avgRate.toFixed(1)}%` : "—" },
  ];

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-[var(--c-page)]">
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-[var(--c-border)] bg-[var(--c-surface)] px-4 py-4 sm:px-8">
        <div>
          <h1 className="h-display text-[26px]">Campaigns</h1>
          <p className="mt-0.5 text-[13px] text-[var(--c-muted)]">Reply rate is replies per person texted.</p>
        </div>
        <div className="flex gap-2">
          <Link href="/import" className="rounded-lg border border-[var(--c-border)] px-3 py-2 text-[13px] font-medium text-[var(--c-text-2)] hover:bg-[var(--c-surface-2)]">Import CSV</Link>
          <button type="button" onClick={() => setCreating(true)} className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--c-accent)] px-3 py-2 text-[13px] font-semibold text-white hover:bg-[var(--c-accent-strong)]"><Plus size={15} aria-hidden />New campaign</button>
        </div>
      </header>

      <main className="min-h-0 flex-1 overflow-auto px-4 py-5 sm:px-8">
        <section aria-label="Totals" className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-5">
          {stats.map((stat) => (
            <div key={stat.label} className="rounded-2xl border border-[var(--c-border)] bg-[var(--c-surface)] p-4">
              <p className="text-[12px] font-medium text-[var(--c-muted)]">{stat.label}</p>
              <p className="metric mt-2 text-[28px] text-[var(--c-text)]">{stat.value}</p>
            </div>
          ))}
        </section>

        {campaigns.length === 0 ? (
          <div className="flex h-48 flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-[var(--c-accent)]/60 bg-[var(--c-surface)] text-center">
            <p className="text-[14px] text-[var(--c-muted)]">No campaigns yet.</p>
            <button type="button" onClick={() => setCreating(true)} className="text-[13.5px] font-medium text-[var(--c-accent-strong)] hover:underline">Create your first campaign →</button>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-[var(--c-border)] bg-[var(--c-surface)]">
            <table className="w-full min-w-[820px] border-collapse text-[13.5px]">
              <thead className="border-b border-[var(--c-border)] bg-[var(--c-surface-2)]">
                <tr>
                  {["Campaign", "Status", "Leads", "Texts sent", "Replies", "Reply rate", "Last sent", ""].map((heading, index) => (
                    <th key={heading} scope="col" className={`px-4 py-2.5 text-[12px] font-semibold uppercase tracking-wide text-[var(--c-muted)] ${index < 2 ? "text-left" : "text-right"}`}>{heading}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--c-border)]">
                {campaigns.map((campaign) => (
                  <tr key={campaign.id} onClick={() => router.push(`/leads?campaign=${campaign.id}`)} className="cursor-pointer hover:bg-[var(--c-surface-2)]">
                    <td className="px-4 py-3.5"><p className="font-medium text-[var(--c-text)]">{campaign.name}</p><p className="text-[12px] text-[var(--c-muted)]">{campaign.campaign_type ? TYPE_LABELS[campaign.campaign_type] : "—"}</p></td>
                    <td className="px-4 py-3.5"><span className={`rounded-full px-2 py-0.5 text-[11.5px] font-semibold capitalize ${statusStyle(campaign.status)}`}>{campaign.status ?? "active"}</span></td>
                    <td className="num px-4 py-3.5 text-right text-[var(--c-text-2)]">{campaign.leadCount.toLocaleString("en-US")}</td>
                    <td className="num px-4 py-3.5 text-right text-[var(--c-text-2)]">{campaign.sends.toLocaleString("en-US")}</td>
                    <td className="num px-4 py-3.5 text-right text-[var(--c-text-2)]">{campaign.replies.toLocaleString("en-US")}</td>
                    <td className="num px-4 py-3.5 text-right font-medium text-[var(--c-accent-strong)]">{campaign.replyRate !== null ? `${campaign.replyRate.toFixed(1)}%` : "—"}</td>
                    <td className="num px-4 py-3.5 text-right text-[var(--c-muted)]">{campaign.lastSentAt ? formatShort(campaign.lastSentAt) : "—"}</td>
                    <td className="px-4 py-3.5 text-right"><button type="button" onClick={(event) => { event.stopPropagation(); setEditing(campaign); }} className="inline-flex items-center gap-1 rounded-lg border border-[var(--c-border)] px-2.5 py-1.5 text-[12px] font-medium text-[var(--c-text-2)] hover:bg-[var(--c-surface-2)]"><Pencil size={13} aria-hidden />Edit</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>

      {creating && <NewCampaign onClose={() => setCreating(false)} onCreated={() => { setCreating(false); router.refresh(); }} />}
      {editing && <CampaignEditor campaign={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); router.refresh(); }} />}
    </div>
  );
}

function CampaignEditor({ campaign, onClose, onSaved }: { campaign: CampaignStats; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(campaign.name);
  const [type, setType] = useState<CampaignType>(campaign.campaign_type ?? "custom");
  const [template, setTemplate] = useState(campaign.first_sms_template ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const input = "mt-1 w-full rounded-lg border border-[var(--c-border)] bg-[var(--c-surface)] px-3 py-2 text-[13.5px] text-[var(--c-text)] outline-none focus:border-[var(--c-accent)]";
  async function save(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const response = await fetch(`/api/campaigns/${campaign.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ name, campaign_type: type, first_sms_template: template }) });
      const data = await response.json().catch(() => null);
      if (!response.ok) return setError(data?.error ?? "Couldn't update the campaign.");
      onSaved();
    } catch { setError("Couldn't reach the server. Please try again."); }
    finally { setBusy(false); }
  }
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/30 p-4"><form onSubmit={save} role="dialog" aria-modal="true" aria-label="Edit campaign" className="w-full max-w-xl rounded-2xl border border-[var(--c-border)] bg-[var(--c-surface)] shadow-2xl">
    <div className="flex items-center justify-between border-b border-[var(--c-border)] px-5 py-4"><h2 className="text-[15px] font-semibold text-[var(--c-text)]">Edit campaign</h2><button type="button" onClick={onClose} aria-label="Close" className="rounded-lg p-1.5 text-[var(--c-muted)] hover:bg-[var(--c-surface-2)]"><X size={18} /></button></div>
    <div className="space-y-3 px-5 py-4"><label className="block text-[12px] font-medium text-[var(--c-muted)]">Name<input required autoFocus value={name} onChange={(event) => setName(event.target.value)} className={input} /></label><label className="block text-[12px] font-medium text-[var(--c-muted)]">Type<select value={type} onChange={(event) => setType(event.target.value as CampaignType)} className={input}>{(Object.keys(TYPE_LABELS) as CampaignType[]).map((key) => <option key={key} value={key}>{TYPE_LABELS[key]}</option>)}</select></label><label className="block text-[12px] font-medium text-[var(--c-muted)]">First text<textarea required rows={5} value={template} onChange={(event) => setTemplate(event.target.value)} className={input} /></label><p className="text-[12px] text-[var(--c-muted)]">This changes future imports only. Messages already sent are never modified.</p>{error && <p role="alert" className="text-[13px] text-[var(--c-rose-text)]">{error}</p>}</div>
    <div className="flex justify-end gap-2 border-t border-[var(--c-border)] px-5 py-3"><button type="button" onClick={onClose} className="rounded-lg border border-[var(--c-border)] px-4 py-2 text-[13.5px] font-medium text-[var(--c-text-2)]">Cancel</button><button type="submit" disabled={busy || !name.trim() || !template.trim()} className="rounded-lg bg-[var(--c-accent)] px-4 py-2 text-[13.5px] font-semibold text-white disabled:opacity-50">{busy ? "Saving…" : "Save changes"}</button></div>
  </form></div>;
}

function NewCampaign({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState("");
  const [type, setType] = useState<CampaignType>("cash_offer");
  const [template, setTemplate] = useState(DEFAULT_FIRST_SMS_TEMPLATES.cash_offer);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [savedTemplates, setSavedTemplates] = useState<SavedMessageTemplates>({ ...DEFAULT_FIRST_SMS_TEMPLATES });

  useEffect(() => {
    const saved = readSavedMessageTemplates();
    setSavedTemplates(saved);
    setTemplate(saved.cash_offer);
    fetch("/api/settings/templates").then(async (response) => {
      if (!response.ok) return;
      const data = await response.json();
      const merged = { ...saved, ...(data.templates ?? {}) } as SavedMessageTemplates;
      setSavedTemplates(merged); setTemplate(merged.cash_offer);
    }).catch(() => undefined);
  }, []);

  async function create(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/campaigns", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name, campaign_type: type, first_sms_template: template }) });
      const data = await response.json().catch(() => null);
      if (!response.ok) return setError(data?.error ?? "Couldn't create the campaign.");
      onCreated();
    } catch {
      setError("Couldn't reach the server. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  const input = "mt-1 w-full rounded-lg border border-[var(--c-border)] bg-[var(--c-surface)] px-3 py-2 text-[13.5px] text-[var(--c-text)] outline-none focus:border-[var(--c-accent)]";
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/30 p-4">
      <form onSubmit={create} role="dialog" aria-modal="true" aria-label="New campaign" className="w-full max-w-xl rounded-2xl border border-[var(--c-border)] bg-[var(--c-surface)] shadow-2xl">
        <div className="flex items-center justify-between border-b border-[var(--c-border)] px-5 py-4">
          <h2 className="text-[15px] font-semibold text-[var(--c-text)]">New campaign</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-lg p-1.5 text-[var(--c-muted)] hover:bg-[var(--c-surface-2)]"><X size={18} /></button>
        </div>
        <div className="space-y-3 px-5 py-4">
          <label className="block text-[12px] font-medium text-[var(--c-muted)]">Name<input required autoFocus value={name} onChange={(event) => setName(event.target.value)} placeholder="Harris County probate, September" className={input} /></label>
          <label className="block text-[12px] font-medium text-[var(--c-muted)]">Type
            <select value={type} onChange={(event) => { const next = event.target.value as CampaignType; setType(next); setTemplate(savedTemplates[next] ?? ""); }} className={input}>
              {(Object.keys(TYPE_LABELS) as CampaignType[]).map((key) => <option key={key} value={key}>{TYPE_LABELS[key]}</option>)}
            </select>
          </label>
          <label className="block text-[12px] font-medium text-[var(--c-muted)]">First text
            <textarea required rows={5} value={template} onChange={(event) => setTemplate(event.target.value)} className={input} />
          </label>
          <p className="text-[12px] text-[var(--c-muted)]">Use [[first_name]] and [[address]]. “Reply STOP to opt out.” is added automatically. Change defaults on the <Link href="/templates" className="font-medium text-[var(--c-accent-strong)] hover:underline">Templates page</Link>.</p>
          {error && <p role="alert" className="text-[13px] text-[var(--c-rose-text)]">{error}</p>}
        </div>
        <div className="flex justify-end gap-2 border-t border-[var(--c-border)] px-5 py-3">
          <button type="button" onClick={onClose} className="rounded-lg border border-[var(--c-border)] px-4 py-2 text-[13.5px] font-medium text-[var(--c-text-2)]">Cancel</button>
          <button type="submit" disabled={busy || !name.trim() || !template.trim()} className="rounded-lg bg-[var(--c-accent)] px-4 py-2 text-[13.5px] font-semibold text-white disabled:opacity-50">{busy ? "Creating…" : "Create campaign"}</button>
        </div>
      </form>
    </div>
  );
}
