"use client";

import Link from "next/link";
import { useState, useMemo, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { format } from "date-fns";
import { ArrowRight, Upload } from "lucide-react";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getClassificationLabel } from "@/lib/ai/classify-lead";
import type { Database, LeadClassification, LeadStatus, CampaignType } from "@/types/database";

type Lead = Database["public"]["Tables"]["leads"]["Row"];
type Note = Database["public"]["Tables"]["notes"]["Row"];
type Followup = Database["public"]["Tables"]["followups"]["Row"];
type CampaignSummary = { id: string; name: string; campaign_type: CampaignType | null };

const STATUS_OPTIONS: Array<"all" | LeadStatus> = [
  "all",
  "New",
  "Contacted",
  "Replied",
  "Hot",
  "Dead",
  "DNC",
];

const CAMPAIGN_TYPE_OPTIONS: Array<{ value: CampaignType; label: string }> = [
  { value: "cash_offer", label: "Cash Offer" },
  { value: "foreclosure_help", label: "Foreclosure Help" },
  { value: "probate", label: "Probate" },
  { value: "tax_sale", label: "Tax Sale" },
];

function statusTag(status: LeadStatus) {
  const classes =
    status === "Hot"
      ? "bg-[#eaf9f5] text-[#00c08b]"
      : status === "Contacted"
        ? "bg-[#eff6ff] text-[#1d4ed8]"
        : status === "Replied"
          ? "bg-[#fef3c7] text-[#92400e]"
          : status === "Dead" || status === "DNC"
            ? "bg-[#f3f4f6] text-[#6b7280]"
            : "bg-[#f3f4f6] text-[#6b7280]";
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${classes}`}>
      {status}
    </span>
  );
}

function classTag(classification: LeadClassification) {
  const label = getClassificationLabel(classification);
  const classes =
    classification === "HOT"
      ? "bg-[#eaf9f5] text-[#00c08b]"
      : classification === "WARM"
        ? "bg-[#fef3c7] text-[#92400e]"
        : classification === "COLD"
          ? "bg-[#ede9fe] text-[#5b21b6]"
          : "bg-[#f3f4f6] text-[#6b7280]";

  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${classes}`}>
      {label}
    </span>
  );
}

function scoreFromClassification(classification: LeadClassification): number {
  switch (classification) {
    case "HOT": return 92;
    case "WARM": return 71;
    case "COLD": return 38;
    case "DEAD": return 5;
    case "OPT_OUT": return 0;
    case "UNKNOWN": return 25;
  }
}

function ScoreCell({ classification }: { classification: LeadClassification }) {
  return (
    <span className="font-mono text-sm font-medium text-slate-700">
      {scoreFromClassification(classification)}
    </span>
  );
}

interface LeadsClientProps {
  leads: Lead[];
  notes: Note[];
  followups: Followup[];
  campaigns: CampaignSummary[];
}

interface ImportResult {
  imported: number;
  messaged: number;
  queued: number;
  skipped: number;
  campaignName?: string;
}

