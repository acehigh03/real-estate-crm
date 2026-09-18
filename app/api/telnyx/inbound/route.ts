import crypto from "node:crypto";

import { revalidatePath } from "next/cache";
import { after, NextResponse } from "next/server";

import { classifyInboundSms, type InboundSmsClassificationResult } from "@/lib/ai/classify-lead";
import { logError } from "@/lib/errors";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { normalizePhone } from "@/lib/utils";
import type { Database } from "@/types/database";

type Lead = Database["public"]["Tables"]["leads"]["Row"];
type Admin = ReturnType<typeof getSupabaseAdmin>;

/**
 * Telnyx retries any webhook that doesn't get a 2xx, so every path below answers 200 —
 * even when we fail internally (that is logged with the full payload context so the
 * message can be recovered). The single deliberate exception is a failed signature check:
 * a forged or stale request must not be accepted, and retrying it is pointless.
 *
 * Order of operations for an inbound SMS:
 *   1. verify signature  2. parse  3. match lead  4. SAVE the message
 *   5. respond 200       6. (after response) classify + update lead
 * Classification can therefore never prevent, delay or roll back the saved message.
 */
export async function POST(request: Request) {
  let rawBody = "";

  try {
    rawBody = await request.text();

    const signatureError = verifySignature(rawBody, request.headers);
    if (signatureError) {
      console.error("[telnyx/inbound] rejected webhook:", signatureError);
      return NextResponse.json({ error: signatureError }, { status: 401 });
    }

    let payload: unknown;
    try {
      payload = JSON.parse(rawBody);
    } catch (error) {
      logError("telnyx/inbound", error, { step: "parse JSON", bodyPreview: rawBody.slice(0, 300) });
      return NextResponse.json({ received: true, ignored: "invalid_json" });
    }

    const data = (payload as Record<string, unknown>)?.data as Record<string, unknown> | undefined;
    const eventType = data?.event_type as string | undefined;

    if (eventType !== "message.received") {
      return NextResponse.json({ received: true, ignored: eventType ?? "unknown_event" });
    }

    const msg = data?.payload as Record<string, unknown> | undefined;
    const fromRaw = String(((msg?.from as Record<string, unknown>)?.phone_number as string) ?? "");
    const toRaw = String((((msg?.to as Array<Record<string, unknown>>) ?? [])[0]?.phone_number as string) ?? "");
    const media = (msg?.media as unknown[] | undefined) ?? [];
    const inboundText =
      String((msg?.text as string) ?? "").trim() || (media.length ? "[Media message]" : "");
    const from = normalizePhone(fromRaw);
    const to = normalizePhone(toRaw) || from;
    const telnyxMessageId = String((msg?.id as string) ?? "") || null;

    if (!from || !inboundText) {
      console.error("[telnyx/inbound] webhook missing sender or text; ignoring", {
        telnyxMessageId,
        hasFrom: Boolean(from),
        hasText: Boolean(inboundText),
      });
      return NextResponse.json({ received: true, ignored: "missing_fields" });
    }

    const admin = getSupabaseAdmin();

    // 3. Match the lead (most recent one if the same number exists more than once).
    const { data: lead, error: leadLookupError } = await admin
      .from("leads")
      .select("*")
      .eq("phone", from)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (leadLookupError) {
      logError("telnyx/inbound", leadLookupError, { step: "lead lookup", from });
    }

    // 4. Save the message FIRST, with only the core columns and no classification.
    // Idempotent on telnyx_message_id so Telnyx retries can't create duplicates.
    const insertResult = telnyxMessageId
      ? await admin.from("messages").upsert(
          {
            user_id: lead?.user_id ?? null,
            lead_id: lead?.id ?? null,
            direction: "inbound",
            body: inboundText,
            to_number: to,
            status: "received",
            telnyx_message_id: telnyxMessageId,
          },
          { onConflict: "telnyx_message_id" }
        )
      : await admin.from("messages").insert({
          user_id: lead?.user_id ?? null,
          lead_id: lead?.id ?? null,
          direction: "inbound",
          body: inboundText,
          to_number: to,
          status: "received",
          telnyx_message_id: null,
        });

    const saved = !insertResult.error;
    if (insertResult.error) {
      // Log everything needed to replay this message by hand.
      logError("telnyx/inbound", insertResult.error, {
        step: "SAVE INBOUND MESSAGE FAILED — message not stored",
        from,
        to,
        telnyxMessageId,
        body: inboundText,
      });
    }

    // 5+6. Respond now; enrich in the background.
    after(() =>
      enrichInboundMessage({
        admin,
        lead,
        from,
        inboundText,
        telnyxMessageId,
        messageSaved: saved,
      })
    );

    return NextResponse.json({ received: true, saved, matched_lead_id: lead?.id ?? null });
  } catch (error) {
    logError("telnyx/inbound", error, { step: "unhandled", bodyPreview: rawBody.slice(0, 300) });
    return NextResponse.json({ received: true, error: "internal_error" });
  }
}

