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
  return (
    <span className="font-mono text-sm font-medium text-slate-700">{score}</span>
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
            onChange={(e) =>
              setStatusFilter(e.target.value as "all" | LeadStatus)
            }
            className="crm-input h-9 px-3"
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s === "all" ? "All statuses" : s}
              </option>
            ))}
          </select>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="crm-panel relative w-full max-w-md p-6">
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
                      {nextFollowUpForLead(lead)
                        ? format(new Date(nextFollowUpForLead(lead)!), "MMM d")
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
function nextFollowUpForLead(lead: Lead) {
  return lead.next_follow_up_at;
}
