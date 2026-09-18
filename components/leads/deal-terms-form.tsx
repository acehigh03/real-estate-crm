"use client";

import { useActionState } from "react";

import { saveDealTerms, type DealTermsState } from "@/app/actions";

// Where the investor records what the deal is worth and when it must close.
// Feeds the dashboard's "Estimated pipeline value" and "Deals at risk" cards.
export function DealTermsForm({
  leadId,
  dealValue,
  deadline,
}: {
  leadId: string;
  dealValue: number | null;
  deadline: string | null;
}) {
  const [state, formAction, pending] = useActionState<DealTermsState | null, FormData>(saveDealTerms, null);

  const inputClass =
    "mt-1 h-9 w-full rounded-md border border-gray-200 bg-white px-3 text-sm text-gray-900 outline-none focus:border-gray-400";

  return (
    <form action={formAction} className="mt-3 flex flex-wrap items-end gap-3 rounded-xl border border-gray-100 bg-white px-4 py-3">
      <input type="hidden" name="lead_id" value={leadId} />
      <label className="block min-w-[160px] flex-1 text-xs font-medium text-gray-500 sm:flex-none">
        Estimated deal value ($)
        <input
          name="deal_value"
          type="number"
          inputMode="decimal"
          min="0"
          step="0.01"
          defaultValue={dealValue ?? ""}
          placeholder="e.g. 25000"
          className={inputClass}
        />
      </label>
      <label className="block min-w-[160px] flex-1 text-xs font-medium text-gray-500 sm:flex-none">
        Deadline
        <input name="deadline" type="date" defaultValue={deadline ?? ""} className={inputClass} />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="inline-flex h-9 items-center rounded-md bg-emerald-700 px-4 text-[13px] font-medium text-white hover:bg-emerald-800 disabled:opacity-60"
      >
        {pending ? "Saving…" : "Save"}
      </button>
      <p
        role="status"
        aria-live="polite"
        className={`min-h-[1.25rem] text-xs ${state && !state.ok ? "font-medium text-rose-700" : "text-emerald-700"}`}
      >
        {state?.message ?? ""}
      </p>
    </form>
  );
}
