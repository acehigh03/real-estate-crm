import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";

import { getRouteUser } from "@/lib/route-user";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { sendTelnyxMessage } from "@/lib/telnyx/send-sms";
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

  if (lead.status === "DNC") {
    return NextResponse.json({ error: "Cannot send to DNC lead" }, { status: 400 });
  }

  const toNormalized = normalizePhone(to);
  const body = withStopLanguage(message);

  const telnyxMessage = await sendTelnyxMessage({ to: toNormalized, text: body });

  const { error: messageError } = await supabaseAdmin.from("messages").insert({
    user_id: user.id,
    lead_id: lead.id,
    direction: "outbound",
    body,
    to_number: toNormalized,
    status: telnyxMessage?.to?.[0]?.status ?? "queued",
    telnyx_message_id: telnyxMessage?.id ?? null,
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

  return NextResponse.json({
    success: true,
    message_id: telnyxMessage?.id ?? null,
  });
}
