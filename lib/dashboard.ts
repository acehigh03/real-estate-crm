// Server-side queries for the Seller Command Center (dashboard, pipeline, messenger badge).
//
// Real schema notes (the spec was written against different names):
//   stage 'new'/'negotiating'  -> leads.stage values "New" / "Hot Lead" + "Offer Sent" (see lib/board.ts)
//   next_follow_up             -> leads.next_follow_up_at
//   last_contact               -> leads.last_contacted_at
// Every query is scoped to the signed-in user. Optional columns added by migration
// 20260919120000_dashboard_fields.sql (messages.read_at, leads.pipeline_position) are handled
// gracefully when the migration hasn't been applied yet.
import { cache } from "react";

import { BOARD_COLUMNS, INACTIVE_STAGES, NEGOTIATING_STAGES, boardColumnFor, leadFullName, type BoardColumnKey } from "@/lib/board";
import { requireUser } from "@/lib/data";
import { logError } from "@/lib/errors";
import { unreadLeadIds } from "@/lib/unread";
import type { Database, LeadStage } from "@/types/database";

type Lead = Database["public"]["Tables"]["leads"]["Row"];

const APP_TZ = "America/Chicago";
const DAY = 86_400_000;
const ctx = cache(requireUser);

export interface BoardLead {
  id: string;
  first_name: string;
  last_name: string;
  phone: string;
  property_address: string;
  city: string | null;
  stage: LeadStage | null;
  status: Lead["status"];
  deal_value: number | null;
  last_contacted_at: string | null;
  next_follow_up_at: string | null;
  deadline: string | null;
  tag: string | null;
  lead_source: string | null;
  pipeline_position?: number | null;
  updated_at: string;
  created_at: string;
}

export interface BoardColumnData {
  key: BoardColumnKey;
  label: string;
  emptyText: string;
  emptyHref: string;
  count: number;
  value: number;
  leads: BoardLead[];
}

export interface ConversationPreview {
  lead_id: string;
  name: string;
  phone: string;
  preview: string;
  at: string;
  unread: boolean;
  direction: "inbound" | "outbound";
}

export interface AtRiskDeal {
  id: string;
  name: string;
  address: string;
  value: number;
  reason: "overdue_followup" | "stale";
  detail: string;
}

export interface AtRiskSummary {
  count: number;
  value: number;
  overdueFollowUps: number;
  staleOffers: number;
  deals: AtRiskDeal[];
}

export interface TodayActivity {
  textsSent: number;
  repliesReceived: number;
  events: Array<{ id: string; kind: "sent" | "reply"; name: string; body: string; at: string; lead_id: string | null }>;
}

export interface DashboardData {
  newLeads: number;
  unreadReplies: number;
  followUpsDue: number;
  offersSent: number;
  pipelineValue: number;
  board: BoardColumnData[];
  conversations: ConversationPreview[];
  today: TodayActivity;
  atRisk: AtRiskSummary;
  stats: { contacted: number; replies: number; offersSent: number; pipelineValue: number };
}

// ── time helpers ──────────────────────────────────────────────────────────────────────────────

/** Midnight today in the business timezone, as a UTC ISO string. */
export function startOfTodayIso(now = new Date()): string {
  const local = new Date(now.toLocaleString("en-US", { timeZone: APP_TZ }));
  const utc = new Date(now.toLocaleString("en-US", { timeZone: "UTC" }));
  const offsetMs = local.getTime() - utc.getTime();
  const localMidnight = new Date(local);
  localMidnight.setHours(0, 0, 0, 0);
  return new Date(localMidnight.getTime() - offsetMs).toISOString();
}

// ── slim, paginated summary of every active lead (one pass feeds most counters) ───────────────

interface SlimLead {
  id: string;
  stage: LeadStage | null;
  status: Lead["status"];
  is_dnc: boolean;
  deal_value: number | null;
  last_contacted_at: string | null;
  last_replied_at: string | null;
  next_follow_up_at: string | null;
  created_at: string;
}

