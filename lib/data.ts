import { format } from "date-fns";

import { createClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type { Database } from "@/types/database";
import {
  EMPTY_ATTENTION,
  EMPTY_REVENUE_METRICS,
  type AttentionItem,
  type DashboardAttention,
  type DashboardRevenueMetrics,
  type PipelineStage,
} from "@/lib/dashboard-metrics";

export { EMPTY_ATTENTION, EMPTY_REVENUE_METRICS };
export type { AttentionItem, DashboardAttention, DashboardRevenueMetrics };

type Campaign = Database["public"]["Tables"]["campaigns"]["Row"];

type Lead = Database["public"]["Tables"]["leads"]["Row"];
type Note = Database["public"]["Tables"]["notes"]["Row"];
type Message = Database["public"]["Tables"]["messages"]["Row"];
type Followup = Database["public"]["Tables"]["followups"]["Row"];
type ForeclosureLeadRow = Database["public"]["Tables"]["foreclosure_leads"]["Row"];

export type { PipelineStage } from "@/lib/dashboard-metrics";

export interface PipelineLeadCard {
  lead: Lead;
  stage: PipelineStage;
  messageCount: number;
  callCount: number;
  followupCount: number;
  daysInPipeline: number;
  lastMessagePreview: string | null;
  campaignName: string | null;
}

export interface ForeclosureLeadView {
  id: string;
  displayName: string;
  phone: string;
  email: string | null;
  propertyAddress: string;
  cityStateZip: string;
  campaignName: string | null;
  campaignType: string | null;
  crmStatus: string;
  crmNotes: string;
  createdAt: string | null;
  updatedAt: string | null;
}

const FORECLOSURE_SELECT = [
  "id",
  "owner_name",
  "first_name",
  "last_name",
  "name",
  "full_name",
  "phone",
  "email",
  "property_address",
  "address",
  "city",
  "state",
  "zip",
  "campaign_name",
  "campaign_type",
  "crm_status",
  "crm_notes",
  "created_at",
  "updated_at",
].join(", ");

function isMissingRelationError(error: { code?: string; message?: string } | null | undefined) {
  return error?.code === "42P01" || /relation .* does not exist/i.test(error?.message ?? "");
}

function pickFirstString(row: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return "";
}

function normalizeForeclosureLead(row: ForeclosureLeadRow): ForeclosureLeadView {
  const raw = row as unknown as Record<string, unknown>;
  const firstName = pickFirstString(raw, ["first_name"]);
  const lastName = pickFirstString(raw, ["last_name"]);
  const fullName =
    pickFirstString(raw, ["full_name", "owner_name", "name"]) ||
    `${firstName} ${lastName}`.trim();
  const phone = pickFirstString(raw, ["phone", "mobile_phone", "cell_phone"]);
  const propertyAddress = pickFirstString(raw, ["property_address", "address", "street_address"]);
  const campaignName = pickFirstString(raw, ["campaign_name"]);
  const campaignType = pickFirstString(raw, ["campaign_type"]);
  const city = pickFirstString(raw, ["city"]);
  const state = pickFirstString(raw, ["state"]);
  const zip = pickFirstString(raw, ["zip", "postal_code"]);

  return {
    id: String(raw.id ?? ""),
    displayName: fullName || phone || "Foreclosure lead",
    phone,
    email: pickFirstString(raw, ["email"]) || null,
    propertyAddress,
    cityStateZip: [city, state, zip].filter(Boolean).join(", "),
    campaignName: campaignName || null,
    campaignType: campaignType || null,
    crmStatus: pickFirstString(raw, ["crm_status"]) || "new",
    crmNotes: pickFirstString(raw, ["crm_notes"]) || "",
    createdAt: typeof raw.created_at === "string" ? raw.created_at : null,
    updatedAt: typeof raw.updated_at === "string" ? raw.updated_at : null,
  };
}

function logDataLoaderFailure(loader: string, error: unknown) {
  console.error(`${loader} failed:`, error);
}

async function safeFetchMessages(
  query: PromiseLike<{ data: Message[] | null; error: { code?: string; message?: string } | null }>
): Promise<Message[]> {
  try {
    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []) as Message[];
  } catch (error) {
    console.error("messages query failed:", error);
    return [];
  }
}

