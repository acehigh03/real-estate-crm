// One place that sends an SMS for the automation engine and records it. Never throws.
import type { SupabaseClient } from "@supabase/supabase-js";

import { logError } from "@/lib/errors";
import { sendTelnyxMessage, TelnyxSendError } from "@/lib/telnyx/send-sms";
import { normalizePhone } from "@/lib/utils";
import type { Database } from "@/types/database";
import { pickSenderNumber, senderNumbers } from "./rules";

type Admin = SupabaseClient<Database>;

export interface SendOutcome {
  ok: boolean;
  telnyxMessageId?: string;
  from?: string;
  error?: string;
}

/**
 * @param preferFrom  number to reply from (e.g. the one the seller just texted); used only when it
 *                    is one of our sender numbers, otherwise the lead's sticky number is used.
 */
export async function sendAndRecord(
  admin: Admin,
  {
    userId,
    lead,
    text,
    preferFrom,
  }: {
    userId: string;
    lead: { id: string; phone: string | null; is_dnc: boolean; status: string };
    text: string;
    preferFrom?: string | null;
  }
): Promise<SendOutcome> {
  if (lead.is_dnc || lead.status === "DNC") return { ok: false, error: "Lead is opted out" };
  const to = normalizePhone(lead.phone ?? "");
  if (!to) return { ok: false, error: "Lead has no phone number" };

  const numbers = senderNumbers();
  const from = preferFrom && numbers.includes(preferFrom) ? preferFrom : pickSenderNumber(lead.id, numbers);

  let sent: Awaited<ReturnType<typeof sendTelnyxMessage>>;
  try {
    sent = await sendTelnyxMessage({ to, text, from });
  } catch (error) {
    const message = error instanceof TelnyxSendError ? error.message : error instanceof Error ? error.message : "Send failed";
    logError("automation/send", error, { leadId: lead.id, from });
    return { ok: false, from, error: message.slice(0, 300) };
  }

  // The text is out. Bookkeeping problems are logged but never turn this into a failure
  // (that would invite a duplicate send on retry).
  const { error: messageError } = await admin.from("messages").insert({
    user_id: userId,
    lead_id: lead.id,
    phone: to,
    direction: "outbound",
    from_number: from,
    body: text,
    to_number: to,
    status: sent.to?.[0]?.status ?? "queued",
    telnyx_message_id: sent.id,
  });
  if (messageError) logError("automation/send", messageError, { step: "SMS SENT but message row not saved", leadId: lead.id, telnyxId: sent.id });

  const { error: leadError } = await admin.from("leads").update({ last_contacted_at: new Date().toISOString() }).eq("id", lead.id);
  if (leadError) logError("automation/send", leadError, { step: "update last_contacted_at", leadId: lead.id });

  return { ok: true, from, telnyxMessageId: sent.id };
}
