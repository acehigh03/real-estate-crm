import { format } from "date-fns";

import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

type Lead = Database["public"]["Tables"]["leads"]["Row"];
type Note = Database["public"]["Tables"]["notes"]["Row"];
type Message = Database["public"]["Tables"]["messages"]["Row"];
type Followup = Database["public"]["Tables"]["followups"]["Row"];

export type PipelineStage =
  | "New Leads"
  | "Contacted"
  | "Replied"
  | "Qualified"
  | "Offer Sent"
  | "Dead";

export interface PipelineLeadCard {
  lead: Lead;
  stage: PipelineStage;
  messageCount: number;
  callCount: number;
  followupCount: number;
  daysInPipeline: number;
  lastMessagePreview: string | null;
}

function derivePipelineStage(lead: Lead): PipelineStage {
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
  const { supabase, user } = await requireUser();

  const [leadResponse, noteResponse, followupResponse] = await Promise.all([
    supabase.from("leads").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
    supabase.from("notes").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
    supabase
      .from("followups")
      .select("*")
      .eq("user_id", user.id)
      .order("due_date", { ascending: true })
  ]);

  if (leadResponse.error) throw leadResponse.error;
  if (noteResponse.error) throw noteResponse.error;
  if (followupResponse.error) throw followupResponse.error;

  return {
    leads: (leadResponse.data ?? []) as Lead[],
    notes: (noteResponse.data ?? []) as Note[],
    followups: (followupResponse.data ?? []) as Followup[]
  };
}

export async function getLeadDetailData(leadId: string) {
  const { supabase, user } = await requireUser();

  const [leadResponse, noteResponse, followupResponse, messageResponse] = await Promise.all([
    supabase.from("leads").select("*").eq("user_id", user.id).eq("id", leadId).single(),
    supabase.from("notes").select("*").eq("user_id", user.id).eq("lead_id", leadId).order("created_at", { ascending: false }),
    supabase.from("followups").select("*").eq("user_id", user.id).eq("lead_id", leadId).order("due_date", { ascending: true }),
    supabase.from("messages").select("*").eq("user_id", user.id).eq("lead_id", leadId).order("created_at", { ascending: true }),
  ]);

  if (leadResponse.error) throw leadResponse.error;
  if (noteResponse.error) throw noteResponse.error;
  if (followupResponse.error) throw followupResponse.error;
  if (messageResponse.error) throw messageResponse.error;

  return {
    lead: leadResponse.data as Lead,
    notes: (noteResponse.data ?? []) as Note[],
    followups: (followupResponse.data ?? []) as Followup[],
    messages: (messageResponse.data ?? []) as Message[],
  };
}

export async function getInboxBadgeCount(): Promise<number> {
  const { supabase, user } = await requireUser();
  const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
  const { count } = await supabase
    .from("messages")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("direction", "inbound")
    .gte("created_at", cutoff);
  return count ?? 0;
}

export async function getDashboardStats() {
  const { supabase, user } = await requireUser();
  const today = format(new Date(), "yyyy-MM-dd");

  const [leadsResponse, messagesResponse] = await Promise.all([
    supabase.from("leads").select("*").eq("user_id", user.id).order("updated_at", { ascending: false }),
    supabase.from("messages").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
  ]);

  if (leadsResponse.error) throw leadsResponse.error;
  if (messagesResponse.error) throw messagesResponse.error;

  const leads = (leadsResponse.data ?? []) as Lead[];
  const messages = (messagesResponse.data ?? []) as Message[];
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
  const recentReplies = messages
    .filter((message) => message.direction === "inbound" && message.lead_id)
    .slice(0, 6)
    .map((message) => ({
      message,
      lead: leadsById.get(message.lead_id ?? ""),
    }))
    .filter((entry): entry is { message: Message; lead: Lead } => Boolean(entry.lead));

  return { counts, dueLeads, recentReplies };
}

export async function getInboxData() {
  const { supabase, user } = await requireUser();

  const [leadResponse, messageResponse] = await Promise.all([
    supabase.from("leads").select("*").eq("user_id", user.id).order("updated_at", { ascending: false }),
    supabase.from("messages").select("*").eq("user_id", user.id).order("created_at", { ascending: false })
  ]);

  if (leadResponse.error) throw leadResponse.error;
  if (messageResponse.error) throw messageResponse.error;

  return {
    leads: (leadResponse.data ?? []) as Lead[],
    messages: (messageResponse.data ?? []) as Message[]
  };
}

export async function getPipelineData() {
  const { supabase, user } = await requireUser();

  const [leadResponse, messageResponse, followupResponse] = await Promise.all([
    supabase.from("leads").select("*").eq("user_id", user.id).order("updated_at", { ascending: false }),
    supabase.from("messages").select("*").eq("user_id", user.id),
    supabase.from("followups").select("*").eq("user_id", user.id),
  ]);

  if (leadResponse.error) throw leadResponse.error;
  if (messageResponse.error) throw messageResponse.error;
  if (followupResponse.error) throw followupResponse.error;

  const leads = (leadResponse.data ?? []) as Lead[];
  const messages = (messageResponse.data ?? []) as Message[];
  const followups = (followupResponse.data ?? []) as Followup[];

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
}
