"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { classifyLeadMock } from "@/lib/ai/classify-lead";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { normalizePhone } from "@/lib/utils";
import type { Database, LeadClassification, LeadPriority, LeadStage, LeadStatus } from "@/types/database";

type LeadInsert = Database["public"]["Tables"]["leads"]["Insert"];
type LeadUpdate = Database["public"]["Tables"]["leads"]["Update"];
type NoteInsert = Database["public"]["Tables"]["notes"]["Insert"];
type FollowupInsert = Database["public"]["Tables"]["followups"]["Insert"];

export async function signIn(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
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
  const score =
    selectedClassification ? payloadScoreForClassification(classification) : mockClassification.motivationScore;
  const stage = deriveLeadStage(status, classification, nextFollowUpAt);
  const isDnc = status === "DNC" || classification === "OPT_OUT";

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
    motivation_score: score,
    lead_score: score,
    stage,
    priority: deriveLeadPriority(classification),
    is_dnc: isDnc,
    dnc_reason: isDnc ? "Marked DNC manually" : null,
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
    lead_score: mockClassification.motivationScore,
    stage: deriveLeadStage(status, mockClassification.classification, existingLead?.next_follow_up_at ?? null),
    priority: deriveLeadPriority(mockClassification.classification),
    is_dnc: status === "DNC" || mockClassification.classification === "OPT_OUT",
    dnc_reason: status === "DNC" ? "Marked DNC manually" : null,
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
    stage: "Follow Up",
    classification: mockClassification.classification,
    motivation_score: mockClassification.motivationScore,
    lead_score: mockClassification.motivationScore,
    priority: deriveLeadPriority(mockClassification.classification),
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

export async function updatePipelineStage(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const stage = String(formData.get("stage") ?? "") as
    | "New Leads"
    | "Contacted"
    | "Replied"
    | "Qualified"
    | "Offer Sent"
    | "Dead";

  const supabase = await createClient();
  const supabaseAdmin = getSupabaseAdmin();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: existingLead, error: leadError } = await supabaseAdmin
    .from("leads")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (leadError || !existingLead) {
    throw leadError ?? new Error("Lead not found");
  }

  const stageToStatus: Record<typeof stage, LeadStatus> = {
    "New Leads": "New",
    Contacted: "Contacted",
    Replied: "Replied",
    Qualified: "Hot",
    "Offer Sent": existingLead.status === "Dead" || existingLead.status === "DNC" ? "Contacted" : existingLead.status,
    Dead: "Dead",
  };

  const nextStatus = stageToStatus[stage];
  const nextTag =
    stage === "Offer Sent"
      ? "offer-sent"
      : (existingLead.tag ?? "").toLowerCase() === "offer-sent"
        ? null
        : existingLead.tag;
  const nextClassification =
    stage === "Qualified"
      ? "HOT"
      : stage === "Dead"
        ? "DEAD"
        : existingLead.classification;

  const mockClassification = classifyLeadMock({
    status: nextStatus,
    notesSummary:
      stage === "Offer Sent"
        ? `${existingLead.notes_summary ?? ""} offer sent`.trim()
        : existingLead.notes_summary,
    nextFollowUpAt: existingLead.next_follow_up_at,
  });

  const payload: LeadUpdate = {
    status: nextStatus,
    stage: mapPipelineStageToLeadStage(stage),
    tag: nextTag,
    classification: stage === "Offer Sent" ? existingLead.classification : nextClassification || mockClassification.classification,
    motivation_score:
      stage === "Qualified"
        ? 90
        : stage === "Dead"
          ? 5
        : stage === "Offer Sent"
            ? Math.max(existingLead.motivation_score, 70)
            : mockClassification.motivationScore,
    lead_score:
      stage === "Qualified"
        ? 90
        : stage === "Dead"
          ? 5
          : stage === "Offer Sent"
            ? Math.max(existingLead.motivation_score, 70)
            : mockClassification.motivationScore,
    priority: deriveLeadPriority(stage === "Offer Sent" ? existingLead.classification : nextClassification || mockClassification.classification),
    is_dnc: stage === "Dead" ? existingLead.status === "DNC" || existingLead.is_dnc : existingLead.is_dnc,
  };

  const { error } = await supabaseAdmin
    .from("leads")
    .update(payload)
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) throw error;

  revalidatePath("/dashboard");
  revalidatePath("/leads");
  revalidatePath("/inbox");
  revalidatePath("/pipeline");
}

export async function updateForeclosureLead(formData: FormData) {
  const id = String(formData.get("id") ?? "").trim();
  const crmStatus = String(formData.get("crm_status") ?? "").trim() || null;
  const crmNotes = String(formData.get("crm_notes") ?? "").trim() || null;

  const supabase = await createClient();
  const supabaseAdmin = getSupabaseAdmin();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");
  if (!id) throw new Error("Missing foreclosure lead id");

  const { error } = await supabaseAdmin
    .from("foreclosure_leads" as never)
    .update({
      crm_status: crmStatus,
      crm_notes: crmNotes,
    } as never)
    .eq("id", id as never);

  if (error) throw error;

  revalidatePath("/foreclosures");
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

function deriveLeadStage(
  status: LeadStatus,
  classification: LeadClassification,
  nextFollowUpAt: string | null
): LeadStage {
  if (status === "DNC" || classification === "OPT_OUT") return "DNC";
  if (status === "Dead" || classification === "DEAD") return "Closed";
  if (status === "Hot" || classification === "HOT") return "Hot Lead";
  if (nextFollowUpAt) return "Follow Up";
  if (status === "Replied") return "Replied";
  if (status === "Contacted") return "Contacted";
  return "New";
}

function deriveLeadPriority(classification: LeadClassification): LeadPriority {
  if (classification === "HOT") return "high";
  if (classification === "WARM") return "medium";
  return "low";
}

function mapPipelineStageToLeadStage(stage: "New Leads" | "Contacted" | "Replied" | "Qualified" | "Offer Sent" | "Dead"): LeadStage {
  switch (stage) {
    case "New Leads":
      return "New";
    case "Contacted":
      return "Contacted";
    case "Replied":
      return "Replied";
    case "Qualified":
      return "Hot Lead";
    case "Offer Sent":
      return "Closed";
    case "Dead":
      return "Closed";
  }
}
