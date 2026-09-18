"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { format } from "date-fns";
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, Search } from "lucide-react";

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
import {
  SCRAPER_TABS,
  categoryForSource,
  type ScraperLeadRow,
  type ScraperLeadsResponse,
  type ScraperSortKey,
  type ScraperStatsResponse,
  type ScraperTabKey,
} from "@/types/scraper";

const PAGE_SIZE = 25;
const SEARCH_DEBOUNCE_MS = 350;

const CATEGORY_LABELS: Record<Exclude<ScraperTabKey, "all">, string> = {
  tax_suit: "Tax Suit",
  probate: "Probate",
  lgbs: "LGBS",
  thirty_day: "30-Day",
  foreclosure: "Foreclosure",
};

const CATEGORY_COLORS: Record<Exclude<ScraperTabKey, "all">, { bg: string; color: string }> = {
  tax_suit: { bg: "var(--blud)", color: "var(--blu)" },
  probate: { bg: "var(--purd)", color: "var(--pur)" },
  lgbs: { bg: "var(--ambd)", color: "var(--amb)" },
  thirty_day: { bg: "var(--gd)", color: "var(--g)" },
  foreclosure: { bg: "var(--redd)", color: "var(--red)" },
};

function statusColors(status: string) {
  const value = status.toLowerCase();
  if (value === "interested" || value === "qualified") return { bg: "var(--gd)", color: "var(--g)" };
  if (value === "contacted") return { bg: "var(--blud)", color: "var(--blu)" };
  if (value === "follow up" || value === "reviewing") return { bg: "var(--ambd)", color: "var(--amb)" };
  if (value === "do_not_contact" || value === "not interested") return { bg: "var(--redd)", color: "var(--red)" };
  return { bg: "var(--s3)", color: "var(--t2)" };
}

function ownerName(row: ScraperLeadRow) {
  return row.full_name?.trim() || `${row.first_name ?? ""} ${row.last_name ?? ""}`.trim() || "Unknown owner";
}

function formatDate(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : format(date, "MMM d, yyyy");
}

function formatStatus(value: string) {
  return value.replace(/_/g, " ").replace(/^\w/, (char) => char.toUpperCase());
}

const HEAD_CLASS = "px-5 py-3 text-[11px] font-medium uppercase tracking-wide";

