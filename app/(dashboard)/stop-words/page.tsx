import { Ban, CheckCircle2, ShieldCheck } from "lucide-react";

const KEYWORDS = ["STOP", "STOPALL", "UNSUBSCRIBE", "CANCEL", "END", "QUIT"];

export default function StopWordsPage() {
  return <div className="flex min-h-0 flex-1 flex-col bg-[var(--c-page)]">
    <header className="border-b border-[var(--c-border)] bg-[var(--c-surface)] px-4 py-4 sm:px-8"><h1 className="h-display text-[26px]">Stop Words</h1><p className="mt-0.5 text-[13px] text-[var(--c-muted)]">Carrier-standard opt-outs enforced automatically across every campaign.</p></header>
    <main className="max-w-4xl space-y-4 px-4 py-5 sm:px-8">
      <section className="rounded-2xl border border-[var(--c-border)] bg-[var(--c-surface)] p-5"><div className="flex items-start gap-3"><span className="rounded-xl bg-[var(--c-rose-soft)] p-2 text-[var(--c-rose-text)]"><Ban size={20} /></span><div><h2 className="text-[15px] font-semibold text-[var(--c-text)]">Automatic DNC protection</h2><p className="mt-1 text-[13px] leading-5 text-[var(--c-muted)]">When a seller replies with one of these words, the CRM marks every matching phone record Do Not Contact and cancels active drip enrollments. These required keywords cannot be disabled.</p></div></div><div className="mt-4 flex flex-wrap gap-2">{KEYWORDS.map((word) => <span key={word} className="rounded-lg border border-[var(--c-border)] bg-[var(--c-surface-2)] px-3 py-1.5 font-mono text-[12px] font-semibold text-[var(--c-text-2)]">{word}</span>)}</div></section>
      <section className="grid gap-3 sm:grid-cols-2"><div className="rounded-2xl border border-[var(--c-border)] bg-[var(--c-surface)] p-4"><ShieldCheck size={18} className="text-[var(--c-accent-strong)]" /><h2 className="mt-2 text-[14px] font-semibold text-[var(--c-text)]">Natural-language protection</h2><p className="mt-1 text-[12.5px] leading-5 text-[var(--c-muted)]">Phrases such as “stop texting me,” “do not text,” and “opt out” are also recognized.</p></div><div className="rounded-2xl border border-[var(--c-border)] bg-[var(--c-surface)] p-4"><CheckCircle2 size={18} className="text-[var(--c-accent-strong)]" /><h2 className="mt-2 text-[14px] font-semibold text-[var(--c-text)]">False-positive protection</h2><p className="mt-1 text-[12.5px] leading-5 text-[var(--c-muted)]">Ordinary messages such as “I stopped by yesterday” do not trigger an opt-out.</p></div></section>
    </main>
  </div>;
}
