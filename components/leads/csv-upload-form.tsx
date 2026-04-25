"use client";

import { useState, useTransition } from "react";

export function CsvUploadForm() {
  const [status, setStatus] = useState<string>("");
  const [isPending, startTransition] = useTransition();

  return (
    <form
      className="rounded-3xl border border-dashed border-border bg-white p-5"
      onSubmit={(event) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);

        startTransition(async () => {
          const response = await fetch("/api/upload-csv", {
            method: "POST",
            body: formData
          });

          const data = await response.json();
          setStatus(response.ok ? `Imported ${data.inserted} leads.` : data.error);

          if (response.ok) {
            window.location.reload();
          }
        });
      }}
    >
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h3 className="text-lg font-semibold">Upload CSV</h3>
          <p className="text-sm text-muted">
            Accepted headers: first_name, last_name, property_address, mailing_address, phone, email, lead_source, status, tag, notes
          </p>
        </div>

        <div className="flex flex-col gap-3 md:flex-row">
          <input
            name="file"
            type="file"
            accept=".csv,text/csv"
            required
            className="rounded-2xl border border-border px-4 py-3 text-sm"
          />
          <button
            type="submit"
            disabled={isPending}
            className="rounded-2xl bg-accent px-4 py-3 text-sm font-medium text-white"
          >
            {isPending ? "Uploading..." : "Upload CSV"}
          </button>
        </div>
      </div>

      {status ? <p className="mt-4 text-sm text-slate-600">{status}</p> : null}
    </form>
  );
}
