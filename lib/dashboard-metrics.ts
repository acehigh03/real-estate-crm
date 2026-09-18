// Shared shapes for the dashboard. Kept free of server-only imports so client components can use them.
import type { Database } from "@/types/database";

type Lead = Database["public"]["Tables"]["leads"]["Row"];
type Message = Database["public"]["Tables"]["messages"]["Row"];

export type PipelineStage =
  | "New Leads"
  | "Contacted"
  | "Replied"
  | "Qualified"
  | "Offer Sent"
  | "Dead";

export interface DashboardRevenueMetrics {
  /** Sum of leads.deal_value across active leads (leads with no value entered count as nothing). */
  pipelineValue: number;
  /** How many active leads have a deal value entered. */
  pipelineValuedLeads: number;
  /** Leads with an offer sent and no reply recorded since. */
  offersAwaitingResponse: number;
  /** Active leads whose deadline (tax sale / auction) falls within the next 30 days. */
  dealsAtRisk: number;
  /** How many active leads have any deadline set. */
  deadlinesSet: number;
}

export interface AttentionItem {
  lead: Lead;
  lastMessage: Message | null;
}

/** Sellers who need the user's attention now, most urgent first (lists are capped for display). */
export interface DashboardAttention {
  /** Latest message on the lead is an inbound reply nobody has answered. Longest-waiting first. */
  needsReply: AttentionItem[];
  needsReplyCount: number;
  /** next_follow_up_at is in the past. Most overdue first. */
  overdue: AttentionItem[];
  overdueCount: number;
  /** Offer sent, no reply since. */
  awaitingOffers: AttentionItem[];
  /** Deadline within 30 days, soonest first. */
  atRisk: AttentionItem[];
  /** Hot leads that have no offer yet. */
  hotNoOffer: AttentionItem[];
  hotNoOfferCount: number;
  stageCounts: Record<PipelineStage, number>;
}

export const EMPTY_ATTENTION: DashboardAttention = {
  needsReply: [],
  needsReplyCount: 0,
  overdue: [],
  overdueCount: 0,
  awaitingOffers: [],
  atRisk: [],
  hotNoOffer: [],
  hotNoOfferCount: 0,
  stageCounts: { "New Leads": 0, Contacted: 0, Replied: 0, Qualified: 0, "Offer Sent": 0, Dead: 0 },
};

export const EMPTY_REVENUE_METRICS: DashboardRevenueMetrics = {
  pipelineValue: 0,
  pipelineValuedLeads: 0,
  offersAwaitingResponse: 0,
  dealsAtRisk: 0,
  deadlinesSet: 0,
};
