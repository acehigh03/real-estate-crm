import crypto from "node:crypto";

import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { classifyLeadMock } from "@/lib/ai/classify-lead";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { normalizePhone } from "@/lib/utils";

const stopKeywords = new Set(["STOP", "UNSUBSCRIBE", "CANCEL", "END", "QUIT", "STOPALL"]);

export async function POST(request: Request) {
  const supabaseAdmin = getSupabaseAdmin();

  const rawBody = await request.text();

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
  const from = normalizePhone(fromRaw);
  const telnyxMessageId = String((msg?.id as string) ?? "");

  if (!from || !inboundText) {
    return NextResponse.json({ error: "Missing webhook fields" }, { status: 400 });
  }

  const { data: lead } = await supabaseAdmin
    .from("leads")
    .select("*")
    .eq("phone_normalized", from)
    .maybeSingle();

  const isStopReply = stopKeywords.has(inboundText.toUpperCase());

  await supabaseAdmin.from("messages").upsert(
    {
      user_id: lead?.user_id ?? null,
      lead_id: lead?.id ?? null,
      direction: "inbound",
      body: inboundText,
      to_number: from,
      status: "received",
      telnyx_message_id: telnyxMessageId,
    },
    { onConflict: "telnyx_message_id" }
  );

  if (lead) {
    const mockClassification = classifyLeadMock({
      status: isStopReply ? "DNC" : "Replied",
      notesSummary: lead.notes_summary,
      nextFollowUpAt: lead.next_follow_up_at,
      inboundMessageCount: 1,
    });

    await supabaseAdmin
      .from("leads")
      .update({
        status: isStopReply ? "DNC" : "Replied",
        classification: mockClassification.classification,
        motivation_score: mockClassification.motivationScore,
      })
      .eq("id", lead.id);

    if (isStopReply) {
      await supabaseAdmin.from("notes").insert({
        user_id: lead.user_id,
        lead_id: lead.id,
        body: "Lead replied STOP and was automatically marked DNC.",
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