async function safeCountMessages(
  query: PromiseLike<{ count: number | null; error: { code?: string; message?: string } | null }>
): Promise<number> {
  try {
    const { count, error } = await query;
    if (error) throw error;
    return count ?? 0;
  } catch (error) {
    console.error("messages query failed:", error);
    return 0;
  }
}

function derivePipelineStage(lead: Lead): PipelineStage {
  if (lead.stage === "New") return "New Leads";
  if (lead.stage === "Contacted") return "Contacted";
  if (lead.stage === "Replied" || lead.stage === "Follow Up") return "Replied";
  if (lead.stage === "Hot Lead") return "Qualified";
  if (lead.stage === "Offer Sent") return "Offer Sent";
  if (lead.stage === "Dead" || lead.stage === "DNC") return "Dead";
  // Legacy rows: "Closed" used to mean both Offer Sent and Dead. Dead-looking leads are Dead.
  if (lead.stage === "Closed") {
    const looksDead =
      lead.status === "Dead" || lead.status === "DNC" || lead.classification === "DEAD" || lead.classification === "OPT_OUT";
    return looksDead ? "Dead" : "Offer Sent";
  }

  const tag = (lead.tag ?? "").toLowerCase();
  const summary = (lead.notes_summary ?? "").toLowerCase();
  const hasOfferSignal = tag.includes("offer") || summary.includes("offer sent");

  if (lead.status === "Dead" || lead.status === "DNC" || lead.classification === "DEAD" || lead.classification === "OPT_OUT") {
    return "Dead";
  }

  if (hasOfferSignal) {
    return "Offer Sent";
  }

  if (lead.status === "Hot" || lead.classification === "HOT") {
    return "Qualified";
  }

  if (lead.status === "Replied") {
    return "Replied";
  }

  if (lead.status === "Contacted") {
    return "Contacted";
  }

  return "New Leads";
}

/** Same offer signal the pipeline uses: an "offer" tag or "offer sent" in the lead summary. */
function hasOfferSent(lead: Lead) {
  const tag = (lead.tag ?? "").toLowerCase();
  const summary = (lead.notes_summary ?? "").toLowerCase();
  return tag.includes("offer") || summary.includes("offer sent");
}

export async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Unauthorized");
  }

  return { supabase, user };
}

export async function getLeadsPageData() {
  try {
    const { supabase, user } = await requireUser();

    const [leadResponse, noteResponse, followupResponse, campaignResponse] = await Promise.all([
      supabase.from("leads").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
      supabase.from("notes").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
      supabase.from("followups").select("*").eq("user_id", user.id).order("due_date", { ascending: true }),
      supabase.from("campaigns").select("id, name, campaign_type").eq("user_id", user.id).order("created_at", { ascending: false }),
    ]);

    if (leadResponse.error || noteResponse.error || followupResponse.error || campaignResponse.error) {
      const loaderError =
        leadResponse.error ?? noteResponse.error ?? followupResponse.error ?? campaignResponse.error;
      throw loaderError;
    }

    return {
      leads: (leadResponse.data ?? []) as Lead[],
      notes: (noteResponse.data ?? []) as Note[],
      followups: (followupResponse.data ?? []) as Followup[],
      campaigns: (campaignResponse.data ?? []) as Pick<Campaign, "id" | "name" | "campaign_type">[],
    };
  } catch (error) {
    logDataLoaderFailure("getLeadsPageData", error);
    return { leads: [], notes: [], followups: [], campaigns: [] };
  }
}

export async function getCampaignsData() {
  try {
    const { supabase, user } = await requireUser();

    const { data, error } = await supabase
      .from("campaigns")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return (data ?? []) as Campaign[];
  } catch (error) {
    logDataLoaderFailure("getCampaignsData", error);
    return [];
  }
}

export async function getCampaignCount(): Promise<number> {
  try {
    const { supabase, user } = await requireUser();
    const { count, error } = await supabase
      .from("campaigns")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id);
    if (error) throw error;
    return count ?? 0;
  } catch (error) {
    logDataLoaderFailure("getCampaignCount", error);
    return 0;
  }
}

