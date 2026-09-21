import type { SupabaseClient } from "@supabase/supabase-js";

import { logError } from "@/lib/errors";
import { sendSmsToLead } from "@/lib/leads/send-lead-sms";
import { isInsideWindow } from "@/lib/send-window";
import type { Database } from "@/types/database";

type Admin = SupabaseClient<Database>;

export interface QueueRunResult {
  claimed: number;
  sent: number;
  failed: number;
  skipped: number;
  deferred: number;
}

/** Processes first-contact messages queued by CSV imports for every user. */
export async function processDueSmsQueue(admin: Admin, now = new Date(), limit = 100): Promise<QueueRunResult> {
  const result: QueueRunResult = { claimed: 0, sent: 0, failed: 0, skipped: 0, deferred: 0 };
  const { data: pending, error: pendingError } = await admin
    .from("sms_queue")
    .select("*")
    .eq("status", "pending")
    .or(`scheduled_for.is.null,scheduled_for.lte.${now.toISOString()}`)
    .order("created_at", { ascending: true })
    .limit(limit);
  if (pendingError) throw pendingError;
  if (!pending?.length) return result;

  const { data: leads, error: leadsError } = await admin
    .from("leads")
    .select("*")
    .in("id", [...new Set(pending.map((item) => item.lead_id))]);
  if (leadsError) throw leadsError;
  const leadById = new Map((leads ?? []).map((lead) => [lead.id, lead]));
  const userIds = [...new Set((leads ?? []).map((lead) => lead.user_id))];
  const { data: settings, error: settingsError } = await admin
    .from("sms_settings")
    .select("user_id, auto_send_enabled, send_window_start, send_window_end, timezone")
    .in("user_id", userIds);
  if (settingsError) throw settingsError;
  const settingsByUser = new Map((settings ?? []).map((row) => [row.user_id, row]));

  for (const item of pending) {
    const lead = leadById.get(item.lead_id);
    if (!lead || lead.is_dnc || lead.status === "DNC") {
      await admin.from("sms_queue").update({ status: "skipped" }).eq("id", item.id).eq("status", "pending");
      result.skipped += 1;
      continue;
    }

    const userSettings = settingsByUser.get(lead.user_id);
    if (!userSettings?.auto_send_enabled) {
      result.deferred += 1;
      continue;
    }
    if (!isInsideWindow(userSettings.send_window_start, userSettings.send_window_end, userSettings.timezone)) {
      result.deferred += 1;
      continue;
    }

    // Claim each row atomically so overlapping cron invocations cannot double-send it.
    const { data: claimed, error: claimError } = await admin
      .from("sms_queue")
      .update({ status: "processing" })
      .eq("id", item.id)
      .eq("status", "pending")
      .select("id")
      .maybeSingle();
    if (claimError) {
      logError("sms/queue-runner", claimError, { queueItemId: item.id, step: "claim" });
      result.failed += 1;
      continue;
    }
    if (!claimed) continue;
    result.claimed += 1;

    const outcome = await sendSmsToLead({ db: admin, userId: lead.user_id, lead, message: item.message });
    if (outcome.ok) {
      await admin.from("sms_queue").update({ status: "sent", sent_at: now.toISOString() }).eq("id", item.id);
      result.sent += 1;
    } else {
      await admin.from("sms_queue").update({ status: "failed" }).eq("id", item.id);
      logError("sms/queue-runner", new Error(outcome.error), { queueItemId: item.id, leadId: lead.id });
      result.failed += 1;
    }
  }

  return result;
}
