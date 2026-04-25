import { BulkSmsPanel } from "@/components/leads/bulk-sms-panel";
import { CsvUploadForm } from "@/components/leads/csv-upload-form";
import { LeadRow } from "@/components/leads/lead-row";
import { getLeadsPageData } from "@/lib/data";

export default async function LeadsPage() {
  const { leads, notes, followups } = await getLeadsPageData();

  return (
    <div className="space-y-6">
      <section>
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-accent">Pipeline</p>
        <h1 className="text-3xl font-semibold tracking-tight">Leads</h1>
        <p className="mt-2 text-sm text-muted">
          Upload new seller lists, update statuses, add notes, schedule follow-ups, and send outbound SMS.
        </p>
      </section>

      <CsvUploadForm />

      <BulkSmsPanel leads={leads} />

      <section className="space-y-4">
        <div className="grid grid-cols-1 gap-3 px-5 text-xs font-semibold uppercase tracking-[0.16em] text-muted md:grid-cols-[1.2fr_1.6fr_1fr_1fr_0.8fr_0.8fr]">
          <span>Lead</span>
          <span>Property</span>
          <span>Mailing</span>
          <span>Source</span>
          <span>Status</span>
          <span>Tag</span>
        </div>
        {leads.length ? (
          leads.map((lead) => (
            <LeadRow key={lead.id} lead={lead} notes={notes} followups={followups} />
          ))
        ) : (
          <div className="rounded-3xl border border-border bg-white p-8 text-sm text-muted shadow-card">
            No leads yet. Upload your first CSV above.
          </div>
        )}
      </section>
    </div>
  );
}