export async function getLeadDetailData(leadId: string) {
  const { supabase, user } = await requireUser();

  const [leadResponse, noteResponse, followupResponse, messages, campaignResponse] = await Promise.all([
    supabase.from("leads").select("*").eq("user_id", user.id).eq("id", leadId).single(),
    supabase.from("notes").select("*").eq("user_id", user.id).eq("lead_id", leadId).order("created_at", { ascending: false }),
    supabase.from("followups").select("*").eq("user_id", user.id).eq("lead_id", leadId).order("due_date", { ascending: true }),
    safeFetchMessages(
      supabase.from("messages").select("*").eq("user_id", user.id).eq("lead_id", leadId).order("created_at", { ascending: true })
    ),
    supabase.from("campaigns").select("id, name, campaign_type").eq("user_id", user.id),
  ]);

  if (leadResponse.error) throw leadResponse.error;
  if (noteResponse.error) throw noteResponse.error;
  if (followupResponse.error) throw followupResponse.error;
  if (campaignResponse.error) throw campaignResponse.error;
  const lead = leadResponse.data as Lead;
  const campaigns = (campaignResponse.data ?? []) as Array<Pick<Campaign, "id" | "name" | "campaign_type">>;

  const campaign =
    lead.campaign_id
      ? campaigns.find((item) => item.id === lead.campaign_id) ?? null
      : null;
  const lastInboundMessage =
    messages.filter((message) => message.direction === "inbound").at(-1) ?? null;

  return {
    lead,
    notes: (noteResponse.data ?? []) as Note[],
    followups: (followupResponse.data ?? []) as Followup[],
    messages,
    campaign: campaign ? { id: campaign.id, name: campaign.name, campaign_type: campaign.campaign_type } : null,
    lastInboundMessage: lastInboundMessage as Message | null,
  };
}

export async function getInboxBadgeCount(): Promise<number> {
  const { supabase, user } = await requireUser();
  const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
  return safeCountMessages(
    supabase
      .from("messages")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("direction", "inbound")
      .gte("created_at", cutoff)
  );
}

