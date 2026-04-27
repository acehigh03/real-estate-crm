/**
 * POST /api/follow-up/process
 *
 * Processes pending items in sms_queue for the authenticated user.
 * Intended to be called by a Vercel Cron job or a manual trigger.
 *
 * For each "pending" queue item:
 *   - Checks the lead's owner sms_settings to confirm we're inside the send window.
 *   - Sends the SMS via Telnyx.
 *   - Marks the queue item sent and updates the lead status.
 *
 * Returns { processed, sent, skipped }.
 */
import { NextResponse } from "next/server";

import { getRouteUser } from "@/lib/route-user";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { sendTelnyxMessage, TelnyxSendError } from "@/lib/telnyx/send-sms";
import { isInsideWindow } from "@/lib/send-window";

export async function POST() {
  const { user } = await getRouteUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = getSupabaseAdmin();

  // Fetch user's SMS settings
  const { data: settings } = await supabase
    .from("sms_settings")
    .select("auto_send_enabled, send_window_start, send_window_end, timezone")
    .eq("user_id", user.id)
    .maybeSingle();

  // If auto-send is disabled or no settings, nothing to process
  if (!settings?.auto_send_enabled) {
    return NextResponse.json({ processed: 0, sent: 0, skipped: 0 });
  }

  // Check send window
  if (
    !isInsideWindow(
      settings.send_window_start,
      settings.send_window_end,
      settings.timezone
    )
  ) {
    return NextResponse.json({ processed: 0, sent: 0, skipped: 0, reason: "outside_window" });
  }

  // Fetch pending queue items for this user's leads
  const { data: queueItems, error: queueError } = await supabase
    .from("sms_queue")
    .select("id, lead_id, message")
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(50);

  if (queueError) {
    return NextResponse.json({ error: queueError.message }, { status: 500 });
  }

  if (!queueItems || queueItems.length === 0) {
    return NextResponse.json({ processed: 0, sent: 0, skipped: 0 });
  }

  // Fetch leads for those queue items to confirm ownership and get phone numbers
  const leadIds = queueItems.map((q) => q.lead_id);
  const { data: leads } = await supabase
    .from("leads")
    .select("id, phone_normalized, status, first_name, is_dnc, stage")
    .eq("user_id", user.id)
    .in("id", leadIds);

  const leadMap = new Map((leads ?? []).map((l) => [l.id, l]));

  const now = new Date().toISOString();
  let sent = 0;
  let skipped = 0;

  for (const item of queueItems) {
    const lead = leadMap.get(item.lead_id);

    // Skip if lead not owned by this user or is DNC
    if (!lead || lead.status === "DNC" || lead.is_dnc) {
      skipped++;
      continue;
    }

    try {
      const telnyxResult = await sendTelnyxMessage({
        to: lead.phone_normalized,
        text: item.message,
      });

      await supabase.from("messages").insert({
        user_id: user.id,
        lead_id: lead.id,
        phone: lead.phone_normalized,
        direction: "outbound",
        body: item.message,
        to_number: lead.phone_normalized,
        status: telnyxResult?.to?.[0]?.status ?? "queued",
        telnyx_message_id: telnyxResult?.id ?? null,
      });

      await supabase
        .from("leads")
        .update({ status: "Contacted", stage: lead.stage ?? "Contacted", last_contacted_at: now })
        .eq("id", lead.id);

      await supabase
        .from("sms_queue")
        .update({ status: "sent", sent_at: now })
        .eq("id", item.id);

      sent++;
    } catch (err) {
      if (!(err instanceof TelnyxSendError)) {
        console.error("Unexpected SMS error for queue item", item.id, err);
      }
      // Mark failed so it won't retry indefinitely
      await supabase
        .from("sms_queue")
        .update({ status: "failed" })
        .eq("id", item.id);
      skipped++;
    }
  }

  return NextResponse.json({ processed: queueItems.length, sent, skipped });
}
