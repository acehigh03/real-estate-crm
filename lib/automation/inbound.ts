// Runs the automation pipeline for one inbound SMS. Called from the Telnyx webhook AFTER the
// message has been saved and the 200 response sent, so nothing here can lose a message or make
// Telnyx retry.
import type { SupabaseClient } from "@supabase/supabase-js";

import { logError } from "@/lib/errors";
import { sendTelnyxMessage } from "@/lib/telnyx/send-sms";
import { normalizePhone } from "@/lib/utils";
import type { Database, Json } from "@/types/database";
import { cancelLeadEnrollments, recordHistory } from "./enrollments";
import { addTag, actionSchema, conditionsPass, matchesTrigger, renderTemplate, senderNumbers, STAGE_WRITE, pickSenderNumber, type AutomationAction } from "./rules";
import type { SentimentResult } from "./sentiment";

type Admin = SupabaseClient<Database>;
type Lead = Database["public"]["Tables"]["leads"]["Row"];

// Auto-reply brakes: two auto-repliers (ours and a seller's bot) must never loop.
const AUTO_SMS_COOLDOWN_MS = 10 * 60_000;
const AUTO_SMS_DAILY_CAP = 5;

export interface InboundAutomationResult {
  duplicate: boolean;
  sentiment: string;
  cancelledEnrollments: number;
  respondersRun: string[];
}

export async function runInboundAutomation(
  admin: Admin,
  args: { lead: Lead; fromPhone: string; body: string; messageId: string | null; toNumber: string | null; sentiment: SentimentResult }
): Promise<InboundAutomationResult> {
  const { lead, fromPhone, body, messageId, toNumber, sentiment } = args;
  const result: InboundAutomationResult = { duplicate: false, sentiment: sentiment.sentiment, cancelledEnrollments: 0, respondersRun: [] };

  // 1. Store the classification. A webhook retry hits the unique message_id and stops here, so the
  //    same reply is never run through the auto-responders twice.
  const row = {
    user_id: lead.user_id,
    lead_id: lead.id,
    message_id: messageId,
    message_body: body.slice(0, 1600),
    sentiment: sentiment.sentiment,
    source: sentiment.source,
    raw_response: (sentiment.raw ?? null) as Json | null,
  };
  if (messageId) {
    const { data, error } = await admin.from("reply_classifications").upsert(row, { onConflict: "message_id", ignoreDuplicates: true }).select("id");
    if (error) {
      logError("automation/inbound", error, { step: "store classification", messageId });
    } else if (!data?.length) {
      result.duplicate = true;
      return result;
    }
  } else {
    const { error } = await admin.from("reply_classifications").insert(row);
    if (error) logError("automation/inbound", error, { step: "store classification (no message id)" });
  }

  // 2. STOP: opt the number out everywhere and end every drip for it.
  if (sentiment.sentiment === "stop") {
    const { data: sameNumber } = await admin.from("leads").select("id, user_id").eq("phone", fromPhone);
    const ids = (sameNumber ?? []).map((item) => item.id);
    if (ids.length) {
      const { error } = await admin
        .from("leads")
        .update({ status: "DNC", stage: "DNC", classification: "OPT_OUT", is_dnc: true, dnc_reason: "Replied STOP" })
        .in("id", ids);
      if (error) logError("automation/inbound", error, { step: "mark DNC" });
      result.cancelledEnrollments += await cancelLeadEnrollments(admin, ids, "STOP");
    }
    await recordHistory(admin, { user_id: lead.user_id, lead_id: lead.id, automation_type: "reply", automation_name: "Opt-out", action_taken: "Seller replied STOP — marked DNC, drips cancelled", result: "dnc" });
  } else {
    // 3. Any other reply ends drips that pause after a reply.
    result.cancelledEnrollments += await cancelLeadEnrollments(admin, [lead.id], "replied", { unlessContinueAfterReply: true });
  }

  // 4. Auto-responders (re-read the lead: steps above may have changed it).
  const { data: fresh } = await admin.from("leads").select("*").eq("id", lead.id).maybeSingle();
  const current: Lead = fresh ?? lead;

  const { data: responders, error: respondersError } = await admin
    .from("auto_responders")
    .select("*")
    .eq("user_id", lead.user_id)
    .eq("is_active", true)
    .order("created_at", { ascending: true });
  if (respondersError) {
    logError("automation/inbound", respondersError, { step: "load auto_responders" });
    return result;
  }
  if (!responders?.length) return result;

  const { count: inboundCount } = await admin.from("messages").select("id", { count: "exact", head: true }).eq("lead_id", lead.id).eq("direction", "inbound");
  const isFirstReply = (inboundCount ?? 0) <= 1;
  const context = { body, sentiment: sentiment.sentiment, isFirstReply };

  for (const responder of responders) {
    if (!matchesTrigger(responder, context) || !conditionsPass(responder.conditions, current)) continue;
    result.respondersRun.push(responder.name);

    const parsed = validActions(responder.actions);
    if (!parsed.length) {
      await recordHistory(admin, { user_id: lead.user_id, lead_id: lead.id, automation_type: "auto_responder", automation_name: responder.name, action_taken: "Skipped", result: "no valid actions configured" });
      continue;
    }
    for (const action of parsed) {
      const outcome = await runAction(admin, { action, lead: current, responderName: responder.name, body, toNumber });
      await recordHistory(admin, { user_id: lead.user_id, lead_id: lead.id, automation_type: "auto_responder", automation_name: responder.name, action_taken: outcome.label, result: outcome.result });
    }
  }
  return result;
}

