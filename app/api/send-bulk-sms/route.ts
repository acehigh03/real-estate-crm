import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";

import { getRouteUser } from "@/lib/route-user";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { sendTelnyxMessage } from "@/lib/telnyx/send-sms";
import { withStopLanguage } from "@/lib/utils";

const schema = z.object({
  leadIds: z.array(z.string().uuid()).min(1),
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

  const { leadIds, message } = parsed.data;
  const body = withStopLanguage(message);

  const { data: leads, error } = await supabaseAdmin
    .from("leads")
    .select("*")
    .eq("user_id", user.id)
    .in("id", leadIds);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const sendableLeads = (leads ?? []).filter((lead) => lead.status !== "DNC");
  const results = await Promise.all(
    sendableLeads.map(async (lead) => {
      const telnyxMessage = await sendTelnyxMessage({
        to: lead.phone_normalized,
        text: body
      });

      await supabaseAdmin.from("messages").insert({
        user_id: user.id,
        lead_id: lead.id,
        direction: "outbound",
        body,
        to_number: lead.phone_normalized,
        status: telnyxMessage?.to?.[0]?.status ?? "queued",
        telnyx_message_id: telnyxMessage?.id ?? null
      });

      await supabaseAdmin
        .from("leads")
        .update({ status: lead.status === "New" ? "Contacted" : lead.status })
        .eq("id", lead.id);

      return lead.id;
    })
  );

  revalidatePath("/dashboard");
  revalidatePath("/leads");
  revalidatePath("/inbox");

  return NextResponse.json({
    success: true,
    sent: results.length,
    skipped: (leads ?? []).length - results.length
  });
}
