import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";

import { getRouteUser } from "@/lib/route-user";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { sendTelnyxMessage } from "@/lib/telnyx/send-sms";
import { withStopLanguage } from "@/lib/utils";

const schema = z.object({
  leadId: z.string().uuid(),
  message: z.string().min(1)
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

  const { leadId, message } = parsed.data;

  const { data: lead, error: leadError } = await supabaseAdmin
    .from("leads")
    .select("*")
    .eq("id", leadId)
    .eq("user_id", user.id)
    .single();

  if (leadError || !lead) {
    return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  }

  if (lead.status === "DNC") {
    return NextResponse.json({ error: "Cannot send to DNC lead" }, { status: 400 });
  }

  const body = withStopLanguage(message);
  const telnyxMessage = await sendTelnyxMessage({
    to: lead.phone_normalized,
    text: body
  });

  const { error: messageError } = await supabaseAdmin.from("messages").insert({
    user_id: user.id,
    lead_id: lead.id,
    direction: "outbound",
    body,
    to_number: lead.phone_normalized,
    status: telnyxMessage?.to?.[0]?.status ?? "queued",
    telnyx_message_id: telnyxMessage?.id ?? null
  });

  if (messageError) {
    return NextResponse.json({ error: messageError.message }, { status: 500 });
  }

  await supabaseAdmin
    .from("leads")
    .update({ status: lead.status === "New" ? "Contacted" : lead.status })
    .eq("id", lead.id);

  revalidatePath("/dashboard");
  revalidatePath("/leads");
  revalidatePath("/inbox");

  return NextResponse.json({ success: true, telnyxId: telnyxMessage?.id ?? null });
}
