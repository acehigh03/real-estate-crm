// Read models for the drips "active runs" panel and the lead Automations tab.
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database";
import { renderTemplate } from "./rules";

type Admin = SupabaseClient<Database>;

export interface RunRow {
  enrollment_id: string;
  lead_id: string;
  lead_name: string;
  phone: string | null;
  status: string;
  cancel_reason: string | null;
  enrolled_at: string;
  steps_total: number;
  steps_sent: number;
  next_step_number: number | null;
  next_due: string | null;
}

function leadLabel(lead: { first_name: string | null; last_name: string | null; phone: string | null } | undefined) {
  const name = `${lead?.first_name ?? ""} ${lead?.last_name ?? ""}`.trim();
  return name || lead?.phone || "Unknown lead";
}

export async function getWorkflowRuns(admin: Admin, userId: string, workflowId: string): Promise<RunRow[]> {
  const { data: workflow } = await admin.from("drip_workflows").select("id").eq("id", workflowId).eq("user_id", userId).maybeSingle();
  if (!workflow) return [];

  const { data: enrollments } = await admin
    .from("drip_enrollments")
    .select("*")
    .eq("workflow_id", workflowId)
    .eq("user_id", userId)
    .order("enrolled_at", { ascending: false })
    .limit(200);
  if (!enrollments?.length) return [];

  const [{ data: leads }, { data: executions }, { data: steps }] = await Promise.all([
    admin.from("leads").select("id, first_name, last_name, phone").in("id", enrollments.map((row) => row.lead_id)),
    admin.from("drip_executions").select("enrollment_id, step_id, status, scheduled_for").in("enrollment_id", enrollments.map((row) => row.id)),
    admin.from("drip_steps").select("id, step_number").eq("workflow_id", workflowId),
  ]);
  const leadById = new Map((leads ?? []).map((row) => [row.id, row]));
  const stepNumber = new Map((steps ?? []).map((row) => [row.id, row.step_number]));

  return enrollments.map((enrollment) => {
    const mine = (executions ?? []).filter((execution) => execution.enrollment_id === enrollment.id);
    const upcoming = mine
      .filter((execution) => execution.status === "queued" || execution.status === "processing")
      .sort((a, b) => a.scheduled_for.localeCompare(b.scheduled_for))[0];
    const lead = leadById.get(enrollment.lead_id);
    return {
      enrollment_id: enrollment.id,
      lead_id: enrollment.lead_id,
      lead_name: leadLabel(lead),
      phone: lead?.phone ?? null,
      status: enrollment.status,
      cancel_reason: enrollment.cancel_reason,
      enrolled_at: enrollment.enrolled_at,
      steps_total: mine.length,
      steps_sent: mine.filter((execution) => execution.status === "sent" || execution.status === "delivered").length,
      next_step_number: upcoming ? (stepNumber.get(upcoming.step_id) ?? null) : null,
      next_due: upcoming?.scheduled_for ?? null,
    };
  });
}

export async function getLeadAutomations(admin: Admin, userId: string, leadId: string) {
  const { data: lead } = await admin.from("leads").select("*").eq("id", leadId).eq("user_id", userId).maybeSingle();
  if (!lead) return null;

  const { data: enrollments } = await admin.from("drip_enrollments").select("*").eq("lead_id", leadId).eq("user_id", userId).order("enrolled_at", { ascending: false });
  const workflowIds = [...new Set((enrollments ?? []).map((row) => row.workflow_id))];

  const [{ data: workflows }, { data: executions }, { data: allWorkflows }, { data: history }, { data: classifications }] = await Promise.all([
    workflowIds.length ? admin.from("drip_workflows").select("id, name, status").in("id", workflowIds) : Promise.resolve({ data: [] as Array<{ id: string; name: string; status: string }> }),
    (enrollments ?? []).length
      ? admin.from("drip_executions").select("*").in("enrollment_id", (enrollments ?? []).map((row) => row.id)).order("scheduled_for", { ascending: true })
      : Promise.resolve({ data: [] as Database["public"]["Tables"]["drip_executions"]["Row"][] }),
    admin.from("drip_workflows").select("id, name, status").eq("user_id", userId).order("name", { ascending: true }),
    admin.from("automation_history").select("*").eq("lead_id", leadId).eq("user_id", userId).order("created_at", { ascending: false }).limit(60),
    admin.from("reply_classifications").select("message_id, sentiment, classified_at").eq("lead_id", leadId).eq("user_id", userId).order("classified_at", { ascending: false }).limit(1),
  ]);

  const stepIds = [...new Set((executions ?? []).map((row) => row.step_id))];
  const { data: steps } = stepIds.length
    ? await admin.from("drip_steps").select("id, step_number, message").in("id", stepIds)
    : { data: [] as Array<{ id: string; step_number: number; message: string }> };
  const stepById = new Map((steps ?? []).map((row) => [row.id, row]));
  const workflowName = new Map((workflows ?? []).map((row) => [row.id, row.name]));

  const runs = (enrollments ?? []).map((enrollment) => {
    const items = (executions ?? [])
      .filter((execution) => execution.enrollment_id === enrollment.id)
      .map((execution) => {
        const step = stepById.get(execution.step_id);
        return {
          id: execution.id,
          step_number: step?.step_number ?? 0,
          scheduled_for: execution.scheduled_for,
          sent_at: execution.sent_at,
          status: execution.status,
          error: execution.error,
          message: execution.rendered_message ?? (step ? renderTemplate(step.message, lead) : ""),
        };
      })
      .sort((a, b) => a.step_number - b.step_number);
    const next = items.find((item) => item.status === "queued" || item.status === "processing");
    return {
      enrollment_id: enrollment.id,
      workflow_id: enrollment.workflow_id,
      workflow_name: workflowName.get(enrollment.workflow_id) ?? "Workflow",
      status: enrollment.status,
      cancel_reason: enrollment.cancel_reason,
      started_at: enrollment.enrolled_at,
      next_due: next?.scheduled_for ?? null,
      executions: items,
    };
  });

  return {
    lead: { id: lead.id, first_name: lead.first_name, last_name: lead.last_name, phone: lead.phone, property_address: lead.property_address, is_dnc: lead.is_dnc },
    runs,
    history: history ?? [],
    last_sentiment: classifications?.[0]?.sentiment ?? null,
    workflows: allWorkflows ?? [],
  };
}
