"use client";

import Link from "next/link";
import { useState, useMemo } from "react";
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
import { formatClassificationColor } from "@/lib/utils";
import type { Database, LeadClassification, LeadStatus } from "@/types/database";

type Lead = Database["public"]["Tables"]["leads"]["Row"];
type Note = Database["public"]["Tables"]["notes"]["Row"];
type Followup = Database["public"]["Tables"]["followups"]["Row"];

const STATUS_OPTIONS: Array<"all" | LeadStatus> = [
  "all",
  "New",
  "Contacted",
  "Replied",
  "Hot",
  "Dead",
  "DNC",
];

function statusTag(status: LeadStatus) {
  switch (status) {
    case "Hot":
      return (
        <span className="inline-flex items-center rounded-full px-2 py-0.5 font-mono text-[8px] font-medium uppercase tracking-wider"
          style={{ background: "#fff0eb", color: "#b84a1e" }}>
          Hot
        </span>
      );
    case "New":
      return (
        <span className="inline-flex items-center rounded-full px-2 py-0.5 font-mono text-[8px] font-medium uppercase tracking-wider"
          style={{ background: "#eff5ff", color: "#2c5fbd" }}>
          New
        </span>
      );
    case "Contacted":
      return (
        <span className="inline-flex items-center rounded-full px-2 py-0.5 font-mono text-[8px] font-medium uppercase tracking-wider"
          style={{ background: "#edfaf3", color: "#166b47" }}>
          Contacted
        </span>
      );
    case "Replied":
      return (
        <span className="inline-flex items-center rounded-full px-2 py-0.5 font-mono text-[8px] font-medium uppercase tracking-wider"
          style={{ background: "#edfaf3", color: "#166b47" }}>
          Replied
        </span>
      );
    case "Dead":
    case "DNC":
      return (
        <span className="inline-flex items-center rounded-full px-2 py-0.5 font-mono text-[8px] font-medium uppercase tracking-wider"
          style={{ background: "#f4f4f4", color: "#888" }}>
          {status}
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center rounded-full px-2 py-0.5 font-mono text-[8px] font-medium uppercase tracking-wider"
          style={{ background: "#f4f4f4", color: "#888" }}>
          {status}
        </span>
      );
  }
}

function scoreFromClassification(classification: LeadClassification): number {
  switch (classification) {
    case "HOT":
      return 92;
    case "WARM":
      return 71;
    case "COLD":
      return 38;
    case "DEAD":
      return 5;
    case "OPT_OUT":
      return 0;
    case "UNKNOWN":
      return 25;
  }
}

function ScoreCell({ classification }: { classification: LeadClassification }) {
  const score = scoreFromClassification(classification);
  const color =
    score >= 85 ? "text-rose-600" : score >= 60 ? "text-amber-600" : "text-muted-foreground";
  return (
    <span className={`font-mono text-sm font-medium ${color}`}>{score}</span>
  );
}

interface LeadsClientProps {
  leads: Lead[];
  notes: Note[];
  followups: Followup[];
}

export function LeadsClient({ leads, notes, followups }: LeadsClientProps) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | LeadStatus>("all");
  const [csvDialogOpen, setCsvDialogOpen] = useState(false);

  const filtered = useMemo(() => {
    return leads.filter((l) => {
      const matchSearch =
        search === "" ||
        `${l.first_name} ${l.last_name} ${l.property_address} ${l.phone}`
          .toLowerCase()
          .includes(search.toLowerCase());
      const matchStatus =
        statusFilter === "all" || l.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [leads, search, statusFilter]);

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* ── Top bar ──────────────────────────────────────────── */}
      <div className="flex shrink-0 items-center justify-between gap-3 border-b bg-background px-6 py-4">
        <h1 className="text-[15px] font-semibold">Leads</h1>
        <div className="flex items-center gap-2">
          <Input
            placeholder="Search leads…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 w-48 text-sm"
          />
          <select
            value={statusFilter}
            onChange={(e) =>
              setStatusFilter(e.target.value as "all" | LeadStatus)
            }
            className="h-8 rounded-md border border-border bg-background px-2 text-sm"
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s === "all" ? "All statuses" : s}
              </option>
            ))}
          </select>
          <Button
            size="sm"
            className="h-8 gap-1.5 bg-[#16a37f] hover:bg-[#0d7a5f] text-white border-none"
            onClick={() => setCsvDialogOpen(true)}
          >
            <Upload size={13} />
            Import CSV
          </Button>
        </div>
      </div>

      {/* ── CSV upload overlay (lightweight) ─────────────────── */}
      {csvDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-card">
            <button
              onClick={() => setCsvDialogOpen(false)}
              className="absolute right-4 top-4 text-muted-foreground hover:text-foreground"
            >
              ✕
            </button>
            <h2 className="mb-4 text-base font-semibold">Import CSV</h2>
            <form
              action="/api/upload-csv"
              method="POST"
              encType="multipart/form-data"
              onSubmit={() => setCsvDialogOpen(false)}
            >
              <input
                type="file"
                name="file"
                accept=".csv"
                required
                className="mb-4 block w-full text-sm"
              />
              <Button type="submit" className="w-full bg-[#16a37f] hover:bg-[#0d7a5f] text-white">
                Upload
              </Button>
            </form>
          </div>
        </div>
      )}

      {/* ── Table ────────────────────────────────────────────── */}
      <div className="flex-1 overflow-auto">
        {filtered.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <p className="text-sm text-muted-foreground">
              {leads.length === 0
                ? "Import a CSV to get started."
                : "No leads match your filter."}
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Address</TableHead>
                <TableHead>Phone</TableHead>
             <TableHead>Score</TableHead>
              <TableHead>Status</TableHead>
                <TableHead>Class</TableHead>
              <TableHead>Follow-up</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((lead) => (
                  <TableRow key={lead.id} className="group">
                    <TableCell className="font-medium text-sm">
                      <Link href={`/leads/${lead.id}`} className="hover:text-[#16a37f] hover:underline">
                        {lead.first_name} {lead.last_name}
                      </Link>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-[180px] truncate">
                      <Link href={`/leads/${lead.id}`} className="hover:text-[#16a37f] hover:underline">
                        {lead.property_address}
                      </Link>
                    </TableCell>
                    <TableCell className="text-sm font-mono text-muted-foreground">
                      {lead.phone}
                    </TableCell>
                    <TableCell>
                      <ScoreCell classification={lead.classification} />
                    </TableCell>
                    <TableCell>{statusTag(lead.status)}</TableCell>
                    <TableCell>
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${formatClassificationColor(lead.classification)}`}
                      >
                        {getClassificationLabel(lead.classification)}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {nextFollowUpForLead(lead)
                        ? format(new Date(nextFollowUpForLead(lead)!), "MMM d")
                        : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <Link
                        href={`/leads/${lead.id}`}
                        className="inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-sm text-muted-foreground transition hover:bg-muted hover:text-foreground"
                      >
                        View
                        <ArrowRight size={13} />
                      </Link>
                    </TableCell>
                  </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
function nextFollowUpForLead(lead: Lead) {
  return lead.next_follow_up_at ?? lead.follow_up_date;
}
