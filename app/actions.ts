"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { classifyLeadMock } from "@/lib/ai/classify-lead";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { normalizePhone } from "@/lib/utils";
import type { Database, LeadClassification, LeadStatus } from "@/types/database";

type LeadInsert = Database["public"]["Tables"]["leads"]["Insert"];
type LeadUpdate = Database["public"]["Tables"]["leads"]["Update"];
type NoteInsert = Database["public"]["Tables"]["notes"]["Insert"];
type FollowupInsert = Database["public"]["Tables"]["followups"]["Insert"];

export async function signIn(formData: FormData) {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    redirect(`/login?error=${encodeURIComponent(error.message)}`);
  }

  redirect("/dashboard");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function saveLead(formData: FormData) {
  const supabase = await createClient();
  const supabaseAdmin = getSupabaseAdmin();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "New") as LeadStatus;
  const notesSummary = String(formData.get("notes_summary") ?? "") || null;
  const nextFollowUpAt = String(formData.get("next_follow_up_at") ?? "") || null;
  const selectedClassification = String(formData.get("classification") ?? "") as LeadClassification | "";
  const mockClassification = classifyLeadMock({
    status,
    notesSummary,
    nextFollowUpAt,
  });
  const classification =
    selectedClassification ||
    mockClassification.classification;

  const payload: LeadUpdate = {
    first_name: String(formData.get("first_name") ?? ""),
    last_name: String(formData.get("last_name") ?? ""),
    property_address: String(formData.get("property_address") ?? ""),
    mailing_address: String(formData.get("mailing_address") ?? "") || null,
    phone: String(formData.get("phone") ?? ""),
    phone_normalized: normalizePhone(String(formData.get("phone") ?? "")),
    email: String(formData.get("email") ?? "") || null,
    lead_source: String(formData.get("lead_source") ?? "") || null,
    status,
    classification,
    motivation_score: selectedClassification ? payloadScoreForClassification(classification) : mockClassification.motivationScore,
    next_follow_up_at: nextFollowUpAt,
    tag: String(formData.get("tag") ?? "") || null,
    notes_summary: notesSummary,
  };

  const { error } = id
    ? await supabaseAdmin.from("leads").update(payload).eq("id", id).eq("user_id", user.id)
    : await supabaseAdmin.from("leads").insert({ ...(payload as LeadInsert), user_id: user.id });
  if (error) throw error;

  revalidatePath("/dashboard");
  revalidatePath("/leads");
  revalidatePath("/inbox");
  revalidatePath("/pipeline");
}

export async function deleteLead(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const supabase = await createClient();
  const supabaseAdmin = getSupabaseAdmin();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { error } = await supabaseAdmin.from("leads").delete().eq("id", id).eq("user_id", user.id);
  if (error) throw error;

  revalidatePath("/dashboard");
  revalidatePath("/leads");
  revalidatePath("/inbox");
  revalidatePath("/pipeline");
}

export async function updateLeadStatus(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "New") as LeadStatus;
  const supabase = await createClient();
  const supabaseAdmin = getSupabaseAdmin();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: existingLead } = await supabaseAdmin
    .from("leads")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  const mockClassification = classifyLeadMock({
    status,
    notesSummary: existingLead?.notes_summary,
    nextFollowUpAt: existingLead?.next_follow_up_at,
  });

  const statusPayload: LeadUpdate = {
    status,
    classification: mockClassification.classification,
    motivation_score: mockClassification.motivationScore,
  };
  const { error } = await supabaseAdmin
    .from("leads")
    .update(statusPayload)
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) throw error;

  revalidatePath("/dashboard");
  revalidatePath("/leads");
  revalidatePath("/inbox");
  revalidatePath("/pipeline");
}

export async function addNote(formData: FormData) {
  const leadId = String(formData.get("lead_id") ?? "");
  const body = String(formData.get("body") ?? "").trim();
  if (!body) return;

  const supabase = await createClient();
  const supabaseAdmin = getSupabaseAdmin();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const notePayload: NoteInsert = {
    lead_id: leadId,
    body,
    user_id: user.id
  };

  const { error } = await supabaseAdmin.from("notes").insert(notePayload);

  if (error) throw error;

  revalidatePath("/leads");
}

export async function setFollowup(formData: FormData) {
  const leadId = String(formData.get("lead_id") ?? "");
  const dueDate = String(formData.get("due_date") ?? "");
  const note = String(formData.get("note") ?? "") || null;
  const nextFollowUpAt = String(formData.get("next_follow_up_at") ?? "");

  const supabase = await createClient();
  const supabaseAdmin = getSupabaseAdmin();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: existingLead } = await supabaseAdmin
    .from("leads")
    .select("*")
    .eq("id", leadId)
    .eq("user_id", user.id)
    .single();

  const followupPayload: FollowupInsert = {
    lead_id: leadId,
    due_date: dueDate,
    note,
    user_id: user.id
  };

  const { error: followupError } = await supabaseAdmin.from("followups").insert(followupPayload);

  if (followupError) throw followupError;

  const mockClassification = classifyLeadMock({
    status: existingLead?.status ?? "New",
    notesSummary: existingLead?.notes_summary,
    nextFollowUpAt: nextFollowUpAt || dueDate,
  });
  const leadPayload: LeadUpdate = {
    next_follow_up_at: nextFollowUpAt || dueDate,
    classification: mockClassification.classification,
    motivation_score: mockClassification.motivationScore,
  };
  const { error: leadError } = await supabaseAdmin
    .from("leads")
    .update(leadPayload)
    .eq("id", leadId)
    .eq("user_id", user.id);

  if (leadError) throw leadError;

  revalidatePath("/dashboard");
  revalidatePath("/leads");
  revalidatePath(`/leads/${leadId}`);
  revalidatePath("/inbox");
  revalidatePath("/pipeline");
}

function payloadScoreForClassification(classification: LeadClassification) {
  switch (classification) {
    case "HOT":
      return 90;
    case "WARM":
      return 70;
    case "COLD":
      return 40;
    case "DEAD":
      return 5;
    case "OPT_OUT":
      return 0;
    default:
      return 25;
  }
}
