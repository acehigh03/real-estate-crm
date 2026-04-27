import { format } from "date-fns";

import { getClassificationLabel } from "@/lib/ai/classify-lead";
import { addNote, deleteLead, saveLead, setFollowup, updateLeadStatus } from "@/app/actions";
import { fallbackAddress, formatClassificationColor, formatPhoneDisplay, formatStatusColor, leadDisplayName } from "@/lib/utils";
import type { Database, LeadClassification } from "@/types/database";

type Lead = Database["public"]["Tables"]["leads"]["Row"];
type Note = Database["public"]["Tables"]["notes"]["Row"];
type Followup = Database["public"]["Tables"]["followups"]["Row"];

const statuses = ["New", "Contacted", "Replied", "Hot", "Dead", "DNC"] as const;
const classifications: LeadClassification[] = ["HOT", "WARM", "COLD", "DEAD", "OPT_OUT", "UNKNOWN"];

export function LeadRow({
  lead,
  notes,
  followups
}: {
  lead: Lead;
  notes: Note[];
  followups: Followup[];
}) {
  const leadNotes = notes.filter((note) => note.lead_id === lead.id);
  const leadFollowups = followups.filter((followup) => followup.lead_id === lead.id);

  return (
    <details className="rounded-3xl border border-border bg-white shadow-card">
      <summary className="grid cursor-pointer grid-cols-1 gap-3 px-5 py-4 md:grid-cols-[1.2fr_1.6fr_1fr_1fr_0.8fr_0.8fr] md:items-center">
        <div>
          <p className="font-semibold">
            {leadDisplayName(lead)}
          </p>
          <p className="text-sm text-muted">{formatPhoneDisplay(lead.phone)}</p>
        </div>
        <p className="text-sm">{fallbackAddress(lead.property_address)}</p>
        <p className="text-sm text-slate-600">{lead.mailing_address ?? "No mailing address"}</p>
        <p className="text-sm text-slate-600">{lead.lead_source ?? "No source on file"}</p>
        <div className="flex flex-wrap gap-2">
          <span
            className={`inline-flex w-fit rounded-full px-3 py-1 text-xs font-semibold ${formatStatusColor(lead.status)}`}
          >
            {lead.status}
          </span>
          <span
            className={`inline-flex w-fit rounded-full px-3 py-1 text-xs font-semibold ${formatClassificationColor(lead.classification)}`}
          >
            {getClassificationLabel(lead.classification)}
          </span>
        </div>
        <p className="text-sm text-slate-600">{lead.tag ?? "No tag"}</p>
      </summary>

      <div className="grid gap-6 border-t border-border px-5 py-5 lg:grid-cols-[1.4fr_1fr]">
        <form action={saveLead} className="grid gap-3 md:grid-cols-2">
          <input type="hidden" name="id" value={lead.id} />
          <input name="first_name" defaultValue={lead.first_name} className="rounded-2xl border border-border px-4 py-3 text-sm" />
          <input name="last_name" defaultValue={lead.last_name} className="rounded-2xl border border-border px-4 py-3 text-sm" />
          <input name="property_address" defaultValue={lead.property_address} className="rounded-2xl border border-border px-4 py-3 text-sm md:col-span-2" />
          <input name="mailing_address" defaultValue={lead.mailing_address ?? ""} className="rounded-2xl border border-border px-4 py-3 text-sm md:col-span-2" />
          <input name="phone" defaultValue={lead.phone} className="rounded-2xl border border-border px-4 py-3 text-sm" />
          <input name="email" defaultValue={lead.email ?? ""} className="rounded-2xl border border-border px-4 py-3 text-sm" />
          <input name="lead_source" defaultValue={lead.lead_source ?? ""} className="rounded-2xl border border-border px-4 py-3 text-sm" />
          <input name="tag" defaultValue={lead.tag ?? ""} className="rounded-2xl border border-border px-4 py-3 text-sm" />
          <select name="status" defaultValue={lead.status} className="rounded-2xl border border-border px-4 py-3 text-sm">
            {statuses.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
          <select name="classification" defaultValue={lead.classification} className="rounded-2xl border border-border px-4 py-3 text-sm">
            {classifications.map((classification) => (
              <option key={classification} value={classification}>
                {getClassificationLabel(classification)}
              </option>
            ))}
          </select>
          <input
            name="next_follow_up_at"
            type="datetime-local"
            defaultValue={lead.next_follow_up_at ? lead.next_follow_up_at.slice(0, 16) : ""}
            className="rounded-2xl border border-border px-4 py-3 text-sm"
          />
          <textarea
            name="notes_summary"
            defaultValue={lead.notes_summary ?? ""}
            rows={4}
            className="rounded-2xl border border-border px-4 py-3 text-sm md:col-span-2"
            placeholder="Lead summary"
          />
          <div className="flex flex-wrap gap-3 md:col-span-2">
            <button type="submit" className="rounded-2xl bg-slate-900 px-4 py-3 text-sm font-medium text-white">
              Save Lead
            </button>
          </div>
        </form>

        <div className="space-y-5">
          <div className="rounded-3xl border border-border p-4">
            <div className="flex gap-2">
              <form action={updateLeadStatus}>
                <input type="hidden" name="id" value={lead.id} />
                <input type="hidden" name="status" value="Hot" />
                <button type="submit" className="rounded-2xl bg-amber-500 px-4 py-2 text-sm font-medium text-white">
                  Mark Hot
                </button>
              </form>
              <form action={updateLeadStatus}>
                <input type="hidden" name="id" value={lead.id} />
                <input type="hidden" name="status" value="DNC" />
                <button type="submit" className="rounded-2xl bg-rose-600 px-4 py-2 text-sm font-medium text-white">
                  Mark DNC
                </button>
              </form>
              <form action={deleteLead}>
                <input type="hidden" name="id" value={lead.id} />
                <button type="submit" className="rounded-2xl border border-border px-4 py-2 text-sm font-medium">
                  Delete
                </button>
              </form>
            </div>
          </div>

          <div className="rounded-3xl border border-border p-4">
            <h4 className="font-semibold">Notes</h4>
            <form action={addNote} className="mt-3 space-y-3">
              <input type="hidden" name="lead_id" value={lead.id} />
              <textarea
                name="body"
                rows={3}
                className="w-full rounded-2xl border border-border px-4 py-3 text-sm"
                placeholder="Add a note"
              />
              <button type="submit" className="rounded-2xl bg-accent px-4 py-2 text-sm font-medium text-white">
                Add Note
              </button>
            </form>
            <div className="mt-4 space-y-3">
              {leadNotes.length ? (
                leadNotes.map((note) => (
                  <div key={note.id} className="rounded-2xl bg-slate-50 p-3 text-sm">
                    <p>{note.body}</p>
                    <p className="mt-2 text-xs text-muted">{format(new Date(note.created_at), "PPp")}</p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted">No notes yet.</p>
              )}
            </div>
          </div>

          <div className="rounded-3xl border border-border p-4">
            <h4 className="font-semibold">Follow-up</h4>
            <form action={setFollowup} className="mt-3 space-y-3">
              <input type="hidden" name="lead_id" value={lead.id} />
              <input name="due_date" type="date" required className="w-full rounded-2xl border border-border px-4 py-3 text-sm" />
              <input name="next_follow_up_at" type="datetime-local" className="w-full rounded-2xl border border-border px-4 py-3 text-sm" />
              <textarea name="note" rows={2} className="w-full rounded-2xl border border-border px-4 py-3 text-sm" placeholder="Follow-up note" />
              <button type="submit" className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-medium text-white">
                Set Follow-up
              </button>
            </form>
            <div className="mt-4 space-y-2">
              {leadFollowups.length ? (
                leadFollowups.map((followup) => (
                  <div key={followup.id} className="rounded-2xl bg-slate-50 p-3 text-sm">
                    <p className="font-medium">{format(new Date(followup.due_date), "PPP")}</p>
                    <p className="text-muted">{followup.note ?? "No note"}</p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted">No follow-ups scheduled.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </details>
  );
}