function validActions(raw: unknown): AutomationAction[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((item) => {
    const parsed = actionSchema.safeParse(item);
    return parsed.success ? [parsed.data] : [];
  });
}

async function runAction(
  admin: Admin,
  { action, lead, responderName, body, toNumber }: { action: AutomationAction; lead: Lead; responderName: string; body: string; toNumber: string | null }
): Promise<{ label: string; result: string }> {
  try {
    switch (action.type) {
      case "send_sms": {
        if (lead.is_dnc || lead.status === "DNC") return { label: "Send SMS", result: "skipped: lead is opted out" };

        const since = (ms: number) => new Date(Date.now() - ms).toISOString();
        const recent = await admin
          .from("automation_history")
          .select("id", { count: "exact", head: true })
          .eq("lead_id", lead.id)
          .eq("automation_type", "auto_responder")
          .like("action_taken", "Sent SMS%")
          .gte("created_at", since(AUTO_SMS_COOLDOWN_MS));
        if ((recent.count ?? 0) > 0) return { label: "Send SMS", result: "skipped: auto-reply sent in the last 10 minutes" };
        const today = await admin
          .from("automation_history")
          .select("id", { count: "exact", head: true })
          .eq("lead_id", lead.id)
          .eq("automation_type", "auto_responder")
          .like("action_taken", "Sent SMS%")
          .gte("created_at", since(24 * 3_600_000));
        if ((today.count ?? 0) >= AUTO_SMS_DAILY_CAP) return { label: "Send SMS", result: "skipped: daily auto-reply limit reached" };

        const text = renderTemplate(action.message, lead);
        // Reply from the number the seller texted, so the thread stays on one line.
        const numbers = senderNumbers();
        const from = toNumber && numbers.includes(toNumber) ? toNumber : pickSenderNumber(lead.id, numbers);
        const to = normalizePhone(lead.phone);
        if (!to) return { label: "Send SMS", result: "skipped: lead has no phone number" };

        const sent = await sendTelnyxMessage({ to, text, from });
        await admin.from("messages").insert({
          user_id: lead.user_id, lead_id: lead.id, phone: to, direction: "outbound", body: text, to_number: to,
          status: sent.to?.[0]?.status ?? "queued", telnyx_message_id: sent.id,
        });
        await admin.from("leads").update({ last_contacted_at: new Date().toISOString() }).eq("id", lead.id);
        return { label: `Sent SMS from ${from}`, result: "sent" };
      }

      case "tag_lead": {
        const tag = addTag(lead.tag, action.tag);
        const { error } = await admin.from("leads").update({ tag }).eq("id", lead.id);
        if (error) throw error;
        lead.tag = tag;
        return { label: `Tagged "${action.tag}"`, result: "done" };
      }

      case "update_stage": {
        const write = STAGE_WRITE[action.stage];
        const patch: Database["public"]["Tables"]["leads"]["Update"] = { status: write.status as Lead["status"], stage: write.stage as Lead["stage"] };
        if (write.classification) patch.classification = write.classification as Lead["classification"];
        if (action.stage === "Offer Sent") patch.tag = addTag(lead.tag, "offer-sent");
        const { error } = await admin.from("leads").update(patch).eq("id", lead.id);
        if (error) throw error;
        return { label: `Moved to ${action.stage}`, result: "done" };
      }

      case "notify": {
        const snippet = body.replace(/\s+/g, " ").slice(0, 120);
        const text = action.message?.trim() || `Seller replied: “${snippet}”`;
        await admin.from("notes").insert({ user_id: lead.user_id, lead_id: lead.id, body: `🔔 ${responderName}: ${text}` });
        // Optional text alert: set NOTIFY_PHONE (E.164) to also be texted.
        const notifyTo = normalizePhone(process.env.NOTIFY_PHONE ?? "");
        if (notifyTo) {
          const sent = await sendTelnyxMessage({ to: notifyTo, from: pickSenderNumber(lead.id), text: `🔔 ${responderName}: ${text}`.slice(0, 300) });
          return { label: "Notify me", result: `note added; text alert sent (${sent.id})` };
        }
        return { label: "Notify me", result: "note added on the lead (set NOTIFY_PHONE to also get a text)" };
      }

      case "cancel_drips": {
        const cancelled = await cancelLeadEnrollments(admin, [lead.id], "auto_responder");
        return { label: "Cancel drips", result: `${cancelled} enrollment(s) cancelled` };
      }
    }
  } catch (error) {
    logError("automation/inbound", error, { action: action.type, leadId: lead.id, responder: responderName });
    return { label: action.type, result: `failed: ${error instanceof Error ? error.message : "error"}`.slice(0, 250) };
  }
}
