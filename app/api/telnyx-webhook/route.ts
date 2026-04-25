import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { normalizePhone } from "@/lib/utils";

const stopKeywords = new Set(["STOP", "UNSUBSCRIBE", "CANCEL", "END", "QUIT", "STOPALL"]);

export async function POST(request: Request) {
  const supabaseAdmin = getSupabaseAdmin();
  const payload = await request.json();
  const eventType = payload?.data?.event_type;

  if (eventType !== "message.received") {
    return NextResponse.json({ received: true });
  }

  const message = payload?.data?.payload;
  const inboundText = String(message?.text ?? "").trim();
  const from = normalizePhone(String(message?.from?.phone_number ?? ""));
  const telnyxMessageId = String(message?.id ?? "");

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
      telnyx_message_id: telnyxMessageId
    },
    { onConflict: "telnyx_message_id" }
  );

  if (lead) {
    await supabaseAdmin
      .from("leads")
      .update({ status: isStopReply ? "DNC" : "Replied" })
      .eq("id", lead.id);

    if (isStopReply) {
      await supabaseAdmin.from("notes").insert({
        user_id: lead.user_id,
        lead_id: lead.id,
        body: "Lead replied STOP and was automatically marked DNC."
      });
    }
  }

  revalidatePath("/dashboard");
  revalidatePath("/leads");
  revalidatePath("/inbox");

  return NextResponse.json({ received: true, matchedLeadId: lead?.id ?? null });
}
