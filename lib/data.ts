import { format } from "date-fns";

import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

type Lead = Database["public"]["Tables"]["leads"]["Row"];
type Note = Database["public"]["Tables"]["notes"]["Row"];
type Message = Database["public"]["Tables"]["messages"]["Row"];
type Followup = Database["public"]["Tables"]["followups"]["Row"];

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

export async function getDashboardData() {
  const { supabase, user } = await requireUser();

  const [leadResponse, messageResponse, followupResponse] = await Promise.all([
    supabase.from("leads").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
    supabase
      .from("messages")
      .select("*")
      .eq("user_id", user.id)
      .eq("direction", "inbound")
      .order("created_at", { ascending: false }),
    supabase
      .from("followups")
      .select("*")
      .eq("user_id", user.id)
      .is("completed_at", null)
      .eq("due_date", format(new Date(), "yyyy-MM-dd"))
      .order("due_date", { ascending: true })
  ]);

  if (leadResponse.error) throw leadResponse.error;
  if (messageResponse.error) throw messageResponse.error;
  if (followupResponse.error) throw followupResponse.error;

  const leads = (leadResponse.data ?? []) as Lead[];
  const messages = (messageResponse.data ?? []) as Message[];
  const followups = (followupResponse.data ?? []) as Followup[];

  return {
    leads,
    stats: {
      total: leads.length,
      contacted: leads.filter((lead) => lead.status === "Contacted").length,
      replied: messages.length,
      hot: leads.filter((lead) => lead.status === "Hot").length,
      followUpsToday: followups.length
    },
    followups
  };
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

  const [leadsResponse, messagesResponse, followupsResponse] = await Promise.all([
    supabase.from("leads").select("*").eq("user_id", user.id).order("updated_at", { ascending: false }),
    supabase.from("messages").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
    supabase
      .from("followups")
      .select("*")
      .eq("user_id", user.id)
      .is("completed_at", null)
      .eq("due_date", today)
      .order("due_date", { ascending: true }),
  ]);

  if (leadsResponse.error) throw leadsResponse.error;
  if (messagesResponse.error) throw messagesResponse.error;
  if (followupsResponse.error) throw followupsResponse.error;

  const leads = (leadsResponse.data ?? []) as Lead[];
  const messages = (messagesResponse.data ?? []) as Message[];
  const dueFollowups = (followupsResponse.data ?? []) as Followup[];

  const counts = {
    totalLeads: leads.length,
    contactedLeads: leads.filter((lead) => Boolean(lead.last_contacted_at) || messages.some((message) => message.lead_id === lead.id && message.direction === "outbound")).length,
    repliesReceived: messages.filter((message) => message.direction === "inbound").length,
    hotLeads: leads.filter((lead) => lead.classification === "HOT").length,
    dueToday: dueFollowups.length,
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

  const dueLeadIds = new Set(dueFollowups.map((followup) => followup.lead_id));
  const dueLeads = leads.filter((lead) => dueLeadIds.has(lead.id)).slice(0, 6);

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
