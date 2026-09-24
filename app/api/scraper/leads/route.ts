import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";

import { withErrorHandling } from "@/lib/api";
import { logError, userFacingError } from "@/lib/errors";
import { getRouteUser } from "@/lib/route-user";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getFilingDateRange, type FilingWindow } from "@/lib/foreclosure-dates";
import {
  SCRAPER_SORT_KEYS,
  SCRAPER_SOURCES,
  SCRAPER_TABS,
  isScraperTabKey,
  type ScraperLeadRow,
  type ScraperLeadsResponse,
  type ScraperSortKey,
  type ScraperStatsResponse,
  type ScraperTabKey,
} from "@/types/scraper";

/**
 * GET /api/scraper/leads
 *
 *   ?tab=all|tax_suit|probate|lgbs|thirty_day|foreclosure   (default all)
 *   &page=1 &limit=25 (max 100) &search=text &sort=owner|address|phone|category|date|status &dir=asc|desc
 *   &filed=today|3|7|30  -> only documents filed in the selected Houston-calendar window
 *   &hcad=matched|needs_research -> filter by the conservative HCAD match result
 *   ?stats=1   -> per-tab lead counts instead of rows
 *
 * The scraper writes every lead to public.foreclosure_leads and tags it in `source`.
 * That table is shared, not per-user, so the caller must be signed in but rows are not
 * filtered by user_id.
 */

const TABLE = "foreclosure_leads";
const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 25;

// Only columns that exist in the live table (verified against PostgREST).
const COLUMNS = [
  "id",
  "case_number",
  "hcad_account",
  "first_name",
  "last_name",
  "full_name",
  "address",
  "mailing_address",
  "phone",
  "filing_date",
  "property_value",
  "taxes_owed",
  "scraped_date",
  "source",
  "status",
  "crm_status",
].join(", ");

const SORT_COLUMNS: Record<ScraperSortKey, string> = {
  owner: "full_name",
  address: "address",
  phone: "phone",
  category: "source",
  date: "filing_date",
  status: "status",
};

const KNOWN_SOURCES = Object.values(SCRAPER_SOURCES);

/** Anything the scraper tags with an unrecognised source (or none) is a foreclosure lead. */
const FORECLOSURE_CLAUSE = `source.is.null,source.not.in.(${KNOWN_SOURCES.join(",")})`;

// Table isn't described by types/database.ts in scraper terms, so query it untyped.
type Db = SupabaseClient;

const MAX_SEARCH_TOKENS = 4;