export async function getDashboardStats() {
  try {
    const { supabase, user } = await requireUser();
    const today = format(new Date(), "yyyy-MM-dd");

    const [leadsResponse, messages, campaignsResponse] = await Promise.all([
      supabase.from("leads").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
      safeFetchMessages(
        supabase.from("messages").select("*").eq("user_id", user.id).order("created_at", { ascending: false })
      ),
      supabase
        .from("campaigns")
        .select("id, name, campaign_type, messaged_count, replied_count, hot_count, total_leads")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false }),
    ]);

    if (leadsResponse.error || campaignsResponse.error) {
      const loaderError = leadsResponse.error ?? campaignsResponse.error;
      throw loaderError;
    }

    const leads = (leadsResponse.data ?? []) as Lead[];
    const campaigns = (campaignsResponse.data ?? []) as Array<
      Pick<Campaign, "id" | "name" | "campaign_type" | "messaged_count" | "replied_count" | "hot_count" | "total_leads">
    >;
    const allDueLeads = leads.filter(
      (lead) => lead.next_follow_up_at && format(new Date(lead.next_follow_up_at), "yyyy-MM-dd") === today
    );
    const dueLeads = allDueLeads.slice(0, 6);

    const counts = {
      totalLeads: leads.length,
      contactedLeads: leads.filter((lead) => Boolean(lead.last_contacted_at) || messages.some((message) => message.lead_id === lead.id && message.direction === "outbound")).length,
      repliesReceived: messages.filter((message) => message.direction === "inbound").length,
      hotLeads: leads.filter((lead) => lead.classification === "HOT").length,
      dueToday: allDueLeads.length,
    };

    const leadsById = new Map(leads.map((lead) => [lead.id, lead]));
    const messageGroups = new Map<string, Message[]>();
    for (const message of messages) {
      if (!message.lead_id) continue;
      messageGroups.set(message.lead_id, [...(messageGroups.get(message.lead_id) ?? []), message]);
    }
    const recentReplies = messages
      .filter((message) => message.direction === "inbound" && message.lead_id)
      .slice(0, 6)
      .map((message) => ({
        message,
        lead: leadsById.get(message.lead_id ?? ""),
      }))
      .filter((entry): entry is { message: Message; lead: Lead } => Boolean(entry.lead));

    const hotLeadRows = leads
      .filter((lead) => lead.classification === "HOT")
      .slice(0, 6)
      .map((lead) => ({
        lead,
        lastMessage:
          [...(messageGroups.get(lead.id) ?? [])]
            .sort((left, right) => right.created_at.localeCompare(left.created_at))[0] ?? null,
      }));

    // ── Revenue metrics — real fields only ────────────────────────────────────
    // Latest message per lead, by timestamp (independent of the order the rows arrived in).
    const latestMessageByLead = new Map<string, Message>();
    for (const message of messages) {
      if (!message.lead_id) continue;
      const current = latestMessageByLead.get(message.lead_id);
      if (!current || message.created_at > current.created_at) {
        latestMessageByLead.set(message.lead_id, message);
      }
    }

    const isOpen = (lead: Lead) => !lead.is_dnc && lead.status !== "DNC" && lead.status !== "Dead";
    const toItem = (lead: Lead): AttentionItem => ({ lead, lastMessage: latestMessageByLead.get(lead.id) ?? null });
    const awaitingOfferLeads = leads.filter(
      (lead) => hasOfferSent(lead) && isOpen(lead) && latestMessageByLead.get(lead.id)?.direction !== "inbound"
    );

    // Pipeline value and deadlines come from the investor-entered fields on the lead page
    // (leads.deal_value / leads.deadline). Rows from a database that predates the migration
    // simply have neither, so both cards fall back to 0 instead of failing.
    const valued = leads.filter((lead) => isOpen(lead) && lead.deal_value != null && Number.isFinite(Number(lead.deal_value)));
    const horizon = format(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), "yyyy-MM-dd");
    const withDeadline = leads.filter((lead) => isOpen(lead) && lead.deadline);
    const atRiskAll = withDeadline
      .filter((lead) => (lead.deadline as string) >= today && (lead.deadline as string) <= horizon)
      .sort((a, b) => (a.deadline as string).localeCompare(b.deadline as string));

    const revenue: DashboardRevenueMetrics = {
      pipelineValue: valued.reduce((sum, lead) => sum + Number(lead.deal_value), 0),
      pipelineValuedLeads: valued.length,

      // "Offer sent" is only recorded as a tag/summary flag (no offer_sent_at). An offer is
      // awaiting a response while the latest message on the lead is not an inbound reply.
      offersAwaitingResponse: awaitingOfferLeads.length,

      dealsAtRisk: atRiskAll.length,
      deadlinesSet: withDeadline.length,
    };

    const nowIso = new Date().toISOString();
    const needsReplyAll = leads
      .filter(isOpen)
      .map(toItem)
      .filter((item) => item.lastMessage?.direction === "inbound")
      .sort((a, b) => (a.lastMessage?.created_at ?? "").localeCompare(b.lastMessage?.created_at ?? ""));
    const overdueAll = leads
      .filter((lead) => isOpen(lead) && lead.next_follow_up_at && lead.next_follow_up_at < nowIso)
      .map(toItem)
      .sort((a, b) => (a.lead.next_follow_up_at ?? "").localeCompare(b.lead.next_follow_up_at ?? ""));

    const hotNoOfferAll = leads.filter((lead) => isOpen(lead) && lead.classification === "HOT" && !hasOfferSent(lead));

    const stageCounts = { ...EMPTY_ATTENTION.stageCounts };
    for (const lead of leads) stageCounts[derivePipelineStage(lead)] += 1;

    const attention: DashboardAttention = {
      needsReply: needsReplyAll.slice(0, 10),
      needsReplyCount: needsReplyAll.length,
      overdue: overdueAll.slice(0, 10),
      overdueCount: overdueAll.length,
      awaitingOffers: awaitingOfferLeads.map(toItem).slice(0, 10),
      atRisk: atRiskAll.map(toItem).slice(0, 10),
      hotNoOffer: hotNoOfferAll.map(toItem).slice(0, 10),
      hotNoOfferCount: hotNoOfferAll.length,
      stageCounts,
    };

    const campaignPerformance = campaigns.map((campaign) => ({
      ...campaign,
      conversionRate:
        campaign.messaged_count > 0
          ? Math.round((campaign.hot_count / campaign.messaged_count) * 1000) / 10
          : 0,
    }));

    return { counts, dueLeads, recentReplies, hotLeadRows, campaignPerformance, revenue, attention };
  } catch (error) {
    logDataLoaderFailure("getDashboardStats", error);
    return {
      counts: {
        totalLeads: 0,
        contactedLeads: 0,
        repliesReceived: 0,
        hotLeads: 0,
        dueToday: 0,
      },
      dueLeads: [],
      recentReplies: [],
      hotLeadRows: [],
      campaignPerformance: [],
      revenue: EMPTY_REVENUE_METRICS,
      attention: EMPTY_ATTENTION,
    };
  }
}

