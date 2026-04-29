"use client";

import { format } from "date-fns";

import { updateForeclosureLead } from "@/app/actions";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatPhoneDisplay } from "@/lib/utils";
import type { ForeclosureLeadView } from "@/lib/data";

interface ForeclosuresClientProps {
  rows: ForeclosureLeadView[];
  tableMissing: boolean;
}

const STATUS_OPTIONS = [
  { value: "new", label: "New" },
  { value: "reviewing", label: "Reviewing" },
  { value: "contacted", label: "Contacted" },
  { value: "qualified", label: "Qualified" },
  { value: "closed", label: "Closed" },
  { value: "do_not_contact", label: "Do Not Contact" },
];

export function ForeclosuresClient({ rows, tableMissing }: ForeclosuresClientProps) {
  return (
    <div className="crm-page flex flex-1 flex-col overflow-hidden">
      <div className="crm-page-header flex shrink-0 items-center justify-between gap-4 px-6 py-4">
        <div>
          <h1 className="crm-header-title">Foreclosures</h1>
          <p className="mt-1 text-[13px] text-[#6b7c93]">
            Review foreclosure records inside the same CRM login and save status or notes back to Supabase.
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-auto px-6 py-4">
        {tableMissing ? (
          <div className="crm-panel p-4">
            <p className="text-[13px] text-[#1a1f36]">`public.foreclosure_leads` is not available yet.</p>
            <p className="mt-1 text-[12px] text-[#6b7c93]">
              Run the SQL in `supabase/phase5-foreclosures.sql`, or if the CRM tables are also missing, run `supabase/schema.sql` first.
            </p>
          </div>
        ) : rows.length === 0 ? (
          <div className="crm-panel p-4">
            <p className="text-[13px] text-[#6b7c93]">No foreclosure records found.</p>
          </div>
        ) : (
          <div className="crm-panel overflow-hidden p-0">
            <Table className="min-w-[980px]">
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="px-4 text-xs font-medium text-[#6b7c93]">Lead</TableHead>
                  <TableHead className="px-4 text-xs font-medium text-[#6b7c93]">Property</TableHead>
                  <TableHead className="px-4 text-xs font-medium text-[#6b7c93]">Campaign</TableHead>
                  <TableHead className="px-4 text-xs font-medium text-[#6b7c93]">Status</TableHead>
                  <TableHead className="px-4 text-xs font-medium text-[#6b7c93]">Notes</TableHead>
                  <TableHead className="px-4 text-xs font-medium text-[#6b7c93]">Updated</TableHead>
                  <TableHead className="px-4 text-right text-xs font-medium text-[#6b7c93]">Save</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.id} className="align-top hover:bg-[#f8f9fb]">
                    <TableCell colSpan={7} className="p-0">
                      <form action={updateForeclosureLead}>
                        <input type="hidden" name="id" value={row.id} />
                        <div className="grid grid-cols-[1.1fr_1.2fr_0.8fr_0.8fr_1.3fr_0.9fr_0.6fr] items-start">
                          <div className="px-4 py-3">
                            <div className="space-y-1">
                              <p className="text-sm font-semibold text-[#1a1f36]">{row.displayName}</p>
                              <p className="text-xs text-[#6b7c93]">{formatPhoneDisplay(row.phone || "") || "No phone on file"}</p>
                              {row.email ? <p className="text-xs text-[#6b7c93]">{row.email}</p> : null}
                            </div>
                          </div>
                          <div className="px-4 py-3">
                            <div className="space-y-1">
                              <p className="text-sm text-[#1a1f36]">{row.propertyAddress || "Address not found — verify with lead"}</p>
                              {row.cityStateZip ? <p className="text-xs text-[#6b7c93]">{row.cityStateZip}</p> : null}
                            </div>
                          </div>
                          <div className="px-4 py-3">
                            <div className="space-y-1 text-xs text-[#6b7c93]">
                              <p>{row.campaignName || "No campaign assigned"}</p>
                              <p>{row.campaignType || "No campaign assigned"}</p>
                            </div>
                          </div>
                          <div className="px-4 py-3">
                            <select
                              name="crm_status"
                              defaultValue={row.crmStatus}
                              className="crm-input h-9 w-full px-3 text-sm"
                            >
                              {STATUS_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div className="px-4 py-3">
                            <textarea
                              name="crm_notes"
                              defaultValue={row.crmNotes}
                              rows={3}
                              className="crm-input min-h-[76px] w-full rounded-[6px] px-3 py-2 text-sm"
                              placeholder="Add foreclosure notes..."
                            />
                          </div>
                          <div className="px-4 py-3">
                            <div className="space-y-1 text-xs text-[#6b7c93]">
                              <p>{row.updatedAt ? format(new Date(row.updatedAt), "MMM d, yyyy h:mm a") : "Not updated yet"}</p>
                              {row.createdAt ? <p>Created {format(new Date(row.createdAt), "MMM d, yyyy")}</p> : null}
                            </div>
                          </div>
                          <div className="px-4 py-3">
                            <div className="flex justify-end">
                              <Button
                                type="submit"
                                className="h-9 rounded-[6px] border-none bg-[#1a1f36] px-4 text-[12px] text-white hover:opacity-90"
                              >
                                Save
                              </Button>
                            </div>
                          </div>
                        </div>
                      </form>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
}