/** Strips characters that would break PostgREST's `or=(...)` filter grammar. */
function sanitizeSearch(raw: string) {
  return raw.replace(/[%*,()"\\]/g, " ").replace(/\s+/g, " ").trim().slice(0, 100);
}

/**
 * Each word must match at least one searchable column, so "garcia main" finds a Garcia on
 * Main St even though no single column contains the whole phrase.
 */
function searchClauses(search: string) {
  return search
    .split(" ")
    .filter(Boolean)
    .slice(0, MAX_SEARCH_TOKENS)
    .map((term) =>
      ["full_name", "address", "first_name", "last_name", "case_number", "hcad_account"]
        .map((column) => `${column}.ilike.*${term}*`)
        .join(",")
    );
}

// Loose builder type: supabase-js builders are generic over the row shape, which is
// irrelevant here because rows are validated by shape on the way out.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Builder = any;

function applyFilters(query: Builder, tab: ScraperTabKey, search: string, hcadFilter?: string | null): Builder {
  if (tab !== "all" && tab !== "foreclosure") {
    query = query.eq("source", SCRAPER_SOURCES[tab]);
  }

  const orClauses: string[] = [];
  if (tab === "foreclosure") orClauses.push(FORECLOSURE_CLAUSE);
  if (search) orClauses.push(...searchClauses(search));
  if (hcadFilter === "needs_research") orClauses.push('hcad_account.is.null,hcad_account.eq.""');

  if (orClauses.length === 1) {
    query = query.or(orClauses[0]);
  } else if (orClauses.length > 1) {
    // Several OR groups must be ANDed; PostgREST expresses that with a nested `and=(or(..),or(..))`.
    query.url.searchParams.append("and", `(${orClauses.map((clause) => `or(${clause})`).join(",")})`);
  }

  return query;
}

async function countForTab(db: Db, tab: ScraperTabKey) {
  const query = applyFilters(db.from(TABLE).select("id", { count: "exact", head: true }), tab, "");
  const { count, error } = await query;
  if (error) throw error;
  return count ?? 0;
}

async function countPopulated(db: Db, column: "address" | "hcad_account" | "phone" | "property_value") {
  let query = db
    .from(TABLE)
    .select("id", { count: "exact", head: true })
    .not(column, "is", null);
  if (column !== "property_value") query = query.neq(column, "");
  const { count, error } = await query;
  if (error) throw error;
  return count ?? 0;
}

async function countWithFilingDate(db: Db) {
  const { count, error } = await db
    .from(TABLE)
    .select("id", { count: "exact", head: true })
    .not("filing_date", "is", null);
  if (error) throw error;
  return count ?? 0;
}

async function countRecentFilings(db: Db, days: number) {
  const { start, endExclusive } = getFilingDateRange(String(days) as FilingWindow);
  const { count, error } = await db
    .from(TABLE)
    .select("id", { count: "exact", head: true })
    .gte("filing_date", start)
    .lt("filing_date", endExclusive);
  if (error) throw error;
  return count ?? 0;
}

export const GET = withErrorHandling("api/scraper/leads", async (request: Request) => {
  const { user } = await getRouteUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const params = new URL(request.url).searchParams;
  const db: Db = getSupabaseAdmin() as unknown as Db;
  const noStore = { "Cache-Control": "no-store" };

  try {
    if (params.get("stats") === "1") {
      const [entries, withAddress, withHcad, withPhone, withValue, withFilingDate, filedLast7Days, latestRows] = await Promise.all([
        Promise.all(SCRAPER_TABS.map(async (tab) => [tab.key, await countForTab(db, tab.key)] as const)),
        countPopulated(db, "address"),
        countPopulated(db, "hcad_account"),
        countPopulated(db, "phone"),
        countPopulated(db, "property_value"),
        countWithFilingDate(db),
        countRecentFilings(db, 7),
        db.from(TABLE).select("scraped_date").not("scraped_date", "is", null).order("scraped_date", { ascending: false }).limit(1),
      ]);
      if (latestRows.error) throw latestRows.error;
      const body: ScraperStatsResponse = {
        counts: Object.fromEntries(entries) as ScraperStatsResponse["counts"],
        quality: {
          withAddress,
          withHcad,
          withPhone,
          withValue,
          withFilingDate,
          filedLast7Days,
          latestScrape: latestRows.data?.[0]?.scraped_date ?? null,
        },
      };
      return NextResponse.json(body, { headers: noStore });
    }

    const tabParam = params.get("tab");
    const tab: ScraperTabKey = isScraperTabKey(tabParam) ? tabParam : "all";
    const page = Math.max(1, Number.parseInt(params.get("page") ?? "1", 10) || 1);
    const limit = Math.min(MAX_LIMIT, Math.max(1, Number.parseInt(params.get("limit") ?? "", 10) || DEFAULT_LIMIT));
    const search = sanitizeSearch(params.get("search") ?? "");
    const sortParam = params.get("sort") as ScraperSortKey | null;
    const sort: ScraperSortKey = sortParam && SCRAPER_SORT_KEYS.includes(sortParam) ? sortParam : "date";
    const ascending = params.get("dir") === "asc";
    const filedParam = params.get("filed");
    const filedWindow: FilingWindow | null =
      filedParam === "today" || filedParam === "3" || filedParam === "7" || filedParam === "30"
        ? filedParam
        : null;
    const hcadFilter = params.get("hcad");

    const from = (page - 1) * limit;

    let query = applyFilters(db.from(TABLE).select(COLUMNS, { count: "exact" }), tab, search, hcadFilter);
    if (filedWindow) {
      const { start, endExclusive } = getFilingDateRange(filedWindow);
      query = query.gte("filing_date", start).lt("filing_date", endExclusive);
    }
    if (hcadFilter === "matched") {
      query = query.not("hcad_account", "is", null).neq("hcad_account", "");
    }
    query = query.order(SORT_COLUMNS[sort], { ascending, nullsFirst: false });
    if (sort === "date") query = query.order("scraped_date", { ascending: false, nullsFirst: false });
    query = query.order("id", { ascending: true }).range(from, from + limit - 1);

    const { data, count, error } = await query;
    if (error) throw error;

    const body: ScraperLeadsResponse = {
      rows: (data ?? []) as ScraperLeadRow[],
      total: count ?? 0,
      page,
      limit,
    };
    return NextResponse.json(body, { headers: noStore });
  } catch (error) {
    logError("api/scraper/leads", error, { query: Object.fromEntries(params) });
    return NextResponse.json(
      { error: userFacingError(error, "Couldn't load scraper leads. Please try again.") },
      { status: 500 }
    );
  }
});
