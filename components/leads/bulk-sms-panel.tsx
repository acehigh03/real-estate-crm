"use client";

import { useMemo, useState, useTransition } from "react";

import type { Database } from "@/types/database";

type Lead = Database["public"]["Tables"]["leads"]["Row"];

export function BulkSmsPanel({ leads }: { leads: Lead[] }) {
  const [selected, setSelected] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState("");
  const [isPending, startTransition] = useTransition();

  const availableLeads = useMemo(
    () => leads.filter((lead) => lead.status !== "DNC"),
    [leads]
  );

  return (
    <section className="rounded-3xl border border-border bg-white p-5 shadow-card">
      <div className="flex flex-col gap-2">
        <h3 className="text-lg font-semibold">Bulk SMS</h3>
        <p className="text-sm text-muted">
          DNC leads are automatically excluded. STOP language is appended to every outbound message.
        </p>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <select
          multiple
          value={selected}
          onChange={(event) =>
            setSelected(Array.from(event.target.selectedOptions).map((option) => option.value))
          }
          className="min-h-40 rounded-2xl border border-border px-4 py-3 text-sm"
        >
          {availableLeads.map((lead) => (
            <option key={lead.id} value={lead.id}>
              {lead.first_name} {lead.last_name} - {lead.property_address}
            </option>
          ))}
        </select>

        <textarea
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          rows={6}
          placeholder="Write your outbound SMS..."
          className="rounded-2xl border border-border px-4 py-3 text-sm"
        />
      </div>

      <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-center">
        <button
          type="button"
          disabled={isPending || selected.length === 0 || !message.trim()}
          onClick={() =>
            startTransition(async () => {
              const response = await fetch("/api/send-bulk-sms", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ leadIds: selected, message })
              });
              const data = await response.json();
              setStatus(response.ok ? `Sent ${data.sent} messages.` : data.error);
            })
          }
          className="rounded-2xl bg-slate-900 px-4 py-3 text-sm font-medium text-white disabled:opacity-60"
        >
          {isPending ? "Sending..." : "Send SMS"}
        </button>
        {status ? <p className="text-sm text-slate-600">{status}</p> : null}
      </div>
    </section>
  );
}
