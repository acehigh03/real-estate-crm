/**
 * POST /api/follow-up/process
 *
 * Processes pending items in sms_queue for the authenticated user.
 * Intended to be triggered manually (or by a job that carries the user's session).
 *
 * For each due "pending" queue item:
 *   - Confirms we're inside the user's send window.
 *   - Sends the SMS via Telnyx and records it.
 *   - Marks the queue item sent (or failed) and updates the lead.
 *
 * Returns { processed, sent, skipped }.
 */
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { withErrorHandling } from "@/lib/api";
import { logError, userFacingError } from "@/lib/errors";
import { sendSmsToLead } from "@/lib/leads/send-lead-sms";
import { getRouteUser } from "@/lib/route-user";
import { isInsideWindow } from "@/lib/send-window";

export const POST = withErrorHandling("api/follow-up/process", async () => {
  const { supabase, user } = await getRouteUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: settings, error: settingsError } = await supabase
    .from("sms_settings")
    .select("auto_send_enabled, send_window_start, send_window_end, timezone")
    .eq("user_id", user.id)
    .maybeSingle();

  if (settingsError) {
    logError("api/follow-up/process", settingsError, { step: "load sms_settings" });
    return NextResponse.json({ error: userFacingError(settingsError) }, { status: 500 });
  }

  // If auto-send is disabled or no settings, nothing to process
  if (!settings?.auto_send_enabled) {
    return NextResponse.json({ processed: 0, sent: 0, skipped: 0 });
  }

  if (!isInsideWindow(settings.send_window_start, settings.send_window_end, settings.timezone)) {
    return NextResponse.json({ processed: 0, sent: 0, skipped: 0, reason: "outside_window" });
  }

  const now = new Date().toISOString();

  // Row-level security limits this to queue items whose lead belongs to the user.
  // Items scheduled for a future window open are left alone.
  const { data: queueItems, error: queueError } = await supabase
    .from("sms_queue")
    .select("id, lead_id, message")
    .eq("status", "pending")
    .or(`scheduled_for.is.null,scheduled_for.lte.${now}`)
    .order("created_at", { ascending: true })
    .limit(50);

  if (queueError) {
    logError("api/follow-up/process", queueError, { step: "load sms_queue" });
    return NextResponse.json({ error: userFacingError(queueError) }, { status: 500 });
  }

  if (!queueItems || queueItems.length === 0) {
    return NextResponse.json({ processed: 0, sent: 0, skipped: 0 });
  }

  const { data: leads, error: leadsError } = await supabase
    .from("leads")
    .select("*")
    .eq("user_id", user.id)
    .in("id", queueItems.map((q) => q.lead_id));

  if (leadsError) {
    logError("api/follow-up/process", leadsError, { step: "load leads for queue" });
    return NextResponse.json({ error: userFacingError(leadsError) }, { status: 500 });
  }

  const leadMap = new Map((leads ?? []).map((l) => [l.id, l]));

  let sent = 0;
  let skipped = 0;

  const markQueueItem = async (id: string, patch: { status: string; sent_at?: string }) => {
    const { error } = await supabase.from("sms_queue").update(patch).eq("id", id);
    if (error) logError("api/follow-up/process", error, { step: "update sms_queue item", queueItemId: id });
  };

  for (const item of queueItems) {
    const lead = leadMap.get(item.lead_id);

    // Skip if lead not owned by this user or is DNC
    if (!lead || lead.status === "DNC" || lead.is_dnc) {
      skipped++;
      await markQueueItem(item.id, { status: "skipped" });
      continue;
    }

    const result = await sendSmsToLead({ db: supabase, userId: user.id, lead, message: item.message });

    if (result.ok) {
      await markQueueItem(item.id, { status: "sent", sent_at: now });
      sent++;
    } else {
      console.error("[api/follow-up/process] queued SMS failed", { queueItemId: item.id, error: result.error });
      // Mark failed so it won't retry indefinitely
      await markQueueItem(item.id, { status: "failed" });
      skipped++;
    }
  }

  revalidatePath("/dashboard");
  revalidatePath("/inbox");
  revalidatePath("/pipeline");

  return NextResponse.json({ processed: queueItems.length, sent, skipped });
});
