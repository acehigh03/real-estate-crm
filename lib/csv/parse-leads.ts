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

export function parseLeadCsv(csvText: string) {
  const result = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (header) => header.trim().toLowerCase()
  });

  if (result.errors.length) {
    throw new Error(result.errors[0]?.message ?? "CSV parsing failed");
  }

  return result.data.map((row, index) => {
    const firstName = row.first_name?.trim();
    const lastName = row.last_name?.trim();
    const propertyAddress = row.property_address?.trim();
    const phone = row.phone?.trim();

    if (!firstName || !lastName || !propertyAddress || !phone) {
      throw new Error(`Row ${index + 2} is missing one of: first_name, last_name, property_address, phone.`);
    }

    const status = (row.status?.trim() || "New") as LeadStatus;

    return {
      first_name: firstName,
      last_name: lastName,
      property_address: propertyAddress,
      mailing_address: row.mailing_address?.trim() || null,
      phone,
      phone_normalized: normalizePhone(phone),
      email: row.email?.trim() || null,
      lead_source: row.lead_source?.trim() || null,
      status: allowedStatuses.has(status) ? status : "New",
      tag: row.tag?.trim() || null,
      notes_summary: row.notes?.trim() || null
    } satisfies CsvLeadRow;
  });
}
