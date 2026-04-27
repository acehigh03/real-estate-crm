import crypto from "node:crypto";

import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { classifyInboundSms } from "@/lib/ai/classify-lead";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { normalizePhone } from "@/lib/utils";

export async function POST(request: Request) {
  const supabaseAdmin = getSupabaseAdmin();
  console.log("Inbound webhook hit");

  const rawBody = await request.text();
  console.log("raw payload", rawBody);

  const publicKeyB64 = process.env.TELNYX_PUBLIC_KEY;
  if (publicKeyB64) {
    const signature = request.headers.get("telnyx-signature-ed25519");
    const timestamp  = request.headers.get("telnyx-timestamp");

    if (!signature || !timestamp) {
      return NextResponse.json({ error: "Missing signature headers" }, { status: 401 });
    }

    if (Math.abs(Date.now() / 1000 - parseInt(timestamp, 10)) > 300) {
      return NextResponse.json({ error: "Webhook timestamp expired" }, { status: 401 });
    }

    try {
      const signedContent = `${timestamp}|${rawBody}`;

      const rawKey     = Buffer.from(publicKeyB64, "base64");
      const spkiHeader = Buffer.from("302a300506032b6570032100", "hex");
      const derKey     = Buffer.concat([spkiHeader, rawKey]);
      const publicKey  = crypto.createPublicKey({ key: derKey, format: "der", type: "spki" });

      const isValid = crypto.verify(
        null,
        Buffer.from(signedContent),
        publicKey,
        Buffer.from(signature, "base64")
      );

      if (!isValid) {
        return NextResponse.json({ error: "Invalid webhook signature" }, { status: 401 });
      }
    } catch {
      return NextResponse.json({ error: "Signature verification failed" }, { status: 401 });
    }
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const data = (payload as Record<string, unknown>)?.data as Record<string, unknown> | undefined;
  const eventType = data?.event_type as string | undefined;

  if (eventType !== "message.received") {
    return NextResponse.json({ received: true });
  }

  const msg = data?.payload as Record<string, unknown> | undefined;
  const inboundText = String((msg?.text as string) ?? "").trim();
  const fromRaw = String(
    ((msg?.from as Record<string, unknown>)?.phone_number as string) ?? ""
  );
  console.log("extracted phone", fromRaw);
  const from = normalizePhone(fromRaw);
  console.log("normalized phone", from);
  const telnyxMessageId = String((msg?.id as string) ?? "");

  if (!from || !inboundText) {
    return NextResponse.json({ error: "Missing webhook fields" }, { status: 400 });
  }

  const { data: lead } = await supabaseAdmin
    .from("leads")
    .select("*")
    .eq("phone_normalized", from)
    .maybeSingle();
  console.log("lead match result", lead ? { id: lead.id, user_id: lead.user_id, campaign_id: lead.campaign_id } : null);

  const inboundClassification = classifyInboundSms(inboundText);
  console.log("classification result", inboundClassification);
  const receivedAt = new Date().toISOString();

  const insertResult = await supabaseAdmin.from("messages").upsert(
    {
      user_id: lead?.user_id ?? null,
      lead_id: lead?.id ?? null,
      phone: from,
      direction: "inbound",
      body: inboundText,
      to_number: from,
      status: "received",
      classification: inboundClassification.messageClassification,
      telnyx_message_id: telnyxMessageId,
    },
    { onConflict: "telnyx_message_id" }
  );
  console.log("DB insert result", {
    error: insertResult.error?.message ?? null,
    inserted_telnyx_message_id: telnyxMessageId,
  });

  if (lead) {
    const updateResult = await supabaseAdmin
      .from("leads")
      .update({
        status: inboundClassification.leadStatus,
        stage: inboundClassification.leadStage,
        classification: inboundClassification.leadClassification,
        motivation_score: inboundClassification.leadScore,
        lead_score: inboundClassification.leadScore,
        priority: inboundClassification.priority,
        is_dnc: inboundClassification.isDnc,
        dnc_reason: inboundClassification.dncReason,
        last_replied_at: receivedAt,
      })
      .eq("id", lead.id);
    console.log("DB update result", {
      error: updateResult.error?.message ?? null,
      lead_id: lead.id,
      status: inboundClassification.leadStatus,
      stage: inboundClassification.leadStage,
      classification: inboundClassification.leadClassification,
      is_dnc: inboundClassification.isDnc,
    });

    if (inboundClassification.messageClassification === "STOP_DNC") {
      await supabaseAdmin.from("notes").insert({
        user_id: lead.user_id,
        lead_id: lead.id,
        body: "Lead replied STOP and was automatically marked DNC.",
      });
    } else if (inboundClassification.shouldAlert) {
      await supabaseAdmin.from("notes").insert({
        user_id: lead.user_id,
        lead_id: lead.id,
        body: "HOT inbound reply detected. Review this lead immediately.",
      });
    }
  }

  revalidatePath("/dashboard");
  revalidatePath("/leads");
  if (lead?.id) {
    revalidatePath(`/leads/${lead.id}`);
  }
  revalidatePath("/inbox");

  return NextResponse.json({ received: true, matched_lead_id: lead?.id ?? null });
}
