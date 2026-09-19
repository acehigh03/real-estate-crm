// The four columns shared by the dashboard board and the Pipeline page, in one place.
// Pure (no server imports) so client components can use it too.
import type { Database, LeadClassification, LeadStage, LeadStatus } from "@/types/database";

type Lead = Database["public"]["Tables"]["leads"]["Row"];

export type BoardColumnKey = "new" | "skip_traced" | "contacted" | "negotiating";

export interface BoardColumnDef {
  key: BoardColumnKey;
  label: string;
  /** Stage values that belong to this column. `New` also catches rows with no stage. */
  stages: LeadStage[];
  emptyText: string;
  emptyHref: string;
  /** What dropping a card here (or bulk-changing to it) writes. Same shape updatePipelineStage writes. */
  write: { status: LeadStatus; stage: LeadStage; classification?: LeadClassification };
}

export const BOARD_COLUMNS: BoardColumnDef[] = [
  { key: "new", label: "New Lead", stages: ["New"], emptyText: "Import your first list →", emptyHref: "/import", write: { status: "New", stage: "New" } },
  { key: "skip_traced", label: "Skip Traced", stages: ["Skip Traced"], emptyText: "Connect skip tracing →", emptyHref: "/settings", write: { status: "New", stage: "Skip Traced" } },
  { key: "contacted", label: "Contacted", stages: ["Contacted", "Replied", "Follow Up"], emptyText: "Start a campaign →", emptyHref: "/campaigns", write: { status: "Contacted", stage: "Contacted" } },
  { key: "negotiating", label: "Negotiating", stages: ["Hot Lead", "Offer Sent"], emptyText: "Start a campaign →", emptyHref: "/campaigns", write: { status: "Hot", stage: "Hot Lead", classification: "HOT" } },
];

export const NEGOTIATING_STAGES: LeadStage[] = ["Hot Lead", "Offer Sent"];
/** Leads in these stages are off the board and out of pipeline value. */
export const INACTIVE_STAGES: LeadStage[] = ["Dead", "Closed", "DNC"];

export const COLUMN_BY_KEY = Object.fromEntries(BOARD_COLUMNS.map((column) => [column.key, column])) as Record<BoardColumnKey, BoardColumnDef>;

export function isBoardColumnKey(value: unknown): value is BoardColumnKey {
  return typeof value === "string" && value in COLUMN_BY_KEY;
}

/** The column a lead sits in, or null when it is off the board (dead, closed or opted out). */
export function boardColumnFor(lead: Pick<Lead, "stage" | "status" | "is_dnc">): BoardColumnKey | null {
  if (lead.is_dnc || lead.status === "DNC" || lead.status === "Dead") return null;
  const stage = lead.stage;
  if (stage && INACTIVE_STAGES.includes(stage)) return null;
  for (const column of BOARD_COLUMNS) {
    if (stage && column.stages.includes(stage)) return column.key;
  }
  return "new";
}

export type Urgency = "Hot" | "Warm" | "Cold";

const DAY = 86_400_000;

/** Hot = touched in the last 2 days, Warm = within 7, otherwise Cold (including never contacted). */
export function urgencyFor(lastContactedAt: string | null, now = Date.now()): Urgency {
  if (!lastContactedAt) return "Cold";
  const age = now - new Date(lastContactedAt).getTime();
  if (Number.isNaN(age)) return "Cold";
  if (age <= 2 * DAY) return "Hot";
  if (age <= 7 * DAY) return "Warm";
  return "Cold";
}

export function nextActionFor(lead: Pick<Lead, "stage" | "next_follow_up_at" | "last_contacted_at">, columnKey: BoardColumnKey | null) {
  if (lead.next_follow_up_at) return { label: "Follow up", at: lead.next_follow_up_at };
  switch (columnKey) {
    case "new": return { label: "Send first text", at: null };
    case "skip_traced": return { label: "Send first text", at: null };
    case "contacted": return { label: "Follow up", at: null };
    case "negotiating": return { label: lead.stage === "Offer Sent" ? "Chase the offer" : "Make an offer", at: null };
    default: return { label: "Review", at: null };
  }
}

export function leadFullName(lead: Pick<Lead, "first_name" | "last_name" | "phone">) {
  return `${lead.first_name ?? ""} ${lead.last_name ?? ""}`.trim() || lead.phone;
}

export function initialsOf(name: string) {
  const parts = name.split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase() || "•";
}

// ── Stage writes (shared by drag-and-drop, bulk change and the contact editor) ────────────────
export const EDITABLE_STAGES: LeadStage[] = ["New", "Skip Traced", "Contacted", "Replied", "Hot Lead", "Follow Up", "Offer Sent", "Dead"];

const STAGE_WRITES: Partial<Record<LeadStage, { status: LeadStatus; classification?: LeadClassification }>> = {
  New: { status: "New" },
  "Skip Traced": { status: "New" },
  Contacted: { status: "Contacted" },
  Replied: { status: "Replied" },
  "Hot Lead": { status: "Hot", classification: "HOT" },
  "Follow Up": { status: "Contacted" },
  "Offer Sent": { status: "Contacted" },
  Dead: { status: "Dead", classification: "DEAD" },
};

/** The status/stage/classification a stage change writes. Never touches is_dnc. */
export function writeForStage(stage: LeadStage): { status: LeadStatus; stage: LeadStage; classification?: LeadClassification } | null {
  const write = STAGE_WRITES[stage];
  return write ? { ...write, stage } : null;
}
