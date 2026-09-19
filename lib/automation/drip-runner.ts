// Sends the drip messages that are due. Called by /api/cron/drip.
//
// Safety properties:
//   * Atomic claim: due rows are flipped queued -> processing in ONE update that only matches rows
//     still queued, so two overlapping runs can never send the same message twice.
//   * Compliance: opted-out leads are skipped, sellers who replied stop the sequence (unless the
//     workflow continues after replies), and nothing is sent outside the user's send window
//     (default 9am-8pm America/Chicago) — those rows simply wait for the next run.
//   * One failing row never stops the run; every error is logged and recorded on the row.
import type { SupabaseClient } from "@supabase/supabase-js";

import { isInsideWindow } from "@/lib/send-window";
import { withStopLanguage } from "@/lib/utils";
import type { Database } from "@/types/database";
import { cancelEnrollment, recordHistory } from "./enrollments";
import { renderTemplate } from "./rules";
import { sendAndRecord } from "./send";

type Admin = SupabaseClient<Database>;
type Execution = Database["public"]["Tables"]["drip_executions"]["Row"];
type ExecutionPatch = Database["public"]["Tables"]["drip_executions"]["Update"];

export interface DripRunResult {
  claimed: number;
  processed: number;
  failed: number;
  skipped: number;
  /** Rows put back in the queue (outside send window, or workflow/enrollment paused). */
  deferred: number;
}

const STUCK_AFTER_MS = 30 * 60_000;
const DEFAULT_WINDOW = { send_window_start: "09:00:00", send_window_end: "20:00:00", timezone: "America/Chicago" };

