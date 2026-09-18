// Everything the dashboard renders, as plain data. Built on the server from real leads and
// messages (buildDashboardView) — or supplied by the sample-data preview (demo-view.ts).
// Pure and free of server-only imports so client components can import the types and constants.
import { addDays, format, startOfDay, subDays } from "date-fns";

import type { Database } from "@/types/database";

type Lead = Database["public"]["Tables"]["leads"]["Row"];
type Message = Database["public"]["Tables"]["messages"]["Row"];

export type PipelineBucket = "New Leads" | "Contacted" | "Replied" | "Qualified" | "Offer Sent" | "Dead";

/**
 * Board columns, left to right. Only new / contacted / negotiating / offer_sent have a data
 * source today; skip_traced, under_contract and closed are shown but stay empty until the
 * pipeline can put a lead in them.
 */
export const BOARD_STAGES = [
  { key: "new", label: "New Lead" },
  { key: "skip_traced", label: "Skip Traced" },
  { key: "contacted", label: "Contacted" },
  { key: "negotiating", label: "Negotiating" },
  { key: "offer_sent", label: "Offer Sent" },
  { key: "under_contract", label: "Under Contract" },
  { key: "closed", label: "Closed" },
] as const;
export type BoardStageKey = (typeof BOARD_STAGES)[number]["key"];

const BUCKET_TO_BOARD: Partial<Record<PipelineBucket, BoardStageKey>> = {
  "New Leads": "new",
  Contacted: "contacted",
  Replied: "negotiating",
  Qualified: "negotiating",
  "Offer Sent": "offer_sent",
};

export type FlagKind = "reply" | "overdue" | "deadline" | "due";
export interface BoardCard {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  tag: string | null;
  /** Latest text in either direction, else the lead's last_contacted_at. */
  lastContactAt: string | null;
  dealValue: number | null;
  flag: { kind: FlagKind; label: string } | null;
}
export interface BoardColumn {
  key: BoardStageKey;
  label: string;
  total: number;
  /** Sum of deal values in this column (all leads, not just the visible cards). */
  value: number;
  cards: BoardCard[];
}

export interface ActionItem {
  leadId: string;
  name: string;
  address: string | null;
  phone: string | null;
  detail: string;
  /** Timestamp the row is about (reply time, due date, deadline …), shown relatively. */
  at: string | null;
}
export interface ActionGroup {
  items: ActionItem[];
  count: number;
}

export type Sentiment = "interested" | "maybe" | "not_interested" | "review";
export interface ConversationRow {
  leadId: string;
  name: string;
  snippet: string;
  direction: "inbound" | "outbound";
  at: string;
  sentiment: Sentiment | null;
  unread: boolean;
}

export interface ActivityEvent {
  id: string;
  at: string;
  kind: "reply" | "text" | "lead";
  title: string;
  detail: string | null;
  leadId: string | null;
}

export interface Kpi {
  value: number;
  /** Change versus the previous 7 days, when history exists. */
  delta: number | null;
  /** Last 14 days, oldest first, when history exists. */
  spark: number[] | null;
  hint: string;
}

export interface DashboardView {
  kpis: {
    newLeads: Kpi;
    unreadReplies: Kpi;
    followUpsDue: Kpi;
    offersSent: Kpi;
    contracts: Kpi;
    pipelineValue: Kpi;
  };
  /** Distinct leads that need something from the user today. */
  attentionCount: number;
  totals: { leads: number; hot: number; contacted: number };
  board: BoardColumn[];
  actions: {
    replies: ActionGroup;
    overdue: ActionGroup;
    upcoming: ActionGroup;
    offers: ActionGroup;
    hot: ActionGroup;
    atRisk: ActionGroup;
  };
  conversations: ConversationRow[];
  activity: ActivityEvent[];
  series: { days: string[]; contacted: number[]; replies: number[]; newLeads: number[] };
  /** True for the sample-data preview. Never set for real accounts. */
  sample: boolean;
}

// ── helpers ─────────────────────────────────────────────────────────────────────────────

const OFFER_TAG = /offer/i;