const loadSummary = cache(async (): Promise<SlimLead[]> => {
  const { supabase, user } = await ctx();
  const rows: SlimLead[] = [];
  const PAGE = 1000;
  for (let page = 0; page < 10; page++) {
    const { data, error } = await supabase
      .from("leads")
      .select("id, stage, status, is_dnc, deal_value, last_contacted_at, last_replied_at, next_follow_up_at, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .range(page * PAGE, page * PAGE + PAGE - 1);
    if (error) throw error;
    rows.push(...((data ?? []) as SlimLead[]));
    if ((data?.length ?? 0) < PAGE) break;
  }
  return rows;
});

const isActive = (lead: SlimLead) => boardColumnFor(lead) !== null;

// ── the spec's query functions ────────────────────────────────────────────────────────────────

/** Leads in the New stage (never contacted, not yet skip traced). */
export async function getNewLeadsCount(): Promise<number> {
  return (await loadSummary()).filter((lead) => boardColumnFor(lead) === "new").length;
}

/** Conversations whose newest message is an unopened inbound reply. */
export async function getUnreadRepliesCount(): Promise<number> {
  const { supabase, user } = await ctx();
  return (await unreadConversations(supabase, user.id)).size;
}

/** Active leads whose follow-up date has arrived. */
export async function getFollowUpsDue(): Promise<number> {
  const now = Date.now();
  return (await loadSummary()).filter((lead) => isActive(lead) && lead.next_follow_up_at && new Date(lead.next_follow_up_at).getTime() <= now).length;
}

export async function getOffersSentCount(): Promise<number> {
  return (await loadSummary()).filter((lead) => isActive(lead) && lead.stage === "Offer Sent").length;
}

/** Sum of deal_value across active leads (not dead, closed or opted out). */
export async function getPipelineValue(): Promise<number> {
  return (await loadSummary()).reduce((sum, lead) => (isActive(lead) ? sum + Number(lead.deal_value ?? 0) : sum), 0);
}

const BOARD_COLS = "id, first_name, last_name, phone, property_address, city, stage, status, deal_value, last_contacted_at, next_follow_up_at, deadline, tag, lead_source, updated_at, created_at";

/** Each column with its true count and value, and up to `limit` leads (manual order, then most recently updated). */
export async function getLeadsByStage(limit = 10): Promise<BoardColumnData[]> {
  const { supabase, user } = await ctx();
  const summary = await loadSummary();

  return Promise.all(
    BOARD_COLUMNS.map(async (column) => {
      const inColumn = summary.filter((lead) => boardColumnFor(lead) === column.key);
      const value = inColumn.reduce((sum, lead) => sum + Number(lead.deal_value ?? 0), 0);

      const build = (withPosition: boolean) => {
        let query = supabase
          .from("leads")
          .select(withPosition ? `${BOARD_COLS}, pipeline_position` : BOARD_COLS)
          .eq("user_id", user.id)
          .eq("is_dnc", false)
          .not("status", "in", "(Dead,DNC)");
        query = column.key === "new" ? query.or("stage.eq.New,stage.is.null") : query.in("stage", column.stages);
        if (withPosition) query = query.order("pipeline_position", { ascending: true, nullsFirst: false });
        return query.order("updated_at", { ascending: false }).limit(limit);
      };
      let result = await build(true);
      if (result.error) result = await build(false); // pipeline_position not migrated yet
      if (result.error) logError("dashboard board", result.error, { column: column.key });

      return {
        key: column.key,
        label: column.label,
        emptyText: column.emptyText,
        emptyHref: column.emptyHref,
        count: inColumn.length,
        value,
        leads: ((result.data ?? []) as unknown as BoardLead[]).filter((lead) => boardColumnFor({ ...lead, is_dnc: false }) === column.key),
      };
    })
  );
}

async function selectMessages(build: (cols: string) => PromiseLike<{ data: unknown; error: unknown }>) {
  let result = await build("id, lead_id, direction, body, created_at, read_at");
  if (result.error) result = await build("id, lead_id, direction, body, created_at"); // read_at not migrated yet
  if (result.error) throw result.error;
  return (result.data ?? []) as Array<{ id: string; lead_id: string | null; direction: "inbound" | "outbound"; body: string; created_at: string; read_at?: string | null }>;
}

async function unreadConversations(supabase: Awaited<ReturnType<typeof ctx>>["supabase"], userId: string) {
  const messages = await selectMessages((cols) =>
    supabase.from("messages").select(cols).eq("user_id", userId).order("created_at", { ascending: false }).limit(1500)
  );
  return unreadLeadIds(messages);
}

/** The latest conversations (one row per lead), newest first. */
export async function getRecentConversations(limit = 5): Promise<ConversationPreview[]> {
  const { supabase, user } = await ctx();
  const messages = await selectMessages((cols) =>
    supabase.from("messages").select(cols).eq("user_id", user.id).order("created_at", { ascending: false }).limit(300)
  );
  const unread = unreadLeadIds(messages);
  const latest = new Map<string, (typeof messages)[number]>();
  for (const message of messages) if (message.lead_id && !latest.has(message.lead_id)) latest.set(message.lead_id, message);
  const top = [...latest.values()].slice(0, limit);
  if (!top.length) return [];

  const { data: leads } = await supabase.from("leads").select("id, first_name, last_name, phone").eq("user_id", user.id).in("id", top.map((message) => message.lead_id as string));
  const byId = new Map((leads ?? []).map((lead) => [lead.id, lead]));
  return top.flatMap((message) => {
    const lead = byId.get(message.lead_id as string);
    if (!lead) return [];
    return [{ lead_id: lead.id, name: leadFullName(lead), phone: lead.phone, preview: message.body, at: message.created_at, unread: unread.has(lead.id), direction: message.direction }];
  });
}

/** Texts sent and replies received since midnight (Central time), plus the latest events. */
export async function getTodayActivity(): Promise<TodayActivity> {
  const { supabase, user } = await ctx();
  const since = startOfTodayIso();
  const { data, error } = await supabase
    .from("messages")
    .select("id, lead_id, direction, body, created_at")
    .eq("user_id", user.id)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) throw error;
  const rows = data ?? [];
  const eventRows = rows.slice(0, 8);
  const leadIds = [...new Set(eventRows.map((row) => row.lead_id).filter((id): id is string => !!id))];
  const { data: leads } = leadIds.length
    ? await supabase.from("leads").select("id, first_name, last_name, phone").eq("user_id", user.id).in("id", leadIds)
    : { data: [] as Array<Pick<Lead, "id" | "first_name" | "last_name" | "phone">> };
  const byId = new Map((leads ?? []).map((lead) => [lead.id, lead]));
  return {
    textsSent: rows.filter((row) => row.direction === "outbound").length,
    repliesReceived: rows.filter((row) => row.direction === "inbound").length,
    events: eventRows.map((row) => ({
      id: row.id,
      kind: row.direction === "outbound" ? "sent" : "reply",
      name: row.lead_id && byId.get(row.lead_id) ? leadFullName(byId.get(row.lead_id)!) : "Unknown",
      body: row.body,
      at: row.created_at,
      lead_id: row.lead_id,
    })),
  };
}