export async function getInboxData() {
  try {
    const { supabase, user } = await requireUser();

    const [leadResponse, messages, campaignResponse] = await Promise.all([
      supabase.from("leads").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
      safeFetchMessages(
        supabase.from("messages").select("*").eq("user_id", user.id).order("created_at", { ascending: false })
      ),
      supabase.from("campaigns").select("id, name, campaign_type").eq("user_id", user.id),
    ]);

    if (leadResponse.error || campaignResponse.error) {
      const loaderError = leadResponse.error ?? campaignResponse.error;
      throw loaderError;
    }

    return {
      leads: (leadResponse.data ?? []) as Lead[],
      messages,
      campaigns: (campaignResponse.data ?? []) as Pick<Campaign, "id" | "name" | "campaign_type">[],
    };
  } catch (error) {
    logDataLoaderFailure("getInboxData", error);
    return { leads: [], messages: [], campaigns: [] };
  }
}

export async function getPipelineData() {
  try {
    const { supabase, user } = await requireUser();

    const [leadResponse, messages, followupResponse, campaignResponse] = await Promise.all([
      supabase.from("leads").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
      safeFetchMessages(
        supabase.from("messages").select("*").eq("user_id", user.id)
      ),
      supabase.from("followups").select("*").eq("user_id", user.id),
      supabase.from("campaigns").select("id, name, campaign_type").eq("user_id", user.id),
    ]);

    if (leadResponse.error || followupResponse.error || campaignResponse.error) {
      const loaderError = leadResponse.error ?? followupResponse.error ?? campaignResponse.error;
      throw loaderError;
    }

    const leads = (leadResponse.data ?? []) as Lead[];
    const followups = (followupResponse.data ?? []) as Followup[];
    const campaigns = (campaignResponse.data ?? []) as Array<Pick<Campaign, "id" | "name" | "campaign_type">>;
    const campaignById = new Map(
      campaigns.map((campaign) => [campaign.id, campaign])
    );

    const messageCountByLead = new Map<string, number>();
    const latestMessageByLead = new Map<string, Message>();
    for (const message of messages) {
      if (!message.lead_id) continue;
      messageCountByLead.set(message.lead_id, (messageCountByLead.get(message.lead_id) ?? 0) + 1);
      const currentLatest = latestMessageByLead.get(message.lead_id);
      if (!currentLatest || currentLatest.created_at < message.created_at) {
        latestMessageByLead.set(message.lead_id, message);
      }
    }

    const followupCountByLead = new Map<string, number>();
    for (const followup of followups) {
      followupCountByLead.set(followup.lead_id, (followupCountByLead.get(followup.lead_id) ?? 0) + 1);
    }

    const cards: PipelineLeadCard[] = leads.map((lead) => ({
      lead,
      stage: derivePipelineStage(lead),
      messageCount: messageCountByLead.get(lead.id) ?? 0,
      callCount: 0,
      followupCount: followupCountByLead.get(lead.id) ?? 0,
      daysInPipeline: Math.max(0, Math.floor((Date.now() - new Date(lead.created_at).getTime()) / (1000 * 60 * 60 * 24))),
      lastMessagePreview: latestMessageByLead.get(lead.id)?.body ?? null,
      campaignName: lead.campaign_id ? campaignById.get(lead.campaign_id)?.name ?? campaignById.get(lead.campaign_id)?.campaign_type ?? null : null,
    }));

    const stageOrder: PipelineStage[] = [
      "New Leads",
      "Contacted",
      "Replied",
      "Qualified",
      "Offer Sent",
      "Dead",
    ];

    return {
      stageOrder,
      cards,
    };
  } catch (error) {
    logDataLoaderFailure("getPipelineData", error);
    return {
      stageOrder: ["New Leads", "Contacted", "Replied", "Qualified", "Offer Sent", "Dead"] as PipelineStage[],
      cards: [],
    };
  }
}