function hasOfferSent(lead: Lead) {
  return OFFER_TAG.test(lead.tag ?? "") || (lead.notes_summary ?? "").toLowerCase().includes("offer sent");
}
function isOpen(lead: Lead) {
  return !lead.is_dnc && lead.status !== "DNC" && lead.status !== "Dead";
}
function displayName(lead: Lead) {
  const full = `${lead.first_name ?? ""} ${lead.last_name ?? ""}`.trim();
  if (full && full.toLowerCase() !== "new lead") return full;
  const digits = (lead.phone ?? "").replace(/\D/g, "");
  const ten = digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
  return ten.length === 10 ? `(${ten.slice(0, 3)}) ${ten.slice(3, 6)}-${ten.slice(6)}` : lead.phone || "Unknown seller";
}
function snippet(body: string | null | undefined, max = 90) {
  const cleaned = (body ?? "").trim().replace(/\s+/g, " ");
  return cleaned.length > max ? `${cleaned.slice(0, max).trimEnd()}…` : cleaned;
}
function dayKey(date: Date) {
  return format(date, "yyyy-MM-dd");
}
function sentimentOf(classification: string | null): Sentiment | null {
  switch (classification) {
    case "HOT":
      return "interested";
    case "WARM":
      return "maybe";
    case "NOT_INTERESTED":
    case "STOP_DNC":
      return "not_interested";
    case "NEEDS_REVIEW":
      return "review";
    default:
      return null;
  }
}
const FLAG_ORDER: Record<FlagKind, number> = { reply: 0, overdue: 1, deadline: 2, due: 3 };

/**
 * @param stageOf  the app's pipeline bucketing (kept in lib/data.ts) so the board matches /pipeline
 */
