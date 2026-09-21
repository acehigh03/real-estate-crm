// The four columns shared by the dashboard board and the Pipeline page, in one place.
// Pure (no server imports) so client components can use it too.
import type { Database, LeadClassification, LeadStage, LeadStatus } from "@/types/database";

type Lead = Database["public"]["Tables"]["leads"]["Row"];

export type BoardColumnKey = "new" | "skip_traced" | "contacted" | "negotiating" | "under_contract" | "closed";

export interface BoardColumnDef {
  key: BoardColumnKey;
  label: string;
  /** Stage values that belong to this column. `New` also catches rows with no stage. */
  stages: LeadStage[];
  emptyText: string;
  /** null = plain empty state with no call to action. */
  emptyHref: string | null;
  /** Small supporting line under the empty-state text. */
  emptyHint: string;
  /** What dropping a card here (or bulk-changing to it) writes. Same shape updatePipelineStage writes. */
  write: { status: LeadStatus; stage: LeadStage; classification?: LeadClassification };
}

export const BOARD_COLUMNS: BoardColumnDef[] = [
  { key: "new", label: "New Lead", stages: ["New"], emptyText: "Import your first list →", emptyHref: "/import", emptyHint: "Start by importing leads to fill your pipeline.", write: { status: "New", stage: "New" } },
  { key: "skip_traced", label: "Skip Traced", stages: ["Skip Traced"], emptyText: "Connect skip tracing →", emptyHref: "/settings", emptyHint: "Find owner info to move faster.", write: { status: "New", stage: "Skip Traced" } },
  { key: "contacted", label: "Contacted", stages: ["Contacted", "Replied", "Follow Up"], emptyText: "Start a campaign →", emptyHref: "/campaigns", emptyHint: "Text new leads to start conversations.", write: { status: "Contacted", stage: "Contacted" } },
  { key: "negotiating", label: "Negotiating", stages: ["Hot Lead", "Offer Sent"], emptyText: "No active negotiations", emptyHref: null, emptyHint: "Move hot leads here when offers are on the table.", write: { status: "Hot", stage: "Hot Lead", classification: "HOT" } },
  { key: "under_contract", label: "Under Contract", stages: ["Under Contract"], emptyText: "No signed contracts", emptyHref: null, emptyHint: "Move signed deals here until closing.", write: { status: "Hot", stage: "Under Contract", classification: "HOT" } },
  { key: "closed", label: "Closed", stages: ["Closed"], emptyText: "No closed deals", emptyHref: null, emptyHint: "Completed deals stay visible here.", write: { status: "Hot", stage: "Closed", classification: "HOT" } },
];

export const NEGOTIATING_STAGES: LeadStage[] = ["Hot Lead", "Offer Sent"];
/** Leads in these stages are off the board and out of pipeline value. */
export const INACTIVE_STAGES: LeadStage[] = ["Dead", "DNC"];

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

const HOUR = 3_600_000;
const TZ = "America/Chicago";
const dayOf = (ms: number) => new Date(ms).toLocaleDateString("en-CA", { timeZone: TZ });

export interface NextAction {
  label: string;
  /** Rose text: the follow-up is overdue. */
  overdue: boolean;
}

/** One specific next step, computed from next_follow_up_at and last_contacted_at. */
export function nextActionFor(lead: Pick<Lead, "next_follow_up_at" | "last_contacted_at">, now = Date.now()): NextAction {
  const followUp = lead.next_follow_up_at ? new Date(lead.next_follow_up_at).getTime() : NaN;
  if (!Number.isNaN(followUp)) {
    const diff = followUp - now;
    if (diff < 0) return { label: "Overdue — act now", overdue: true };
    if (diff <= 2 * HOUR) return { label: "Reply within 2 hrs", overdue: false };
    if (dayOf(followUp) === dayOf(now)) return { label: "Follow up today", overdue: false };
    // Scheduled for a later day: show when, rather than telling them to schedule it again.
    const when = new Date(followUp).toLocaleDateString("en-US", { timeZone: TZ, month: "short", day: "numeric" });
    return { label: `Follow up ${when}`, overdue: false };
  }
  const contacted = lead.last_contacted_at ? new Date(lead.last_contacted_at).getTime() : NaN;
  if (!Number.isNaN(contacted) && now - contacted > 3 * DAY) return { label: "Gone quiet — reach out", overdue: false };
  return { label: "Schedule next step", overdue: false };
}

export function leadFullName(lead: Pick<Lead, "first_name" | "last_name" | "phone">) {
  return `${lead.first_name ?? ""} ${lead.last_name ?? ""}`.trim() || lead.phone;
}

export function initialsOf(name: string) {
  const parts = name.split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase() || "•";
}

// ── Stage writes (shared by drag-and-drop, bulk change and the contact editor) ────────────────
export const EDITABLE_STAGES: LeadStage[] = ["New", "Skip Traced", "Contacted", "Replied", "Hot Lead", "Follow Up", "Offer Sent", "Under Contract", "Closed", "Dead"];

const STAGE_WRITES: Partial<Record<LeadStage, { status: LeadStatus; classification?: LeadClassification }>> = {
  New: { status: "New" },
  "Skip Traced": { status: "New" },
  Contacted: { status: "Contacted" },
  Replied: { status: "Replied" },
  "Hot Lead": { status: "Hot", classification: "HOT" },
  "Follow Up": { status: "Contacted" },
  "Offer Sent": { status: "Contacted" },
  "Under Contract": { status: "Hot", classification: "HOT" },
  Closed: { status: "Hot", classification: "HOT" },
  Dead: { status: "Dead", classification: "DEAD" },
};

/** The status/stage/classification a stage change writes. Never touches is_dnc. */
export function writeForStage(stage: LeadStage): { status: LeadStatus; stage: LeadStage; classification?: LeadClassification } | null {
  const write = STAGE_WRITES[stage];
  return write ? { ...write, stage } : null;
}

export interface CardIdentity {
  primary: string;
  /** Property address; null when there isn't one. */
  secondary: string | null;
  /** Phone as its own muted line; null when the phone is already the primary line. */
  phone: string | null;
  /** True when the phone is all we have, so the primary line is styled lighter. */
  phoneOnly: boolean;
}

/** Name first, then address, then phone. Falls back to the phone alone when name and address are both missing. */
export function cardIdentity(lead: Pick<Lead, "first_name" | "last_name" | "phone" | "property_address">, formatPhone: (phone: string) => string): CardIdentity {
  const name = `${lead.first_name ?? ""} ${lead.last_name ?? ""}`.trim();
  const address = (lead.property_address ?? "").trim();
  const phone = formatPhone(lead.phone);
  if (!name && !address) return { primary: phone, secondary: null, phone: null, phoneOnly: true };
  return { primary: name || "Unknown seller", secondary: address || null, phone, phoneOnly: false };
}
