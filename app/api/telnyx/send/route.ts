import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";

import { getRouteUser } from "@/lib/route-user";
import { classifyLeadMock } from "@/lib/ai/classify-lead";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { sendTelnyxMessage, TelnyxSendError } from "@/lib/telnyx/send-sms";
import { normalizePhone, withStopLanguage } from "@/lib/utils";

const schema = z.object({
  to: z.string().min(1),
  message: z.string().min(1),
  lead_id: z.string().uuid(),
});

export async function POST(request: Request) {
  const supabaseAdmin = getSupabaseAdmin();
  const { user } = await getRouteUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { to, message, lead_id } = parsed.data;

  // Verify the lead belongs to this user
  const { data: lead, error: leadError } = await supabaseAdmin
    .from("leads")
    .select("*")
    .eq("id", lead_id)
    .eq("user_id", user.id)
    .single();

  if (leadError || !lead) {
    return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  }

  if (lead.status === "DNC" || lead.is_dnc) {
    return NextResponse.json({ error: "Cannot send to DNC lead" }, { status: 400 });
  }

  const toNormalized = normalizePhone(to);
  const body = withStopLanguage(message);

  let telnyxMessage: {
    id: string;
    to: Array<{ status: string }>;
  };
  try {
    telnyxMessage = await sendTelnyxMessage({ to: toNormalized, text: body });
  } catch (error) {
    if (error instanceof TelnyxSendError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return NextResponse.json(
      { error: "Unable to send message right now. Please try again." },
      { status: 500 }
    );
  }

  const { error: messageError } = await supabaseAdmin.from("messages").insert({
    user_id: user.id,
    lead_id: lead.id,
    phone: toNormalized,
    direction: "outbound",
    body,
    to_number: toNormalized,
    status: telnyxMessage?.to?.[0]?.status ?? "queued",
    telnyx_message_id: telnyxMessage?.id ?? null,
  });

  if (messageError) {
    return NextResponse.json({ error: messageError.message }, { status: 500 });
  }

  const mockClassification = classifyLeadMock({
    status: lead.status === "New" ? "Contacted" : lead.status,
    notesSummary: lead.notes_summary,
    nextFollowUpAt: lead.next_follow_up_at,
  });

  await supabaseAdmin
    .from("leads")
    .update({
      status: lead.status === "New" ? "Contacted" : lead.status,
      stage: lead.status === "New" ? "Contacted" : lead.stage ?? "Contacted",
      classification: mockClassification.classification,
      motivation_score: mockClassification.motivationScore,
      lead_score: mockClassification.motivationScore,
      priority:
        mockClassification.classification === "HOT"
          ? "high"
          : mockClassification.classification === "WARM"
            ? "medium"
            : "low",
      last_contacted_at: new Date().toISOString(),
    })
    .eq("id", lead.id);

  revalidatePath("/dashboard");
  revalidatePath("/leads");
  revalidatePath(`/leads/${lead.id}`);
  revalidatePath("/inbox");

  return NextResponse.json({
    success: true,
    message_id: telnyxMessage?.id ?? null,
  });
}
