import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";

import { readJson, withErrorHandling } from "@/lib/api";
import { logError, userFacingError } from "@/lib/errors";
import { sendSmsToLead } from "@/lib/leads/send-lead-sms";
import { getRouteUser } from "@/lib/route-user";

const schema = z.object({
  to: z.string().min(1),
  message: z.string().trim().min(1),
  lead_id: z.string().uuid(),
});

export const POST = withErrorHandling("api/telnyx/send", async (request: Request) => {
  const { supabase, user } = await getRouteUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = schema.safeParse(await readJson(request));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { message, lead_id } = parsed.data;

  // Runs as the signed-in user, so row-level security guarantees the lead is theirs.
  const { data: lead, error: leadError } = await supabase
    .from("leads")
    .select("*")
    .eq("id", lead_id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (leadError) {
    logError("api/telnyx/send", leadError, { leadId: lead_id, step: "load lead" });
    return NextResponse.json({ error: userFacingError(leadError) }, { status: 500 });
  }
  if (!lead) {
    return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  }

  const result = await sendSmsToLead({ db: supabase, userId: user.id, lead, message });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  revalidatePath("/dashboard");
  revalidatePath("/leads");
  revalidatePath(`/leads/${lead.id}`);
  revalidatePath("/inbox");
  revalidatePath("/pipeline");

  return NextResponse.json({
    success: true,
    message_id: result.telnyxMessageId,
    message: result.message,
    warning: result.warning ?? null,
  });
});
