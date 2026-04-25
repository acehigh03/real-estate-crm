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