async function enrichInboundMessage({
  admin,
  lead,
  from,
  inboundText,
  telnyxMessageId,
  messageSaved,
}: {
  admin: Admin;
  lead: Lead | null;
  from: string;
  inboundText: string;
  telnyxMessageId: string | null;
  messageSaved: boolean;
}) {
  let classification: InboundSmsClassificationResult;
  try {
    classification = classifyInboundSms(inboundText);
  } catch (error) {
    // The message is already stored; a classifier failure only means it stays unclassified.
    logError("telnyx/inbound", error, { step: "classify inbound SMS", telnyxMessageId });
    return;
  }

  if (messageSaved && telnyxMessageId) {
    const { error } = await admin
      .from("messages")
      .update({ classification: classification.messageClassification, phone: from })
      .eq("telnyx_message_id", telnyxMessageId);
    if (error) logError("telnyx/inbound", error, { step: "store message classification", telnyxMessageId });
  }

  if (lead) {
    const leadPatch = {
      status: classification.leadStatus,
      stage: classification.leadStage,
      classification: classification.leadClassification,
      motivation_score: classification.leadScore,
      lead_score: classification.leadScore,
      priority: classification.priority,
      is_dnc: classification.isDnc,
      dnc_reason: classification.dncReason,
      last_replied_at: new Date().toISOString(),
    };

    // A STOP must suppress this number everywhere, not just on the lead we matched.
    const query = admin.from("leads").update(leadPatch);
    const { error } =
      classification.messageClassification === "STOP_DNC"
        ? await query.eq("phone", from)
        : await query.eq("id", lead.id);
    if (error) logError("telnyx/inbound", error, { step: "update lead from reply", leadId: lead.id });

    const noteBody =
      classification.messageClassification === "STOP_DNC"
        ? "Lead replied STOP and was automatically marked DNC."
        : classification.shouldAlert
          ? "HOT inbound reply detected. Review this lead immediately."
          : null;

    if (noteBody) {
      const { error: noteError } = await admin
        .from("notes")
        .insert({ user_id: lead.user_id, lead_id: lead.id, body: noteBody });
      if (noteError) logError("telnyx/inbound", noteError, { step: "insert alert note", leadId: lead.id });
    }
  }

  try {
    revalidatePath("/dashboard");
    revalidatePath("/leads");
    revalidatePath("/inbox");
    revalidatePath("/pipeline");
    if (lead?.id) revalidatePath(`/leads/${lead.id}`);
  } catch (error) {
    logError("telnyx/inbound", error, { step: "revalidate paths" });
  }
}

/** Returns an error string when the request must be rejected, otherwise null. */
function verifySignature(rawBody: string, headers: Headers): string | null {
  const publicKeyB64 = process.env.TELNYX_PUBLIC_KEY;
  if (!publicKeyB64) {
    // Fail-open by design so local/dev setups work, but make it visible.
    console.warn("[telnyx/inbound] TELNYX_PUBLIC_KEY is not set — webhook signatures are NOT being verified");
    return null;
  }

  const signature = headers.get("telnyx-signature-ed25519");
  const timestamp = headers.get("telnyx-timestamp");
  if (!signature || !timestamp) return "Missing signature headers";

  const ts = Number.parseInt(timestamp, 10);
  if (!Number.isFinite(ts) || Math.abs(Date.now() / 1000 - ts) > 300) {
    return "Webhook timestamp invalid or expired";
  }

  try {
    const rawKey = Buffer.from(publicKeyB64, "base64");
    const spkiHeader = Buffer.from("302a300506032b6570032100", "hex");
    const publicKey = crypto.createPublicKey({
      key: Buffer.concat([spkiHeader, rawKey]),
      format: "der",
      type: "spki",
    });

    const isValid = crypto.verify(
      null,
      Buffer.from(`${timestamp}|${rawBody}`),
      publicKey,
      Buffer.from(signature, "base64")
    );
    return isValid ? null : "Invalid webhook signature";
  } catch (error) {
    logError("telnyx/inbound", error, { step: "signature verification threw" });
    return "Signature verification failed";
  }
}