export async function processDueDrips(admin: Admin, now = new Date(), limit = 50): Promise<DripRunResult> {
  const result: DripRunResult = { claimed: 0, processed: 0, failed: 0, skipped: 0, deferred: 0 };

  // A run that died mid-send leaves rows in "processing". We can't know whether the text went out,
  // so they are failed (not retried) — a duplicate text to a seller is worse than a missed one.
  const { error: reclaimError } = await admin
    .from("drip_executions")
    .update({ status: "failed", error: "Interrupted before completion" })
    .eq("status", "processing")
    .lt("updated_at", new Date(now.getTime() - STUCK_AFTER_MS).toISOString());
  if (reclaimError) console.error("[cron/drip] reclaim failed:", reclaimError.message);

  const { data: due, error: dueError } = await admin
    .from("drip_executions")
    .select("id")
    .eq("status", "queued")
    .lte("scheduled_for", now.toISOString())
    .order("scheduled_for", { ascending: true })
    .limit(limit);
  if (dueError) throw dueError;
  if (!due?.length) return result;

  const { data: claimed, error: claimError } = await admin
    .from("drip_executions")
    .update({ status: "processing" })
    .in("id", due.map((row) => row.id))
    .eq("status", "queued")
    .select("*");
  if (claimError) throw claimError;
  if (!claimed?.length) return result;
  result.claimed = claimed.length;

  // Load everything the batch needs in bulk (no per-row queries for lookups).
  const enrollmentIds = [...new Set(claimed.map((row) => row.enrollment_id))];
  const stepIds = [...new Set(claimed.map((row) => row.step_id))];
  const userIds = [...new Set(claimed.map((row) => row.user_id))];

  const [{ data: enrollments }, { data: steps }, { data: settings }] = await Promise.all([
    admin.from("drip_enrollments").select("*").in("id", enrollmentIds),
    admin.from("drip_steps").select("*").in("id", stepIds),
    admin.from("sms_settings").select("user_id, send_window_start, send_window_end, timezone").in("user_id", userIds),
  ]);
  const enrollmentById = new Map((enrollments ?? []).map((row) => [row.id, row]));
  const stepById = new Map((steps ?? []).map((row) => [row.id, row]));
  const settingsByUser = new Map((settings ?? []).map((row) => [row.user_id, row]));

  const [{ data: workflows }, { data: leads }] = await Promise.all([
    admin.from("drip_workflows").select("*").in("id", [...new Set((enrollments ?? []).map((row) => row.workflow_id))]),
    admin.from("leads").select("*").in("id", [...new Set((enrollments ?? []).map((row) => row.lead_id))]),
  ]);
  const workflowById = new Map((workflows ?? []).map((row) => [row.id, row]));
  const leadById = new Map((leads ?? []).map((row) => [row.id, row]));

  const finish = async (execution: Execution, patch: ExecutionPatch) => {
    const { error } = await admin.from("drip_executions").update(patch).eq("id", execution.id);
    if (error) console.error("[cron/drip] could not update execution", execution.id, error.message);
  };
  const requeue = async (execution: Execution) => {
    await finish(execution, { status: "queued" });
    result.deferred += 1;
  };

  for (const execution of claimed) {
    try {
      const enrollment = enrollmentById.get(execution.enrollment_id);
      const step = stepById.get(execution.step_id);
      const workflow = enrollment ? workflowById.get(enrollment.workflow_id) : undefined;
      const lead = enrollment ? leadById.get(enrollment.lead_id) : undefined;

      if (!enrollment || !step || !workflow || !lead) {
        await finish(execution, { status: "skipped", error: "Enrollment, step or lead no longer exists" });
        result.skipped += 1;
        continue;
      }

      // Paused things wait; ended things are cancelled.
      if (enrollment.status === "paused" || workflow.status === "paused" || workflow.status === "draft") {
        await requeue(execution);
        continue;
      }
      if (enrollment.status !== "active" || workflow.status === "archived") {
        await finish(execution, { status: "cancelled", error: `Enrollment ${enrollment.status}` });
        result.skipped += 1;
        continue;
      }

      // 1. Opted out
      if (lead.is_dnc || lead.status === "DNC") {
        await finish(execution, { status: "skipped", error: "Lead is opted out (DNC)" });
        await cancelEnrollment(admin, enrollment.id, "DNC");
        result.skipped += 1;
        await recordHistory(admin, { user_id: execution.user_id, lead_id: lead.id, automation_type: "drip", automation_name: workflow.name, action_taken: `Step ${step.step_number} skipped`, result: "skipped: opted out" });
        continue;
      }

      // 2. Seller replied since enrolling (safety net if the webhook was missed)
      const repliedSince =
        !workflow.continue_after_reply &&
        lead.last_replied_at &&
        (!enrollment.last_reply_at_enrollment || lead.last_replied_at > enrollment.last_reply_at_enrollment);
      if (repliedSince) {
        await finish(execution, { status: "skipped", error: "Seller replied" });
        await cancelEnrollment(admin, enrollment.id, "replied");
        result.skipped += 1;
        await recordHistory(admin, { user_id: execution.user_id, lead_id: lead.id, automation_type: "drip", automation_name: workflow.name, action_taken: `Step ${step.step_number} skipped`, result: "skipped: seller replied" });
        continue;
      }

      // 3. Quiet hours
      const window = settingsByUser.get(execution.user_id) ?? DEFAULT_WINDOW;
      if (!isInsideWindow(window.send_window_start, window.send_window_end, window.timezone)) {
        await requeue(execution);
        continue;
      }

      // 4. Send. Only the first message carries the opt-out line.
      const rendered = renderTemplate(step.message, lead);
      const text = step.step_number === 1 ? withStopLanguage(rendered) : rendered.trim();
      const outcome = await sendAndRecord(admin, { userId: execution.user_id, lead, text });

      if (outcome.ok) {
        await finish(execution, { status: "sent", sent_at: new Date().toISOString(), telnyx_message_id: outcome.telnyxMessageId ?? null, rendered_message: text, error: null });
        result.processed += 1;
        await recordHistory(admin, { user_id: execution.user_id, lead_id: lead.id, automation_type: "drip", automation_name: workflow.name, action_taken: `Sent step ${step.step_number} from ${outcome.from}`, result: "sent" });
      } else {
        await finish(execution, { status: "failed", rendered_message: text, error: (outcome.error ?? "Send failed").slice(0, 500) });
        result.failed += 1;
        await recordHistory(admin, { user_id: execution.user_id, lead_id: lead.id, automation_type: "drip", automation_name: workflow.name, action_taken: `Step ${step.step_number} failed`, result: `failed: ${outcome.error}` });
      }

      // 5. Finished? (no queued/processing sends left)
      const { count } = await admin
        .from("drip_executions")
        .select("id", { count: "exact", head: true })
        .eq("enrollment_id", enrollment.id)
        .in("status", ["queued", "processing"]);
      if (count === 0) {
        await admin.from("drip_enrollments").update({ status: "completed" }).eq("id", enrollment.id).eq("status", "active");
      }
    } catch (error) {
      // Unexpected: mark the row failed so it isn't stuck, and keep going.
      console.error("[cron/drip] unexpected error on execution", execution.id, error);
      await finish(execution, { status: "failed", error: (error instanceof Error ? error.message : "Unexpected error").slice(0, 500) });
      result.failed += 1;
    }
  }

  return result;
}
