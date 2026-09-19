// Enrollment lifecycle shared by the cron, webhook, API routes and lead page.
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database";
import { renderTemplate } from "./rules";

type Admin = SupabaseClient<Database>;

export async function recordHistory(
  admin: Admin,
  row: { user_id: string | null; lead_id: string | null; automation_type: string; automation_name: string; action_taken: string; result: string }
) {
  const { error } = await admin.from("automation_history").insert({
    ...row,
    action_taken: row.action_taken.slice(0, 300),
    result: row.result.slice(0, 300),
  });
  if (error) console.error("[automation] history insert failed:", error.message);
}

/** Cancels one enrollment and every send that hasn't gone out yet. */
export async function cancelEnrollment(admin: Admin, enrollmentId: string, reason: string) {
  const now = new Date().toISOString();
  const { data, error } = await admin
    .from("drip_enrollments")
    .update({ status: "cancelled", cancelled_at: now, cancel_reason: reason })
    .eq("id", enrollmentId)
    .in("status", ["active", "paused"])
    .select("id, lead_id, user_id, workflow_id");
  if (error) throw error;

  const { error: executionError } = await admin
    .from("drip_executions")
    .update({ status: "cancelled", error: `Cancelled: ${reason}` })
    .eq("enrollment_id", enrollmentId)
    .eq("status", "queued");
  if (executionError) console.error("[automation] cancel executions failed:", executionError.message);

  return data ?? [];
}

/**
 * Cancels the active enrollments of the given leads.
 * `unlessContinueAfterReply` keeps workflows that are set to continue after a reply running.
 */
export async function cancelLeadEnrollments(
  admin: Admin,
  leadIds: string[],
  reason: string,
  { unlessContinueAfterReply = false }: { unlessContinueAfterReply?: boolean } = {}
) {
  if (!leadIds.length) return 0;
  const { data: enrollments, error } = await admin
    .from("drip_enrollments")
    .select("id, workflow_id, lead_id, user_id")
    .in("lead_id", leadIds)
    .in("status", ["active", "paused"]);
  if (error) throw error;
  if (!enrollments?.length) return 0;

  let keep = new Set<string>();
  if (unlessContinueAfterReply) {
    const { data: workflows } = await admin
      .from("drip_workflows")
      .select("id, continue_after_reply")
      .in("id", [...new Set(enrollments.map((row) => row.workflow_id))]);
    keep = new Set((workflows ?? []).filter((workflow) => workflow.continue_after_reply).map((workflow) => workflow.id));
  }

  let cancelled = 0;
  for (const enrollment of enrollments) {
    if (keep.has(enrollment.workflow_id)) continue;
    const rows = await cancelEnrollment(admin, enrollment.id, reason);
    if (rows.length) {
      cancelled += 1;
      await recordHistory(admin, {
        user_id: enrollment.user_id,
        lead_id: enrollment.lead_id,
        automation_type: "drip",
        automation_name: "Drip enrollment",
        action_taken: `Cancelled enrollment (${reason})`,
        result: "cancelled",
      });
    }
  }
  return cancelled;
}

export interface EnrollResult {
  enrolled: Array<{ lead_id: string; enrollment_id: string }>;
  skipped: Array<{ lead_id: string; reason: string }>;
}

/** Creates enrollments and their scheduled sends. Queues only — the cron does the sending. */
export async function enrollLeads(
  admin: Admin,
  { userId, workflowId, leadIds, now = new Date() }: { userId: string; workflowId: string; leadIds: string[]; now?: Date }
): Promise<EnrollResult> {
  const { data: workflow } = await admin.from("drip_workflows").select("*").eq("id", workflowId).eq("user_id", userId).maybeSingle();
  if (!workflow) throw new EnrollError("Workflow not found.", 404);
  if (workflow.status !== "active") throw new EnrollError("Activate the workflow before enrolling leads.", 400);

  const { data: steps } = await admin.from("drip_steps").select("*").eq("workflow_id", workflowId).order("step_number", { ascending: true });
  if (!steps?.length) throw new EnrollError("This workflow has no message steps.", 400);

  const { data: leads, error: leadsError } = await admin.from("leads").select("id, is_dnc, status, last_replied_at, phone").eq("user_id", userId).in("id", leadIds);
  if (leadsError) throw leadsError;

  const result: EnrollResult = { enrolled: [], skipped: [] };
  const found = new Map((leads ?? []).map((lead) => [lead.id, lead]));

  const eligible: NonNullable<typeof leads> = [];
  for (const id of leadIds) {
    const lead = found.get(id);
    if (!lead) result.skipped.push({ lead_id: id, reason: "not_found" });
    else if (lead.is_dnc || lead.status === "DNC") result.skipped.push({ lead_id: id, reason: "opted_out" });
    else if (!lead.phone) result.skipped.push({ lead_id: id, reason: "no_phone" });
    else eligible.push(lead);
  }
  if (!eligible.length) return result;

  const { data: existing } = await admin
    .from("drip_enrollments")
    .select("lead_id, status")
    .eq("workflow_id", workflowId)
    .in("lead_id", eligible.map((lead) => lead.id));
  const already = new Map((existing ?? []).map((row) => [row.lead_id, row.status]));

  const fresh = eligible.filter((lead) => {
    const status = already.get(lead.id);
    if (status) result.skipped.push({ lead_id: lead.id, reason: `already_${status}` });
    return !status;
  });
  if (!fresh.length) return result;

  const { data: created, error: enrollmentError } = await admin
    .from("drip_enrollments")
    .upsert(
      fresh.map((lead) => ({ user_id: userId, workflow_id: workflowId, lead_id: lead.id, last_reply_at_enrollment: lead.last_replied_at })),
      { onConflict: "workflow_id,lead_id", ignoreDuplicates: true }
    )
    .select("id, lead_id");
  if (enrollmentError) throw enrollmentError;

  const executions = (created ?? []).flatMap((enrollment) => {
    let at = now.getTime();
    return steps.map((step) => {
      at += step.delay_minutes * 60_000;
      return { user_id: userId, enrollment_id: enrollment.id, step_id: step.id, scheduled_for: new Date(at).toISOString() };
    });
  });
  if (executions.length) {
    const { error: executionError } = await admin.from("drip_executions").upsert(executions, { onConflict: "enrollment_id,step_id", ignoreDuplicates: true });
    if (executionError) throw executionError;
  }

  for (const row of created ?? []) {
    result.enrolled.push({ lead_id: row.lead_id, enrollment_id: row.id });
    await recordHistory(admin, {
      user_id: userId,
      lead_id: row.lead_id,
      automation_type: "drip",
      automation_name: workflow.name,
      action_taken: `Enrolled in "${workflow.name}" (${steps.length} steps)`,
      result: "enrolled",
    });
  }
  return result;
}

export class EnrollError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = "EnrollError";
    this.status = status;
  }
}

/** Renders every step for one lead — used for the preview shown before enrolling. */
export function previewSteps(
  steps: Array<{ step_number: number; delay_minutes: number; message: string }>,
  lead: { first_name: string | null; last_name: string | null; property_address: string | null; city: string | null },
  now = new Date()
) {
  let at = now.getTime();
  return steps.map((step) => {
    at += step.delay_minutes * 60_000;
    return {
      step_number: step.step_number,
      delay_minutes: step.delay_minutes,
      scheduled_for: new Date(at).toISOString(),
      message: renderTemplate(step.message, lead),
    };
  });
}
