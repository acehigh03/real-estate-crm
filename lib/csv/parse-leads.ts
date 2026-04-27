import Papa from "papaparse";

import { normalizePhone } from "@/lib/utils";
import type { LeadStatus } from "@/types/database";

const allowedStatuses = new Set<LeadStatus>([
  "New",
  "Contacted",
  "Replied",
  "Hot",
  "Dead",
  "DNC"
]);

export interface CsvLeadRow {
  email: string | null;
  first_name: string;
  last_name: string;
  lead_source: string | null;
  mailing_address: string | null;
  notes_summary: string | null;
  phone: string;
  phone_normalized: string;
  property_address: string;
  status: LeadStatus;
  tag: string | null;
}

export function parseLeadCsv(csvText: string): { rows: CsvLeadRow[]; skippedCount: number } {
  const result = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (header) => header.trim().toLowerCase()
  });

  if (result.errors.length) {
    throw new Error(result.errors[0]?.message ?? "CSV parsing failed");
  }

  const rows: CsvLeadRow[] = [];
  let skippedCount = 0;

  for (const row of result.data) {
    const phone = row.phone?.trim();

    // Phone is required to send SMS — skip rows without it
    if (!phone) {
      skippedCount++;
      continue;
    }

    const status = (row.status?.trim() || "New") as LeadStatus;

    rows.push({
      first_name: row.first_name?.trim() || "there",
      last_name: row.last_name?.trim() || "",
      property_address: row.property_address?.trim() || "",
      mailing_address: row.mailing_address?.trim() || null,
      phone,
      phone_normalized: normalizePhone(phone),
      email: row.email?.trim() || null,
      lead_source: row.lead_source?.trim() || null,
      status: allowedStatuses.has(status) ? status : "New",
      tag: row.tag?.trim() || null,
      notes_summary: row.notes?.trim() || null,
    });
  }

  return { rows, skippedCount };
}
