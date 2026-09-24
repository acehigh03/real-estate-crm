/**
 * Types for the Scraper dashboard (/scraper).
 *
 * All scraper leads live in ONE table, public.foreclosure_leads, and the scraper that
 * produced a row is recorded in its `source` column (see ForeclosureScraper/supabase_push.py
 * and migrate_all_sheets.py). Only columns that exist in the live table are listed here.
 */

export type ScraperTabKey = "all" | "tax_suit" | "probate" | "lgbs" | "thirty_day" | "foreclosure";

/** `source` values written by the scraper, one per dedicated tab. */
export const SCRAPER_SOURCES = {
  tax_suit: "harris_taxsuit",
  probate: "harris_probate",
  lgbs: "harris_lgbs",
  thirty_day: "harris_30day",
} as const;

export interface ScraperTab {
  key: ScraperTabKey;
  label: string;
}

export const SCRAPER_TABS: ScraperTab[] = [
  { key: "all", label: "All Leads" },
  { key: "tax_suit", label: "Tax Suit" },
  { key: "probate", label: "Probate" },
  { key: "lgbs", label: "LGBS" },
  { key: "thirty_day", label: "30-Day" },
  { key: "foreclosure", label: "Foreclosure" },
];

export function isScraperTabKey(value: string | null | undefined): value is ScraperTabKey {
  return SCRAPER_TABS.some((tab) => tab.key === value);
}

/** Category shown in the table for a row's `source` (anything unrecognised is a foreclosure lead). */
export function categoryForSource(source: string | null | undefined): Exclude<ScraperTabKey, "all"> {
  switch (source) {
    case SCRAPER_SOURCES.tax_suit:
      return "tax_suit";
    case SCRAPER_SOURCES.probate:
      return "probate";
    case SCRAPER_SOURCES.lgbs:
      return "lgbs";
    case SCRAPER_SOURCES.thirty_day:
      return "thirty_day";
    default:
      return "foreclosure";
  }
}

export const SCRAPER_SORT_KEYS = ["owner", "address", "phone", "category", "date", "status"] as const;
export type ScraperSortKey = (typeof SCRAPER_SORT_KEYS)[number];

/** A row of public.foreclosure_leads, restricted to the columns the dashboard reads. */
export interface ScraperLeadRow {
  id: number | string;
  case_number: string | null;
  hcad_account: string | null;
  first_name: string | null;
  last_name: string | null;
  full_name: string | null;
  address: string | null;
  mailing_address: string | null;
  phone: string | null;
  filing_date: string | null;
  property_value: number | string | null;
  taxes_owed: number | string | null;
  scraped_date: string | null;
  source: string | null;
  status: string | null;
  crm_status: string | null;
}

export interface ScraperLeadsResponse {
  rows: ScraperLeadRow[];
  total: number;
  page: number;
  limit: number;
}

export interface ScraperQualityStats {
  withAddress: number;
  withHcad: number;
  withPhone: number;
  withValue: number;
  withFilingDate: number;
  filedLast7Days: number;
  latestScrape: string | null;
}

export type ScraperStatsResponse = {
  counts: Record<ScraperTabKey, number>;
  quality: ScraperQualityStats;
};