/** Negotiating deals that are overdue for a follow-up or haven't been touched in 7+ days. */
export async function getAtRiskDeals(): Promise<AtRiskSummary> {
  const { supabase, user } = await ctx();
  const now = Date.now();
  const staleBefore = now - 7 * DAY;

  const flagged = (await loadSummary())
    .filter((lead) => isActive(lead) && lead.stage && NEGOTIATING_STAGES.includes(lead.stage))
    .flatMap((lead) => {
      const overdue = !!lead.next_follow_up_at && new Date(lead.next_follow_up_at).getTime() < now;
      const lastTouch = lead.last_contacted_at ? new Date(lead.last_contacted_at).getTime() : new Date(lead.created_at).getTime();
      const stale = lastTouch < staleBefore;
      if (!overdue && !stale) return [];
      return [{ lead, reason: (overdue ? "overdue_followup" : "stale") as AtRiskDeal["reason"], lastTouch }];
    });

  const summary: AtRiskSummary = {
    count: flagged.length,
    value: flagged.reduce((sum, item) => sum + Number(item.lead.deal_value ?? 0), 0),
    overdueFollowUps: flagged.filter((item) => item.reason === "overdue_followup").length,
    staleOffers: flagged.filter((item) => item.reason === "stale").length,
    deals: [],
  };
  if (!flagged.length) return summary;

  const top = [...flagged].sort((a, b) => Number(b.lead.deal_value ?? 0) - Number(a.lead.deal_value ?? 0)).slice(0, 5);
  const { data: details } = await supabase.from("leads").select("id, first_name, last_name, phone, property_address").eq("user_id", user.id).in("id", top.map((item) => item.lead.id));
  const byId = new Map((details ?? []).map((lead) => [lead.id, lead]));
  summary.deals = top.flatMap((item) => {
    const lead = byId.get(item.lead.id);
    if (!lead) return [];
    const days = Math.max(1, Math.floor((now - item.lastTouch) / DAY));
    return [{
      id: lead.id,
      name: leadFullName(lead),
      address: lead.property_address,
      value: Number(item.lead.deal_value ?? 0),
      reason: item.reason,
      detail: item.reason === "overdue_followup" ? "Follow-up overdue" : `No contact in ${days} days`,
    }];
  });
  return summary;
}

