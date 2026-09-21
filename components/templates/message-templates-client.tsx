"use client";

import Link from "next/link";
import { RotateCcw, Save } from "lucide-react";
import { useEffect, useState } from "react";

import {
  getDefaultMessageTemplates,
  readSavedMessageTemplates,
  saveMessageTemplates,
  type SavedMessageTemplates,
} from "@/lib/sms/template-settings";
import type { SmsCampaignType } from "@/lib/sms/templates";

const EDITABLE_TYPES: Array<{ type: Exclude<SmsCampaignType, "custom">; label: string; description: string }> = [
  { type: "cash_offer", label: "Cash Offer", description: "Default first message for general seller outreach." },
  { type: "foreclosure_help", label: "Foreclosure", description: "Default first message for foreclosure outreach." },
  { type: "probate", label: "Probate", description: "Default first message for inherited-property outreach." },
  { type: "tax_sale", label: "Tax Sale", description: "Default first message for property-tax outreach." },
];

export function MessageTemplatesClient() {
  const [templates, setTemplates] = useState<SavedMessageTemplates>(getDefaultMessageTemplates);
  const [saved, setSaved] = useState(false);

  useEffect(() => setTemplates(readSavedMessageTemplates()), []);

  function update(type: SmsCampaignType, value: string) {
    setSaved(false);
    setTemplates((current) => ({ ...current, [type]: value }));
  }

  function handleSave(event: React.FormEvent) {
    event.preventDefault();
    saveMessageTemplates(templates);
    setSaved(true);
    window.setTimeout(() => setSaved(false), 3000);
  }

  function resetDefaults() {
    const defaults = getDefaultMessageTemplates();
    setTemplates(defaults);
    saveMessageTemplates(defaults);
    setSaved(true);
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-[var(--c-page)]">
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-[var(--c-border)] bg-[var(--c-surface)] px-4 py-4 sm:px-8">
        <div>
          <h1 className="h-display text-[26px]">Message Templates</h1>
          <p className="mt-0.5 text-[13px] text-[var(--c-muted)]">Control the first-message defaults used when you create a campaign.</p>
        </div>
        <Link href="/drips" className="rounded-lg border border-[var(--c-border)] px-3 py-2 text-[13px] font-medium text-[var(--c-text-2)] hover:bg-[var(--c-surface-2)]">
          Manage follow-ups
        </Link>
      </header>

      <main className="min-h-0 flex-1 overflow-auto px-4 py-5 sm:px-8">
        <form onSubmit={handleSave} className="max-w-4xl space-y-4">
          <div className="rounded-xl border border-[var(--c-border)] bg-[var(--c-surface-2)] px-4 py-3 text-[12.5px] leading-5 text-[var(--c-muted)]">
            Use <code>[[first_name]]</code> and <code>[[address]]</code> for lead details. Use <code>{"{{Hi|Hello}}"}</code> for rotating wording. The CRM adds “Reply STOP to opt out.” to the first message automatically. These defaults apply only to new campaigns; saved campaigns are not changed.
          </div>

          {EDITABLE_TYPES.map(({ type, label, description }) => (
            <section key={type} className="overflow-hidden rounded-2xl border border-[var(--c-border)] bg-[var(--c-surface)]">
              <div className="border-b border-[var(--c-border)] px-4 py-3">
                <h2 className="text-[14px] font-semibold text-[var(--c-text)]">{label}</h2>
                <p className="mt-0.5 text-[12px] text-[var(--c-muted)]">{description}</p>
              </div>
              <div className="p-4">
                <textarea
                  value={templates[type]}
                  onChange={(event) => update(type, event.target.value)}
                  rows={5}
                  spellCheck
                  className="w-full resize-y rounded-xl border border-[var(--c-border)] bg-[var(--c-page)] px-3 py-2.5 text-[13.5px] leading-5 text-[var(--c-text)] outline-none focus:border-[var(--c-accent)]"
                />
              </div>
            </section>
          ))}

          <div className="sticky bottom-0 flex flex-wrap items-center gap-3 border-t border-[var(--c-border)] bg-[var(--c-page)] py-4">
            <button type="submit" className="inline-flex items-center gap-2 rounded-lg bg-[var(--c-accent)] px-4 py-2.5 text-[13px] font-semibold text-white hover:bg-[var(--c-accent-strong)]">
              <Save size={15} aria-hidden /> Save templates
            </button>
            <button type="button" onClick={resetDefaults} className="inline-flex items-center gap-2 rounded-lg border border-[var(--c-border)] px-4 py-2.5 text-[13px] font-medium text-[var(--c-text-2)] hover:bg-[var(--c-surface-2)]">
              <RotateCcw size={15} aria-hidden /> Restore defaults
            </button>
            {saved && <span className="text-[12.5px] font-medium text-[var(--c-accent-strong)]">Saved for this browser.</span>}
          </div>
        </form>
      </main>
    </div>
  );
}