export function LeadsClient({ leads, notes, followups, campaigns }: LeadsClientProps) {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | LeadStatus>("all");
  const [campaignFilter, setCampaignFilter] = useState<string>("all");
  const [csvDialogOpen, setCsvDialogOpen] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  // Import modal state
  const [campaignName, setCampaignName] = useState("");
  const [campaignType, setCampaignType] = useState<CampaignType>("cash_offer");

  // Sync campaign filter from URL (?campaign=<id>)
  useEffect(() => {
    const urlCampaign = searchParams.get("campaign");
    if (urlCampaign) setCampaignFilter(urlCampaign);
  }, [searchParams]);

  const filtered = useMemo(() => {
    return leads.filter((l) => {
      const matchSearch =
        search === "" ||
        `${l.first_name} ${l.last_name} ${l.property_address} ${l.phone}`
          .toLowerCase()
          .includes(search.toLowerCase());
      const matchStatus = statusFilter === "all" || l.status === statusFilter;
      const matchCampaign = campaignFilter === "all" || l.campaign_id === campaignFilter;
      return matchSearch && matchStatus && matchCampaign;
    });
  }, [leads, search, statusFilter, campaignFilter]);

  function closeDialog() {
    setCsvDialogOpen(false);
    setImportResult(null);
    setImportError(null);
    setCampaignName("");
    setCampaignType("cash_offer");
  }

  return (
    <div className="crm-page flex flex-1 flex-col overflow-hidden">
      <div className="crm-page-header flex shrink-0 items-center justify-between gap-4 px-6 py-4">
        <div>
          <h1 className="crm-header-title">Leads</h1>
        </div>
        <div className="flex items-center gap-2">
          <Input
            placeholder="Search leads…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="crm-input h-9 w-56 px-3"
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as "all" | LeadStatus)}
            className="crm-input h-9 px-3"
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s === "all" ? "All statuses" : s}
              </option>
            ))}
          </select>
          {campaigns.length > 0 && (
            <select
              value={campaignFilter}
              onChange={(e) => {
                const val = e.target.value;
                setCampaignFilter(val);
                // Sync URL without full navigation
                const params = new URLSearchParams(searchParams.toString());
                if (val === "all") params.delete("campaign");
                else params.set("campaign", val);
                router.replace(`/leads${params.size ? `?${params.toString()}` : ""}`, { scroll: false });
              }}
              className="crm-input h-9 px-3"
            >
              <option value="all">All campaigns</option>
              {campaigns.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          )}
          <Button
            size="sm"
            className="h-9 gap-1.5 rounded-[6px] border-none bg-[#00c08b] px-4 text-white hover:opacity-90"
            onClick={() => setCsvDialogOpen(true)}
          >
            <Upload size={13} />
            Import CSV
          </Button>
        </div>
      </div>

      {csvDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="crm-panel relative w-full max-w-md p-6">
            <button
              onClick={closeDialog}
              className="absolute right-4 top-4 text-[#6b7c93] hover:text-[#1a1f36]"
            >
              ✕
            </button>

            {importResult ? (
              /* Summary view */
              <div>
                <h2 className="text-[15px] font-semibold text-[#1a1f36]">Import complete</h2>
                {importResult.campaignName && (
                  <p className="mt-0.5 text-[12px] text-[#6b7c93]">Campaign: {importResult.campaignName}</p>
                )}
                <div className="mt-4 grid grid-cols-4 gap-2">
                  {[
                    { label: "Imported", value: importResult.imported, color: "text-[#1a1f36]" },
                    { label: "Messaged", value: importResult.messaged, color: "text-[#00c08b]" },
                    { label: "Queued", value: importResult.queued, color: "text-[#1d4ed8]" },
                    { label: "Skipped", value: importResult.skipped, color: "text-[#6b7c93]" },
                  ].map((s) => (
                    <div key={s.label} className="rounded-lg border border-[#e8edf2] px-3 py-3 text-center">
                      <p className={`text-[22px] font-semibold ${s.color}`}>{s.value}</p>
                      <p className="mt-0.5 text-[10px] uppercase tracking-wide text-[#6b7c93]">{s.label}</p>
                    </div>
                  ))}
                </div>
                <p className="mt-3 text-[12px] text-[#6b7c93]">
                  {importResult.messaged > 0
                    ? `First SMS sent to ${importResult.messaged} new lead${importResult.messaged !== 1 ? "s" : ""}.`
                    : importResult.queued > 0
                      ? `${importResult.queued} SMS queued for next send window.`
                      : importResult.imported > 0
                        ? "Leads imported. Telnyx not configured — no SMS sent."
                        : "No new leads were found in the CSV."}
                  {importResult.skipped > 0 ? ` ${importResult.skipped} already existed.` : ""}
                </p>
                <Button
                  className="mt-4 w-full bg-[#00c08b] text-white hover:opacity-90"
                  onClick={closeDialog}
                >
                  Done
                </Button>
              </div>
            ) : (
              /* Upload view */
              <div>
                <h2 className="mb-1 text-[15px] font-semibold text-[#1a1f36]">Import CSV</h2>
                <p className="mb-4 text-[12px] text-[#6b7c93]">
                  New leads will be imported and sent a first SMS automatically.
                </p>
                {importError && (
                  <p className="mb-3 rounded-md bg-[#fef2f2] px-3 py-2 text-[12px] text-[#e5484d]">
                    {importError}
                  </p>
                )}
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const form = e.currentTarget;
                    const fileInput = form.elements.namedItem("file") as HTMLInputElement;
                    if (!fileInput.files?.[0]) return;
                    if (!campaignName.trim()) {
                      setImportError("Campaign name is required.");
                      return;
                    }

                    setIsImporting(true);
                    setImportError(null);

                    try {
                      // 1. Create campaign
                      const campaignRes = await fetch("/api/campaigns", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ name: campaignName.trim(), campaign_type: campaignType }),
                      });
                      const campaignJson = await campaignRes.json() as { error?: string; campaign?: { id: string } };
                      if (!campaignRes.ok) {
                        setImportError(campaignJson.error ?? "Failed to create campaign.");
                        return;
                      }
                      const campaignId = campaignJson.campaign?.id ?? "";

                      // 2. Upload CSV with campaign context
                      const fd = new FormData();
                      fd.append("file", fileInput.files[0]);
                      fd.append("campaign_id", campaignId);
                      fd.append("campaign_type", campaignType);

                      const res = await fetch("/api/upload-csv", { method: "POST", body: fd });
                      const json = await res.json() as {
                        error?: string;
                        imported?: number;
                        messaged?: number;
                        queued?: number;
                        skipped?: number;
                      };
                      if (!res.ok) {
                        setImportError(json.error ?? "Import failed.");
                      } else {
                        setImportResult({
                          imported: json.imported ?? 0,
                          messaged: json.messaged ?? 0,
                          queued: json.queued ?? 0,
                          skipped: json.skipped ?? 0,
                          campaignName: campaignName.trim(),
                        });
                      }
                    } catch {
                      setImportError("Network error. Please try again.");
                    } finally {
                      setIsImporting(false);
                    }
                  }}
                >
                  <div className="mb-3">
                    <label className="mb-1.5 block text-[12px] font-medium text-[#6b7c93] uppercase tracking-wide">
                      Campaign Name <span className="text-[#e5484d]">*</span>
                    </label>
                    <Input
                      type="text"
                      value={campaignName}
                      onChange={(e) => setCampaignName(e.target.value)}
                      placeholder="e.g. April Tax Sale — Dallas"
                      required
                      className="crm-input h-9 w-full px-3"
                    />
                  </div>
                  <div className="mb-4">
                    <label className="mb-1.5 block text-[12px] font-medium text-[#6b7c93] uppercase tracking-wide">
                      Campaign Type
                    </label>
                    <select
                      value={campaignType}
                      onChange={(e) => setCampaignType(e.target.value as CampaignType)}
                      className="crm-input h-9 w-full px-3"
                    >
                      {CAMPAIGN_TYPE_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="mb-4">
                    <label className="mb-1.5 block text-[12px] font-medium text-[#6b7c93] uppercase tracking-wide">
                      CSV File
                    </label>
                    <input
                      type="file"
                      name="file"
                      accept=".csv"
                      required
                      className="block w-full text-[13px] text-[#1a1f36]"
                    />
                  </div>
                  <Button
                    type="submit"
                    disabled={isImporting}
                    className="w-full bg-[#00c08b] text-white hover:opacity-90 disabled:opacity-60"
                  >
                    {isImporting ? "Importing…" : "Upload & Send"}
                  </Button>
                </form>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="flex-1 overflow-auto px-6 py-8">
        {filtered.length === 0 ? (
          <div className="crm-card flex h-full items-center justify-center px-6 py-16">
            <div className="text-center">
              <p className="mt-2 text-sm text-muted-foreground">
                {leads.length === 0
                  ? "Import a CSV to get started."
                  : "No leads match your filter."}
              </p>
            </div>
          </div>
        ) : (
          <div className="overflow-hidden rounded-[10px] border border-[#eaecf0] bg-white">
            <Table>
            <TableHeader className="bg-[#f7f8fa]">
              <TableRow className="border-[#e8edf2]">
                <TableHead className="px-5 py-3 text-[11px] font-medium uppercase tracking-wide text-[#6b7c93]">Name</TableHead>
                <TableHead className="px-5 py-3 text-[11px] font-medium uppercase tracking-wide text-[#6b7c93]">Address</TableHead>
                <TableHead className="px-5 py-3 text-[11px] font-medium uppercase tracking-wide text-[#6b7c93]">Phone</TableHead>
                <TableHead className="px-5 py-3 text-right text-[11px] font-medium uppercase tracking-wide text-[#6b7c93]">Score</TableHead>
                <TableHead className="px-5 py-3 text-[11px] font-medium uppercase tracking-wide text-[#6b7c93]">Status</TableHead>
                <TableHead className="px-5 py-3 text-[11px] font-medium uppercase tracking-wide text-[#6b7c93]">Class</TableHead>
                <TableHead className="px-5 py-3 text-[11px] font-medium uppercase tracking-wide text-[#6b7c93]">Follow-up</TableHead>
                <TableHead className="px-5 py-3 text-right text-[11px] font-medium uppercase tracking-wide text-[#6b7c93]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((lead) => (
                  <TableRow key={lead.id} className="group border-[#e8edf2] transition hover:bg-[#f7f8fa]">
                    <TableCell className="px-5 py-4 text-sm font-semibold text-slate-800">
                      <Link href={`/leads/${lead.id}`} className="transition hover:text-[#16a37f]">
                        {lead.first_name} {lead.last_name}
                      </Link>
                    </TableCell>
                    <TableCell className="max-w-[220px] px-5 py-4 truncate text-sm text-slate-500">
                      <Link href={`/leads/${lead.id}`} className="transition hover:text-[#16a37f]">
                        {lead.property_address}
                      </Link>
                    </TableCell>
                    <TableCell className="px-5 py-4 text-sm font-mono text-slate-500">
                      {lead.phone}
                    </TableCell>
                    <TableCell className="px-5 py-4 text-right">
                      <ScoreCell classification={lead.classification} />
                    </TableCell>
                    <TableCell className="px-5 py-4">{statusTag(lead.status)}</TableCell>
                    <TableCell className="px-5 py-4">
                      {classTag(lead.classification)}
                    </TableCell>
                    <TableCell className="px-5 py-4 text-sm text-muted-foreground">
                      {lead.next_follow_up_at
                        ? format(new Date(lead.next_follow_up_at), "MMM d")
                        : "—"}
                    </TableCell>
                    <TableCell className="px-5 py-4 text-right">
                      <Link
                        href={`/leads/${lead.id}`}
                        className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-sm text-muted-foreground transition hover:bg-slate-100 hover:text-foreground"
                      >
                        View
                        <ArrowRight size={13} />
                      </Link>
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