// ── everything the dashboard needs, in parallel ───────────────────────────────────────────────

export async function getDashboardData(): Promise<DashboardData> {
  const empty = { textsSent: 0, repliesReceived: 0, events: [] } as TodayActivity;
  const settle = async <T,>(name: string, promise: Promise<T>, fallback: T): Promise<T> => {
    try { return await promise; } catch (error) { logError("dashboard", error, { query: name }); return fallback; }
  };

  const [newLeads, unreadReplies, followUpsDue, offersSent, pipelineValue, board, conversations, today, atRisk, summary] = await Promise.all([
    settle("newLeads", getNewLeadsCount(), 0),
    settle("unreadReplies", getUnreadRepliesCount(), 0),
    settle("followUpsDue", getFollowUpsDue(), 0),
    settle("offersSent", getOffersSentCount(), 0),
    settle("pipelineValue", getPipelineValue(), 0),
    settle("board", getLeadsByStage(10), BOARD_COLUMNS.map((column) => ({ key: column.key, label: column.label, emptyText: column.emptyText, emptyHref: column.emptyHref, count: 0, value: 0, leads: [] }))),
    settle("conversations", getRecentConversations(5), [] as ConversationPreview[]),
    settle("today", getTodayActivity(), empty),
    settle("atRisk", getAtRiskDeals(), { count: 0, value: 0, overdueFollowUps: 0, staleOffers: 0, deals: [] } as AtRiskSummary),
    settle("summary", loadSummary(), [] as SlimLead[]),
  ]);

  return {
    newLeads, unreadReplies, followUpsDue, offersSent, pipelineValue, board, conversations, today, atRisk,
    stats: {
      contacted: summary.filter((lead) => lead.last_contacted_at).length,
      replies: summary.filter((lead) => lead.last_replied_at).length,
      offersSent,
      pipelineValue,
    },
  };
}

/** Unread conversation count for the sidebar badge; never throws. */
export async function getUnreadBadgeCount(): Promise<number> {
  try { return await getUnreadRepliesCount(); } catch { return 0; }
}

export { INACTIVE_STAGES };

/** Every lead for the signed-in user (paged past PostgREST's 1,000-row cap, up to 5,000). */
export async function getAllLeads(): Promise<Lead[]> {
  const { supabase, user } = await ctx();
  const rows: Lead[] = [];
  const PAGE = 1000;
  for (let page = 0; page < 5; page++) {
    const { data, error } = await supabase
      .from("leads")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .range(page * PAGE, page * PAGE + PAGE - 1);
    if (error) throw error;
    rows.push(...((data ?? []) as Lead[]));
    if ((data?.length ?? 0) < PAGE) break;
  }
  return rows;
}