export async function getContactsData() {
  try {
    const { supabase, user } = await requireUser();

    const [leadResponse, messages] = await Promise.all([
      supabase
        .from("leads")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false }),
      safeFetchMessages(
        supabase
          .from("messages")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(500)
      ),
    ]);

    if (leadResponse.error) throw leadResponse.error;

    return {
      leads: (leadResponse.data ?? []) as Lead[],
      messages,
    };
  } catch (error) {
    logDataLoaderFailure("getContactsData", error);
    return { leads: [], messages: [] as Message[] };
  }
}

// ── Scheduled follow-ups, sent-text log, and tags (all read-only, from existing columns) ──────

export async function getScheduledData() {
  try {
    const { supabase, user } = await requireUser();
    const { data, error } = await supabase
      .from("leads")
      .select("*")
      .eq("user_id", user.id)
      .not("next_follow_up_at", "is", null)
      .order("next_follow_up_at", { ascending: true })
      .limit(500);
    if (error) throw error;

    return {
      leads: ((data ?? []) as Lead[]).filter(
        (lead) => Boolean(lead.next_follow_up_at) && !lead.is_dnc && lead.status !== "DNC" && lead.status !== "Dead"
      ),
    };
  } catch (error) {
    logDataLoaderFailure("getScheduledData", error);
    return { leads: [] as Lead[], failed: true };
  }
}

export interface SentTextRow {
  message: Message;
  lead: Pick<Lead, "id" | "first_name" | "last_name" | "phone"> | null;
}

export async function getCallLogsData(limit = 200) {
  try {
    const { supabase, user } = await requireUser();
    const [messageResponse, leadResponse] = await Promise.all([
      supabase
        .from("messages")
        .select("*")
        .eq("user_id", user.id)
        .eq("direction", "outbound")
        .order("created_at", { ascending: false })
        .limit(limit),
      supabase.from("leads").select("id, first_name, last_name, phone").eq("user_id", user.id),
    ]);
    if (messageResponse.error) throw messageResponse.error;
    if (leadResponse.error) throw leadResponse.error;

    const leadsById = new Map((leadResponse.data ?? []).map((lead) => [lead.id, lead]));
    const rows: SentTextRow[] = ((messageResponse.data ?? []) as Message[]).map((message) => ({
      message,
      lead: message.lead_id ? (leadsById.get(message.lead_id) ?? null) : null,
    }));
    return { rows, limit };
  } catch (error) {
    logDataLoaderFailure("getCallLogsData", error);
    return { rows: [] as SentTextRow[], limit, failed: true };
  }
}

export interface TagGroup {
  tag: string;
  leads: Array<Pick<Lead, "id" | "first_name" | "last_name" | "phone" | "property_address" | "status">>;
}

export async function getTagsData() {
  try {
    const { supabase, user } = await requireUser();
    const { data, error } = await supabase
      .from("leads")
      .select("id, first_name, last_name, phone, property_address, status, tag")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    if (error) throw error;

    // `leads.tag` is one free-text label per lead; group case-insensitively, keep first spelling.
    const groups = new Map<string, TagGroup>();
    let untagged = 0;
    for (const lead of data ?? []) {
      const labels = (lead.tag ?? "").split(",").map((label: string) => label.trim()).filter(Boolean);
      if (labels.length === 0) {
        untagged += 1;
        continue;
      }
      for (const label of labels) {
        const key = label.toLowerCase();
        const group = groups.get(key) ?? { tag: label, leads: [] };
        group.leads.push(lead);
        groups.set(key, group);
      }
    }

    return {
      groups: [...groups.values()].sort((a, b) => b.leads.length - a.leads.length || a.tag.localeCompare(b.tag)),
      untagged,
    };
  } catch (error) {
    logDataLoaderFailure("getTagsData", error);
    return { groups: [] as TagGroup[], untagged: 0, failed: true };
  }
}

export async function getForeclosuresData() {
  try {
    const { user } = await requireUser();
    const supabaseAdmin = getSupabaseAdmin();

    const { data, error } = await supabaseAdmin
      .from("foreclosure_leads" as never)
      .select(FORECLOSURE_SELECT as never)
      .limit(250);

    if (error) throw error;

    return {
      rows: ((data ?? []) as ForeclosureLeadRow[]).map(normalizeForeclosureLead),
      tableMissing: false,
      userId: user.id,
    };
  } catch (error) {
    logDataLoaderFailure("getForeclosuresData", error);
    return {
      rows: [] as ForeclosureLeadView[],
      tableMissing: true,
      userId: "",
    };
  }
}
