import { describe, expect, it } from "vitest";

import { dedupeScraperCases, hasHcadMatch } from "../../lib/scraper-case-dedupe";
import type { ScraperLeadRow } from "../../types/scraper";

function row(overrides: Partial<ScraperLeadRow>): ScraperLeadRow {
  return {
    id: 1,
    case_number: "202670212",
    hcad_account: null,
    first_name: null,
    last_name: null,
    full_name: "Flores, Frida",
    address: null,
    mailing_address: null,
    phone: null,
    filing_date: "2026-09-22",
    property_value: null,
    taxes_owed: null,
    scraped_date: "2026-09-24T17:00:00Z",
    source: "harris_taxsuit",
    status: null,
    crm_status: null,
    ...overrides,
  };
}

describe("scraper queue case dedupe", () => {
  it("collapses same case across sources and keeps the unique verified HCAD enrichment", () => {
    const cases = dedupeScraperCases([
      row({ id: 1, source: "harris_taxsuit" }),
      row({
        id: 2,
        source: "harris_foreclosure",
        hcad_account: "1452060010057",
        address: "3923 DELEDDA DR",
        mailing_address: "PO BOX 1",
        property_value: 265275,
      }),
    ]);

    expect(cases).toHaveLength(1);
    expect(cases[0].hcad_account).toBe("1452060010057");
    expect(cases[0].address).toBe("3923 DELEDDA DR");
    expect(cases[0].source_labels).toEqual(["harris_foreclosure", "harris_taxsuit"]);
    expect(hasHcadMatch(cases[0])).toBe(true);
  });

  it("sends conflicting HCAD accounts to research instead of choosing one", () => {
    const [merged] = dedupeScraperCases([
      row({ id: 1, hcad_account: "111", address: "First property" }),
      row({ id: 2, hcad_account: "222", address: "Second property" }),
    ]);

    expect(merged.hcad_conflict).toBe(true);
    expect(merged.hcad_account).toBeNull();
    expect(merged.address).toBeNull();
    expect(hasHcadMatch(merged)).toBe(false);
  });
});