export function buildDashboardView(
  leads: Lead[],
  messages: Message[],
  stageOf: (lead: Lead) => PipelineBucket,
  now: Date = new Date()
): DashboardView {
  const nowIso = now.toISOString();
  const endOfToday = new Date(now);
  endOfToday.setHours(23, 59, 59, 999);
  const todayKey = dayKey(now);
  const horizonKey = dayKey(addDays(now, 30));

  // Latest message per lead (by timestamp, independent of row order) and latest inbound.
  const latest = new Map<string, Message>();
  const latestInbound = new Map<string, Message>();
  for (const message of messages) {
    if (!message.lead_id) continue;
    const current = latest.get(message.lead_id);
    if (!current || message.created_at > current.created_at) latest.set(message.lead_id, message);
    if (message.direction === "inbound") {
      const inbound = latestInbound.get(message.lead_id);
      if (!inbound || message.created_at > inbound.created_at) latestInbound.set(message.lead_id, message);
    }
  }

  const open = leads.filter(isOpen);
  const valueOf = (lead: Lead) =>
    lead.deal_value != null && Number.isFinite(Number(lead.deal_value)) ? Number(lead.deal_value) : null;

  // ── who needs attention ───────────────────────────────────────────────────────────────
  const item = (lead: Lead, detail: string, at: string | null): ActionItem => ({
    leadId: lead.id,
    name: displayName(lead),
    address: lead.property_address?.trim() || null,
    phone: lead.phone || null,
    detail,
    at,
  });

  const replyLeads = open
    .filter((lead) => latest.get(lead.id)?.direction === "inbound")
    .sort((a, b) => (latest.get(a.id)?.created_at ?? "").localeCompare(latest.get(b.id)?.created_at ?? ""));
  const overdueLeads = open
    .filter((lead) => lead.next_follow_up_at && lead.next_follow_up_at < nowIso)
    .sort((a, b) => (a.next_follow_up_at ?? "").localeCompare(b.next_follow_up_at ?? ""));
  const dueTodayLeads = open.filter(
    (lead) => lead.next_follow_up_at && lead.next_follow_up_at <= endOfToday.toISOString()
  );
  const upcomingLeads = open
    .filter(
      (lead) =>
        lead.next_follow_up_at &&
        lead.next_follow_up_at >= nowIso &&
        lead.next_follow_up_at <= addDays(now, 7).toISOString()
    )
    .sort((a, b) => (a.next_follow_up_at ?? "").localeCompare(b.next_follow_up_at ?? ""));
  const offerLeads = open.filter((lead) => hasOfferSent(lead) && latest.get(lead.id)?.direction !== "inbound");
  const hotNoOfferLeads = open.filter((lead) => lead.classification === "HOT" && !hasOfferSent(lead));
  const atRiskLeads = open
    .filter((lead) => lead.deadline && lead.deadline >= todayKey && lead.deadline <= horizonKey)
    .sort((a, b) => (a.deadline ?? "").localeCompare(b.deadline ?? ""));

  const CAP = 5;
  const group = (leadsIn: Lead[], make: (lead: Lead) => ActionItem): ActionGroup => ({
    items: leadsIn.slice(0, CAP).map(make),
    count: leadsIn.length,
  });

  const actions: DashboardView["actions"] = {
    replies: group(replyLeads, (lead) => item(lead, `“${snippet(latest.get(lead.id)?.body, 80)}”`, latest.get(lead.id)?.created_at ?? null)),
    overdue: group(overdueLeads, (lead) => item(lead, "Follow-up overdue", lead.next_follow_up_at)),
    upcoming: group(upcomingLeads, (lead) => item(lead, "Follow-up scheduled", lead.next_follow_up_at)),
    offers: group(offerLeads, (lead) => item(lead, "Offer sent — no reply yet", latest.get(lead.id)?.created_at ?? null)),
    hot: group(hotNoOfferLeads, (lead) => item(lead, "Hot lead — no offer yet", null)),
    atRisk: group(atRiskLeads, (lead) => item(lead, `Deadline ${format(new Date(`${lead.deadline}T12:00:00`), "MMM d")}`, null)),
  };

  const attentionIds = new Set<string>([...replyLeads, ...overdueLeads, ...dueTodayLeads].map((lead) => lead.id));

  // ── pipeline board ────────────────────────────────────────────────────────────────────
  const flagFor = (lead: Lead): BoardCard["flag"] => {
    if (latest.get(lead.id)?.direction === "inbound") return { kind: "reply", label: "Replied" };
    if (lead.next_follow_up_at && lead.next_follow_up_at < nowIso) return { kind: "overdue", label: "Follow-up overdue" };
    if (lead.deadline && lead.deadline >= todayKey && lead.deadline <= horizonKey) {
      return { kind: "deadline", label: `Deadline ${format(new Date(`${lead.deadline}T12:00:00`), "MMM d")}` };
    }
    if (lead.next_follow_up_at && lead.next_follow_up_at <= endOfToday.toISOString()) return { kind: "due", label: "Follow-up today" };
    return null;
  };

  const columns = new Map<BoardStageKey, Lead[]>(BOARD_STAGES.map((stage) => [stage.key, []]));
  for (const lead of leads) {
    const key = BUCKET_TO_BOARD[stageOf(lead)];
    if (key) columns.get(key)?.push(lead);
  }
  const board: BoardColumn[] = BOARD_STAGES.map((stage) => {
    const inColumn = columns.get(stage.key) ?? [];
    const cards = inColumn
      .map((lead): BoardCard & { _sort: number; _recent: string } => {
        const flag = flagFor(lead);
        return {
          id: lead.id,
          name: displayName(lead),
          address: lead.property_address?.trim() || null,
          phone: lead.phone || null,
          tag: (lead.tag ?? "").split(",")[0]?.trim() || null,
          lastContactAt: latest.get(lead.id)?.created_at ?? lead.last_contacted_at ?? null,
          dealValue: valueOf(lead),
          flag,
          _sort: flag ? FLAG_ORDER[flag.kind] : 9,
          _recent: latest.get(lead.id)?.created_at ?? lead.updated_at ?? "",
        };
      })
      .sort((a, b) => a._sort - b._sort || (b.dealValue ?? 0) - (a.dealValue ?? 0) || b._recent.localeCompare(a._recent))
      .slice(0, 6)
      .map(({ _sort, _recent, ...card }) => card);
    return {
      key: stage.key,
      label: stage.label,
      total: inColumn.length,
      value: inColumn.reduce((sum, lead) => sum + (valueOf(lead) ?? 0), 0),
      cards,
    };
  });

  // ── conversations & activity ───────────────────────────────────────────────────────────
  const leadsById = new Map(leads.map((lead) => [lead.id, lead]));
  const conversations: ConversationRow[] = [...latest.entries()]
    .map(([leadId, message]) => ({ lead: leadsById.get(leadId), message }))
    .filter((entry): entry is { lead: Lead; message: Message } => Boolean(entry.lead))
    .sort((a, b) => b.message.created_at.localeCompare(a.message.created_at))
    .slice(0, 6)
    .map(({ lead, message }) => ({
      leadId: lead.id,
      name: displayName(lead),
      snippet: snippet(message.body, 100),
      direction: message.direction,
      at: message.created_at,
      sentiment: sentimentOf(latestInbound.get(lead.id)?.classification ?? null),
      unread: message.direction === "inbound",
    }));

  // 48h of events; the client keeps only those since the viewer's local midnight.
  const cutoff = subDays(now, 2).toISOString();
  const events: ActivityEvent[] = [];
  for (const message of messages) {
    if (!message.lead_id || message.created_at < cutoff) continue;
    const lead = leadsById.get(message.lead_id);
    const name = lead ? displayName(lead) : "a seller";
    events.push({
      id: `m-${message.id}`,
      at: message.created_at,
      kind: message.direction === "inbound" ? "reply" : "text",
      title: message.direction === "inbound" ? `Reply from ${name}` : `Text sent to ${name}`,
      detail: snippet(message.body, 80),
      leadId: message.lead_id,
    });
  }
  for (const lead of leads) {
    if (lead.created_at >= cutoff) {
      events.push({ id: `l-${lead.id}`, at: lead.created_at, kind: "lead", title: `New lead: ${displayName(lead)}`, detail: lead.property_address?.trim() || null, leadId: lead.id });
    }
  }
  events.sort((a, b) => b.at.localeCompare(a.at));

  // ── 14-day history (leads contacted, replies, new leads) ───────────────────────────────
  const days = Array.from({ length: 14 }, (_, index) => dayKey(subDays(startOfDay(now), 13 - index)));
  const indexOfDay = new Map(days.map((key, index) => [key, index]));
  const contactedSets = days.map(() => new Set<string>());
  const replies = days.map(() => 0);
  const newLeads = days.map(() => 0);
  for (const message of messages) {
    const index = indexOfDay.get(dayKey(new Date(message.created_at)));
    if (index === undefined) continue;
    if (message.direction === "inbound") replies[index] += 1;
    else if (message.lead_id) contactedSets[index].add(message.lead_id);
  }
  for (const lead of leads) {
    const index = indexOfDay.get(dayKey(new Date(lead.created_at)));
    if (index !== undefined) newLeads[index] += 1;
  }
  const contacted = contactedSets.map((set) => set.size);
  const weekDelta = (series: number[]) => {
    const previous = series.slice(0, 7).reduce((a, b) => a + b, 0);
    const recent = series.slice(7).reduce((a, b) => a + b, 0);
    return recent - previous;
  };

  // ── KPIs ──────────────────────────────────────────────────────────────────────────────
  const valued = open.filter((lead) => valueOf(lead) !== null);
  const offersSent = open.filter((lead) => stageOf(lead) === "Offer Sent" || hasOfferSent(lead));
  const newLeadCount = leads.filter((lead) => stageOf(lead) === "New Leads").length;

  const kpis: DashboardView["kpis"] = {
    newLeads: { value: newLeadCount, delta: weekDelta(newLeads), spark: newLeads, hint: "not contacted yet" },
    unreadReplies: { value: replyLeads.length, delta: weekDelta(replies), spark: replies, hint: "sellers waiting on you" },
    followUpsDue: {
      value: dueTodayLeads.length,
      delta: null,
      spark: null,
      hint: overdueLeads.length > 0 ? `${overdueLeads.length} overdue` : "due today or earlier",
    },
    offersSent: { value: offersSent.length, delta: null, spark: null, hint: `${offerLeads.length} awaiting reply` },
    // TODO(data source): nothing records a lead reaching "Under Contract" yet.
    contracts: { value: 0, delta: null, spark: null, hint: "not tracked yet" },
    pipelineValue: {
      value: valued.reduce((sum, lead) => sum + (valueOf(lead) ?? 0), 0),
      delta: null,
      spark: null,
      hint: valued.length > 0 ? `across ${valued.length} ${valued.length === 1 ? "lead" : "leads"}` : "add deal values on lead pages",
    },
  };

  return {
    kpis,
    attentionCount: attentionIds.size,
    totals: {
      leads: leads.length,
      hot: leads.filter((lead) => lead.classification === "HOT").length,
      contacted: leads.filter((lead) => lead.last_contacted_at || latest.has(lead.id)).length,
    },
    board,
    actions,
    conversations,
    activity: events.slice(0, 40),
    series: { days, contacted, replies, newLeads },
    sample: false,
  };
}

export const EMPTY_DASHBOARD_VIEW: DashboardView = buildDashboardView([], [], () => "New Leads");

/** Lowest-risk way to know if the account has nothing to show yet. */
export function isEmptyAccount(view: DashboardView) {
  return view.totals.leads === 0;
}
