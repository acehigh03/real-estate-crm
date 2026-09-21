import type { SupabaseClient } from "@supabase/supabase-js";

import { classifyLeadMock } from "@/lib/ai/classify-lead";
import { pickSenderNumber } from "@/lib/automation/rules";
import { logError } from "@/lib/errors";
import { sendTelnyxMessage, TelnyxSendError } from "@/lib/telnyx/send-sms";
import { normalizePhone, prepareOutboundMessage } from "@/lib/utils";
import type { Database } from "@/types/database";

type Lead = Database["public"]["Tables"]["leads"]["Row"];
type Message = Database["public"]["Tables"]["messages"]["Row"];

export type SendLeadSmsResult =
  | { ok: true; message: Message | null; telnyxMessageId: string; warning?: string }
  | { ok: false; status: number; error: string };

/** Telnyx errors that a user can act on (bad number, opted out, ...) are passed through. */
function telnyxFailureMessage(error: TelnyxSendError) {
  if (error.status === 400 || error.status === 422) return `Telnyx rejected the message: ${error.message}`;
  // Only 401 means bad credentials. Telnyx also uses 403 for account/number/compliance blocks
  // (e.g. unregistered 10DLC), so surface its own explanation instead of blaming the key.
  if (error.status === 401) {
    return "The SMS provider rejected our credentials. Please contact support.";
  }
  if (error.status === 403) return `Telnyx blocked this message: ${error.message}`;
  if (error.status === 429) return "Too many messages sent too quickly. Please wait a moment and retry.";
  return "Unable to send the text right now. Please try again.";
}

/**
 * Sends an SMS to a lead through Telnyx, then records it. Order matters: the row is only
 * written after Telnyx accepts the message, and a failed bookkeeping write never turns a
 * delivered SMS into an error (which would invite a duplicate resend).
 */
export async function sendSmsToLead({
  db,
  userId,
  lead,
  message,
}: {
  db: SupabaseClient<Database>;
  userId: string;
  lead: Lead;
  message: string;
}): Promise<SendLeadSmsResult> {
  if (lead.status === "DNC" || lead.is_dnc) {
    return { ok: false, status: 400, error: "This lead is marked Do Not Contact." };
  }

  const to = normalizePhone(lead.phone);
  if (!to) {
    return { ok: false, status: 400, error: "This lead has no valid phone number." };
  }

  // The opt-out disclosure belongs on the first outbound message in a conversation,
  // not every reply. Existing text that already contains STOP remains unchanged.
  const { count: priorOutboundCount, error: historyError } = await db
    .from("messages")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("lead_id", lead.id)
    .eq("direction", "outbound");
  if (historyError) {
    logError("send-lead-sms", historyError, { leadId: lead.id, step: "check first outbound message" });
    return { ok: false, status: 500, error: "Could not verify this conversation before sending." };
  }

  const body = prepareOutboundMessage(message, priorOutboundCount ?? 0);
  const from = pickSenderNumber(lead.id);

  let telnyxMessage: Awaited<ReturnType<typeof sendTelnyxMessage>>;
  try {
    telnyxMessage = await sendTelnyxMessage({ to, text: body, from });
  } catch (error) {
    if (error instanceof TelnyxSendError) {
      return { ok: false, status: error.status >= 500 || error.status === 401 ? 502 : 422, error: telnyxFailureMessage(error) };
    }
    logError("send-lead-sms", error, { leadId: lead.id, step: "telnyx send" });
    return { ok: false, status: 502, error: "Unable to send the text right now. Please try again." };
  }

  let warning: string | undefined;

  const { data: savedMessage, error: messageError } = await db
    .from("messages")
    .insert({
      user_id: userId,
      lead_id: lead.id,
      phone: to,
      direction: "outbound",
      from_number: from,
      body,
      to_number: to,
      status: telnyxMessage.to?.[0]?.status ?? "queued",
      telnyx_message_id: telnyxMessage.id,
    })
    .select("*")
    .single();

  if (messageError) {
    logError("send-lead-sms", messageError, {
      leadId: lead.id,
      telnyxMessageId: telnyxMessage.id,
      step: "SMS was SENT but saving the message row failed",
    });
    warning = "The text was sent, but it could not be saved to the conversation history.";
  }

  const nextStatus = lead.status === "New" ? "Contacted" : lead.status;
  const classification = classifyLeadMock({
    status: nextStatus,
    notesSummary: lead.notes_summary,
    nextFollowUpAt: lead.next_follow_up_at,
  });

  const { error: leadUpdateError } = await db
    .from("leads")
    .update({
      status: nextStatus,
      stage: lead.status === "New" ? "Contacted" : lead.stage ?? "Contacted",
      classification: classification.classification,
      motivation_score: classification.motivationScore,
      lead_score: classification.motivationScore,
      priority:
        classification.classification === "HOT"
          ? "high"
          : classification.classification === "WARM"
            ? "medium"
            : "low",
      last_contacted_at: new Date().toISOString(),
    })
    .eq("id", lead.id)
    .eq("user_id", userId);

  if (leadUpdateError) {
    logError("send-lead-sms", leadUpdateError, { leadId: lead.id, step: "post-send lead update" });
    warning ??= "The text was sent, but the lead's status could not be updated.";
  }

  return { ok: true, message: savedMessage ?? null, telnyxMessageId: telnyxMessage.id, warning };
}
