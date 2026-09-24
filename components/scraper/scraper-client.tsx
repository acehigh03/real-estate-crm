"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { format } from "date-fns";
import { ArrowDown, ArrowUp, ArrowUpDown, CalendarClock, Check, ChevronLeft, ChevronRight, Database, House, Phone, RefreshCw, Search, ShieldCheck, UserPlus } from "lucide-react";

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
import "@/styles/scraper-workspace.css";

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

function filingAge(value: string | null) {
  if (!value) return null;
  const filed = new Date(`${value.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(filed.getTime())) return null;
  const now = new Date();
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const days = Math.max(0, Math.floor((today - filed.getTime()) / 86_400_000));
  if (days === 0) return { label: "Filed today", level: "hot" };
  if (days === 1) return { label: "1 day old", level: "hot" };
  if (days <= 7) return { label: `${days} days old`, level: "fresh" };
  if (days <= 30) return { label: `${days} days old`, level: "recent" };
  return { label: `${days} days old`, level: "old" };
}

function formatStatus(value: string) {
  return value.replace(/_/g, " ").replace(/^\w/, (char) => char.toUpperCase());
}

function formatMoney(value: number | string | null) {
  if (value === null || value === "") return "—";
  const amount = typeof value === "number" ? value : Number.parseFloat(value.replace(/[^0-9.-]/g, ""));
  if (!Number.isFinite(amount)) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(amount);
}

const HEAD_CLASS = "scraper-table-head px-4 text-xs font-semibold";

export function ScraperClient() {
  const [tab, setTab] = useState<ScraperTabKey>("all");
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<ScraperSortKey>("date");
  const [dir, setDir] = useState<"asc" | "desc">("desc");
  const [filedWindow, setFiledWindow] = useState<"all" | "7" | "30">("all");

  const [rows, setRows] = useState<ScraperLeadRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [importingId, setImportingId] = useState<string | number | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const [counts, setCounts] = useState<ScraperStatsResponse["counts"] | null>(null);
  const [quality, setQuality] = useState<ScraperStatsResponse["quality"] | null>(null);
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
        setQuality(body.quality ?? null);
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
        if (filedWindow !== "all") params.set("filed", filedWindow);

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
  }, [tab, page, search, sort, dir, filedWindow, reloadToken]);

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

  const importLead = useCallback(async (row: ScraperLeadRow) => {
    setImportingId(row.id);
    setActionMessage(null);
    try {
      const response = await fetch("/api/scraper/leads/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: row.id }),
      });
      const body = await response.json().catch(() => null) as { error?: string; created?: boolean } | null;
      if (!response.ok) throw new Error(body?.error ?? "Couldn't add this lead to the CRM.");
      setRows((current) => current.map((lead) => lead.id === row.id ? { ...lead, crm_status: "imported" } : lead));
      setActionMessage(body?.created ? "Lead added to CRM." : "Lead was already in CRM.");
    } catch (err) {
      setActionMessage(err instanceof Error ? err.message : "Couldn't add this lead to the CRM.");
    } finally {
      setImportingId(null);
    }
  }, []);

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
          className="inline-flex items-center gap-1"
        >
          {label}
          <Icon size={11} style={{ opacity: active ? 1 : 0.5 }} />
        </button>
      </TableHead>
    );
  };

  return (
    <div className="scraper-workspace flex flex-1 flex-col overflow-hidden">
      <header className="scraper-header">
        <div className="scraper-title-group">
          <span className="scraper-title-icon"><Database size={18} /></span>
          <div>
            <div className="flex items-center gap-2">
              <h1>Scraper Leads</h1>
              <span className="scraper-live"><i /> Live</span>
            </div>
            <p>{counts?.all !== undefined ? `${counts.all.toLocaleString()} collected records` : "Foreclosure lead database"}</p>
          </div>
        </div>
        <div className="scraper-header-actions">
          <label className="scraper-search">
            <Search size={16} aria-hidden />
            <input
              type="search"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Search owner, address, case #..."
              aria-label="Search scraper leads"
            />
          </label>
          <button
            type="button"
            className="scraper-refresh"
            onClick={() => setReloadToken((token) => token + 1)}
            disabled={loading}
            aria-label="Refresh scraper leads"
            title="Refresh leads"
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </header>

      <nav className="scraper-tabs" role="tablist" aria-label="Lead category">
        {SCRAPER_TABS.map((entry) => {
          const isActive = entry.key === tab;
          const value = counts?.[entry.key];
          return (
            <button
              key={entry.key}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => selectTab(entry.key)}
              className={isActive ? "is-active" : ""}
            >
              <span>{entry.label}</span>
              <b>{value !== undefined ? value.toLocaleString() : statsError ? "—" : "…"}</b>
            </button>
          );
        })}
      </nav>

      <section className="scraper-quality" aria-label="Scraper data quality">
        <div>
          <span className="scraper-quality-icon scraper-quality-icon-hot"><CalendarClock size={16} /></span>
          <p><b>{quality?.filedLast7Days.toLocaleString() ?? "—"}</b><small>filed last 7 days</small></p>
        </div>
        <div>
          <span className="scraper-quality-icon"><ShieldCheck size={16} /></span>
          <p><b>{quality?.withHcad.toLocaleString() ?? "—"}</b><small>HCAD matched</small></p>
        </div>
        <div>
          <span className="scraper-quality-icon"><House size={16} /></span>
          <p><b>{quality?.withAddress.toLocaleString() ?? "—"}</b><small>with address</small></p>
        </div>
        <div>
          <span className="scraper-quality-icon"><Phone size={16} /></span>
          <p><b>{quality?.withPhone.toLocaleString() ?? "—"}</b><small>phone ready</small></p>
        </div>
        <div className="scraper-quality-sync">
          <p><b>{quality?.latestScrape ? formatDate(quality.latestScrape) : "—"}</b><small>last database sync</small></p>
        </div>
      </section>

      <div className="scraper-content">
        <div className="scraper-table-toolbar">
          <div>
            <strong>{activeTabLabel}</strong>
            <span>{total.toLocaleString()} {total === 1 ? "record" : "records"}</span>
          </div>
          <div className="scraper-filed-filter" aria-label="Filter by filing date">
            <span>Filed</span>
            {(["7", "30", "all"] as const).map((window) => (
              <button
                key={window}
                type="button"
                className={filedWindow === window ? "is-active" : ""}
                onClick={() => { setFiledWindow(window); setPage(1); }}
              >
                {window === "all" ? "All" : `${window} days`}
              </button>
            ))}
          </div>
        </div>
        {actionMessage ? <div className="scraper-action-message" role="status">{actionMessage}</div> : null}

        <div className="scraper-table-panel">
          {error ? (
            <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
              <p role="alert" className="text-sm" style={{ color: "var(--red)" }}>{error}</p>
              <Button variant="outline" size="sm" onClick={() => setReloadToken((token) => token + 1)}>
                Try again
              </Button>
            </div>
          ) : (
            <>
              <Table className="scraper-table min-w-[1080px]" aria-busy={loading}>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    {sortHead("owner", "Owner / Case")}
                    {sortHead("address", "Property")}
                    {sortHead("phone", "Phone")}
                    {sortHead("category", "Category")}
                    <TableHead className={HEAD_CLASS}>Property / Taxes</TableHead>
                    {sortHead("date", "Filed")}
                    {sortHead("status", "Status")}
                    <TableHead className={HEAD_CLASS}>CRM</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody style={{ opacity: loading && rows.length ? 0.55 : 1, transition: "opacity 0.15s" }}>
                  {loading && rows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="px-5 py-16 text-center text-sm" style={{ color: "var(--t3)" }}>
                        Loading leads…
                      </TableCell>
                    </TableRow>
                  ) : rows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="px-5 py-16 text-center text-sm" style={{ color: "var(--t3)" }}>
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
                      const age = filingAge(row.filing_date);
                      return (
                        <TableRow key={row.id} className="scraper-data-row">
                          <TableCell className="px-4 py-3">
                            <p className="text-sm font-semibold" style={{ color: "var(--t1)" }}>{ownerName(row)}</p>
                            {row.case_number ? (
                              <p className="mt-1 text-xs" style={{ color: "var(--t3)", fontFamily: "var(--font-mono)" }}>
                                {row.case_number}
                              </p>
                            ) : null}
                          </TableCell>
                          <TableCell className="max-w-[300px] px-4 py-3 text-sm" style={{ color: "var(--t2)" }}>
                            <p className="truncate font-medium">{row.address?.trim() || "Address not found"}</p>
                            {row.hcad_account ? <p className="mt-1 text-xs" style={{ color: "var(--t3)" }}>HCAD {row.hcad_account}</p> : null}
                          </TableCell>
                          <TableCell className="px-4 py-3 text-sm" style={{ color: "var(--t2)", fontFamily: "var(--font-mono)" }}>
                            {row.phone ? formatPhoneDisplay(row.phone) : "—"}
                          </TableCell>
                          <TableCell className="px-4 py-3">
                            <span className="scraper-badge" style={{ background: categoryColor.bg, color: categoryColor.color }}>
                              {CATEGORY_LABELS[category]}
                            </span>
                          </TableCell>
                          <TableCell className="px-4 py-3">
                            <p className="text-sm font-semibold" style={{ color: "var(--t1)" }}>{formatMoney(row.property_value)}</p>
                            <p className="mt-1 text-xs" style={{ color: "var(--t3)" }}>Taxes {formatMoney(row.taxes_owed)}</p>
                          </TableCell>
                          <TableCell className="px-4 py-3 text-sm" style={{ color: "var(--t2)" }}>
                            <p className="font-medium" style={{ color: "var(--t1)" }}>{formatDate(row.filing_date)}</p>
                            {age ? <span className={`scraper-file-age is-${age.level}`}>{age.label}</span> : <span className="scraper-date-missing">Filing date unavailable</span>}
                            <p className="mt-1 text-[11px]" style={{ color: "var(--t3)" }}>Added {formatDate(row.scraped_date)}</p>
                          </TableCell>
                          <TableCell className="px-4 py-3">
                            {status ? (
                              <span className="scraper-badge" style={{ background: statusColor.bg, color: statusColor.color }}>
                                {formatStatus(status)}
                              </span>
                            ) : (
                              <span className="scraper-badge" style={{ background: "var(--s3)", color: "var(--t3)" }}>New</span>
                            )}
                          </TableCell>
                          <TableCell className="px-4 py-3">
                            {row.crm_status === "imported" ? (
                              <span className="scraper-imported"><Check size={13} /> Added</span>
                            ) : (
                              <button
                                type="button"
                                className="scraper-import"
                                disabled={!row.phone || importingId === row.id}
                                title={row.phone ? "Add to CRM" : "A phone number is required"}
                                onClick={() => importLead(row)}
                              >
                                <UserPlus size={13} /> {importingId === row.id ? "Adding…" : row.phone ? "Add" : "Needs phone"}
                              </button>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>

              <footer className="scraper-pagination">
                <p>
                  {total === 0
                    ? "No results"
                    : `Showing ${firstShown.toLocaleString()}–${lastShown.toLocaleString()} of ${total.toLocaleString()}`}
                </p>
                <div className="flex items-center gap-2">
                  <span>Page {page.toLocaleString()} of {totalPages.toLocaleString()}</span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1 || loading}
                    onClick={() => setPage((current) => Math.max(1, current - 1))}
                    aria-label="Previous page"
                  >
                    <ChevronLeft size={14} /> Prev
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= totalPages || loading}
                    onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                    aria-label="Next page"
                  >
                    Next <ChevronRight size={14} />
                  </Button>
                </div>
              </footer>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