export function ScraperClient() {
  const [tab, setTab] = useState<ScraperTabKey>("all");
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<ScraperSortKey>("date");
  const [dir, setDir] = useState<"asc" | "desc">("desc");

  const [rows, setRows] = useState<ScraperLeadRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const [counts, setCounts] = useState<ScraperStatsResponse["counts"] | null>(null);
  const [statsError, setStatsError] = useState(false);

  // Debounce typing so we don't query on every keystroke; any new search restarts at page 1.
  const appliedSearch = useRef("");
  useEffect(() => {
    const timer = setTimeout(() => {
      const next = searchInput.trim();
      if (next === appliedSearch.current) return;
      appliedSearch.current = next;
      setSearch(next);
      setPage(1);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Per-category totals for the stats bar.
  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      try {
        const res = await fetch("/api/scraper/leads?stats=1", { signal: controller.signal });
        const body = (await res.json().catch(() => null)) as ScraperStatsResponse | null;
        if (!res.ok || !body?.counts) throw new Error(`stats request failed (${res.status})`);
        setCounts(body.counts);
      } catch (err) {
        if (controller.signal.aborted) return;
        console.error("[scraper] stats failed:", err);
        setStatsError(true);
      }
    })();
    return () => controller.abort();
  }, [reloadToken]);

  // One page of rows. The AbortController drops responses from superseded requests.
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const params = new URLSearchParams({
          tab,
          page: String(page),
          limit: String(PAGE_SIZE),
          sort,
          dir,
        });
        if (search) params.set("search", search);

        const res = await fetch(`/api/scraper/leads?${params}`, { signal: controller.signal });
        const body = (await res.json().catch(() => null)) as (ScraperLeadsResponse & { error?: string }) | null;

        if (!res.ok || !body || !Array.isArray(body.rows)) {
          throw new Error(body?.error ?? "Couldn't load scraper leads. Please try again.");
        }
        setRows(body.rows);
        setTotal(body.total);
      } catch (err) {
        if (controller.signal.aborted) return;
        console.error("[scraper] load failed:", err);
        setRows([]);
        setTotal(0);
        setError(err instanceof Error ? err.message : "Couldn't load scraper leads.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();

    return () => controller.abort();
  }, [tab, page, search, sort, dir, reloadToken]);

  const selectTab = useCallback((next: ScraperTabKey) => {
    setTab(next);
    setPage(1);
  }, []);

  const toggleSort = useCallback(
    (key: ScraperSortKey) => {
      if (key === sort) {
        setDir((current) => (current === "asc" ? "desc" : "asc"));
      } else {
        setSort(key);
        setDir(key === "date" ? "desc" : "asc");
      }
      setPage(1);
    },
    [sort]
  );

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const firstShown = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const lastShown = Math.min(page * PAGE_SIZE, total);
  const activeTabLabel = SCRAPER_TABS.find((entry) => entry.key === tab)?.label ?? "All Leads";

  const sortHead = (key: ScraperSortKey, label: string) => {
    const active = sort === key;
    const Icon = !active ? ArrowUpDown : dir === "asc" ? ArrowUp : ArrowDown;
    return (
      <TableHead
        className={HEAD_CLASS}
        style={{ color: active ? "var(--t1)" : "var(--t2)" }}
        aria-sort={active ? (dir === "asc" ? "ascending" : "descending") : "none"}
      >
        <button
          type="button"
          onClick={() => toggleSort(key)}
          className="inline-flex items-center gap-1 uppercase tracking-wide"
        >
          {label}
          <Icon size={11} style={{ opacity: active ? 1 : 0.5 }} />
        </button>
      </TableHead>
    );
  };

  return (
    <div className="crm-page flex flex-1 flex-col overflow-hidden">
      <div className="crm-page-header flex shrink-0 flex-wrap items-center justify-between gap-4 px-6 py-4">
        <div>
          <h1 className="crm-header-title">Scraper Leads</h1>
          <p className="crm-header-copy">
            Every lead collected by the foreclosure scrapers, by category. Read-only.
          </p>
        </div>
        <div className="relative">
          <Search
            size={14}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2"
            style={{ color: "var(--t3)" }}
          />
          <input
            type="search"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="Search name, address, case #…"
            aria-label="Search scraper leads"
            className="crm-input h-9 w-72 pl-9 pr-3"
          />
        </div>
      </div>

      <div className="flex-1 space-y-4 overflow-auto px-6 py-4">
        {/* Stats bar — one card per category; click to jump to that tab */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          {SCRAPER_TABS.map((entry) => {
            const isActive = entry.key === tab;
            const value = counts?.[entry.key];
            return (
              <button
                key={entry.key}
                type="button"
                onClick={() => selectTab(entry.key)}
                className="crm-panel px-4 py-3 text-left transition"
                style={isActive ? { borderColor: "var(--g)" } : undefined}
              >
                <p className="crm-section-kicker">{entry.label}</p>
                <p
                  className="mt-1 text-[22px] font-semibold"
                  style={{ color: "var(--t1)", fontFamily: "var(--font-mono)" }}
                >
                  {value !== undefined ? value.toLocaleString() : statsError ? "—" : "…"}
                </p>
              </button>
            );
          })}
        </div>

        {/* Category tabs */}
        <div role="tablist" aria-label="Lead category" className="flex flex-wrap gap-1.5">
          {SCRAPER_TABS.map((entry) => {
            const isActive = entry.key === tab;
            return (
              <button
                key={entry.key}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => selectTab(entry.key)}
                className="rounded-md px-3 py-1.5 text-[13px] font-medium transition"
                style={{
                  background: isActive ? "var(--t1)" : "var(--s1)",
                  color: isActive ? "var(--bg)" : "var(--t2)",
                  border: "1px solid var(--b2)",
                }}
              >
                {entry.label}
              </button>
            );
          })}
        </div>

        <div className="crm-panel overflow-hidden p-0">
          {error ? (
            <div className="flex flex-col items-center gap-3 px-6 py-14 text-center">
              <p role="alert" className="text-[13px]" style={{ color: "var(--red)" }}>
                {error}
              </p>
              <Button variant="outline" size="sm" onClick={() => setReloadToken((token) => token + 1)}>
                Try again
              </Button>
            </div>
          ) : (
            <>
              <Table className="min-w-[960px]" aria-busy={loading}>
                <TableHeader style={{ background: "var(--s2)" }}>
                  <TableRow className="hover:bg-transparent" style={{ borderColor: "var(--b1)" }}>
                    {sortHead("owner", "Owner")}
                    {sortHead("address", "Property address")}
                    {sortHead("phone", "Phone")}
                    {sortHead("category", "Category")}
                    {sortHead("date", "Date added")}
                    {sortHead("status", "Status")}
                  </TableRow>
                </TableHeader>
                <TableBody style={{ opacity: loading && rows.length ? 0.55 : 1, transition: "opacity 0.15s" }}>
                  {loading && rows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="px-5 py-14 text-center text-[13px]" style={{ color: "var(--t3)" }}>
                        Loading leads…
                      </TableCell>
                    </TableRow>
                  ) : rows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="px-5 py-14 text-center text-[13px]" style={{ color: "var(--t3)" }}>
                        {search
                          ? `No ${tab === "all" ? "leads" : `${activeTabLabel} leads`} matching “${search}”.`
                          : `No leads in ${activeTabLabel} yet.`}
                      </TableCell>
                    </TableRow>
                  ) : (
                    rows.map((row) => {
                      const category = categoryForSource(row.source);
                      const categoryColor = CATEGORY_COLORS[category];
                      const status = row.status?.trim() || row.crm_status?.trim() || "";
                      const statusColor = statusColors(status);
                      return (
                        <TableRow
                          key={row.id}
                          className="transition hover:bg-[var(--s2)]"
                          style={{ borderColor: "var(--b1)" }}
                        >
                          <TableCell className="px-5 py-3">
                            <p className="text-sm font-semibold" style={{ color: "var(--t1)" }}>
                              {ownerName(row)}
                            </p>
                            {row.case_number ? (
                              <p className="mt-0.5 text-[11px]" style={{ color: "var(--t3)", fontFamily: "var(--font-mono)" }}>
                                {row.case_number}
                              </p>
                            ) : null}
                          </TableCell>
                          <TableCell className="max-w-[280px] truncate px-5 py-3 text-sm" style={{ color: "var(--t2)" }}>
                            {row.address?.trim() || "Address not found"}
                          </TableCell>
                          <TableCell
                            className="px-5 py-3 text-sm"
                            style={{ color: "var(--t2)", fontFamily: "var(--font-mono)" }}
                          >
                            {row.phone ? formatPhoneDisplay(row.phone) : "—"}
                          </TableCell>
                          <TableCell className="px-5 py-3">
                            <span
                              className="crm-badge-neutral"
                              style={{ background: categoryColor.bg, color: categoryColor.color }}
                            >
                              {CATEGORY_LABELS[category]}
                            </span>
                          </TableCell>
                          <TableCell className="px-5 py-3 text-sm" style={{ color: "var(--t2)" }}>
                            {formatDate(row.scraped_date)}
                          </TableCell>
                          <TableCell className="px-5 py-3">
                            {status ? (
                              <span
                                className="crm-badge-neutral"
                                style={{ background: statusColor.bg, color: statusColor.color }}
                              >
                                {formatStatus(status)}
                              </span>
                            ) : (
                              <span className="text-sm" style={{ color: "var(--t3)" }}>
                                —
                              </span>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>

              <div
                className="flex flex-wrap items-center justify-between gap-3 px-5 py-3"
                style={{ borderTop: "1px solid var(--b1)" }}
              >
                <p className="text-[12px]" style={{ color: "var(--t2)" }}>
                  {total === 0
                    ? "No results"
                    : `Showing ${firstShown.toLocaleString()}–${lastShown.toLocaleString()} of ${total.toLocaleString()}`}
                </p>
                <div className="flex items-center gap-2">
                  <span className="text-[12px]" style={{ color: "var(--t3)" }}>
                    Page {page.toLocaleString()} of {totalPages.toLocaleString()}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1 || loading}
                    onClick={() => setPage((current) => Math.max(1, current - 1))}
                    aria-label="Previous page"
                  >
                    <ChevronLeft size={14} />
                    Prev
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= totalPages || loading}
                    onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                    aria-label="Next page"
                  >
                    Next
                    <ChevronRight size={14} />
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
