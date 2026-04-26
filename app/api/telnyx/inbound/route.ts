import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { classifyLeadMock } from "@/lib/ai/classify-lead";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { normalizePhone } from "@/lib/utils";

const stopKeywords = new Set(["STOP", "UNSUBSCRIBE", "CANCEL", "END", "QUIT", "STOPALL"]);

export async function POST(request: Request) {
  const supabaseAdmin = getSupabaseAdmin();

  let payload: unknown;
  try {
    payload = await request.json();
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
      nextFollowUpAt: lead.next_follow_up_at ?? lead.follow_up_date,
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
  revalidatePath("/inbox");

  return NextResponse.json({ received: true, matched_lead_id: lead?.id ?? null });
}
