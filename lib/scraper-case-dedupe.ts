import type { ScraperLeadRow } from "@/types/scraper";

const HCAD_FIELDS = ["hcad_account", "address", "mailing_address", "property_value"] as const;
const MERGE_FIELDS = [
  "first_name",
  "last_name",
  "full_name",
  "phone",
  "filing_date",
  "taxes_owed",
  "scraped_date",
  "status",
] as const;

function present(value: unknown): boolean {
  return value !== null && value !== undefined && String(value).trim() !== "";
}

function quality(row: ScraperLeadRow): number {
  return Number(present(row.hcad_account)) * 100 +
    Number(present(row.address)) * 20 +
    Number(present(row.mailing_address)) * 10 +
    Number(present(row.property_value)) * 5 +
    Number(present(row.taxes_owed)) * 3 +
    Number(present(row.phone)) * 2 +
    Number(present(row.full_name));
}

/** Collapse rows from overlapping source categories into one safe work item per court case. */
export function dedupeScraperCases(rows: ScraperLeadRow[]): ScraperLeadRow[] {
  const groups = new Map<string, ScraperLeadRow[]>();
  for (const row of rows) {
    const caseNumber = row.case_number?.trim();
    const key = caseNumber ? `case:${caseNumber}` : `row:${row.id}`;
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }

  return [...groups.values()].map((group) => {
    const ranked = [...group].sort((a, b) => quality(b) - quality(a) ||
      String(b.scraped_date ?? "").localeCompare(String(a.scraped_date ?? "")));
    const merged: ScraperLeadRow = { ...ranked[0] };

    for (const field of MERGE_FIELDS) {
      const value = ranked.find((row) => present(row[field]))?.[field];
      if (present(value)) (merged as unknown as Record<string, unknown>)[field] = value;
    }

    for (const field of HCAD_FIELDS) {
      const accounts = new Set(group.map((row) => row.hcad_account?.trim()).filter(Boolean));
      if (field === "hcad_account" && accounts.size > 1) continue;
      const matchingRows = accounts.size === 1
        ? ranked.filter((row) => row.hcad_account?.trim() === [...accounts][0])
        : ranked;
      const value = matchingRows.find((row) => present(row[field]))?.[field];
      if (present(value)) (merged as unknown as Record<string, unknown>)[field] = value;
    }

    const accounts = new Set(group.map((row) => row.hcad_account?.trim()).filter(Boolean));
    const hcadConflict = accounts.size > 1;
    if (hcadConflict) {
      merged.hcad_account = null;
      merged.address = null;
      merged.mailing_address = null;
      merged.property_value = null;
    }
    if (group.some((row) => row.crm_status === "imported")) merged.crm_status = "imported";
    merged.source_labels = [...new Set(group.map((row) => row.source).filter(present) as string[])].sort();
    merged.hcad_conflict = hcadConflict;
    return merged;
  });
}

export function hasHcadMatch(row: ScraperLeadRow): boolean {
  return !row.hcad_conflict && Boolean(row.hcad_account?.trim());
}
