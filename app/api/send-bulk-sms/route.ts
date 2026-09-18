import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";

import { readJson, withErrorHandling } from "@/lib/api";
import { logError, userFacingError } from "@/lib/errors";
import { sendSmsToLead } from "@/lib/leads/send-lead-sms";
import { getRouteUser } from "@/lib/route-user";

const schema = z.object({
  leadIds: z.array(z.string().uuid()).min(1).max(500),
  message: z.string().trim().min(1)
});

export const POST = withErrorHandling("api/send-bulk-sms", async (request: Request) => {
  const { supabase, user } = await getRouteUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = schema.safeParse(await readJson(request));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { leadIds, message } = parsed.data;

  const { data: leads, error } = await supabase
    .from("leads")
    .select("*")
    .eq("user_id", user.id)
    .in("id", leadIds);

  if (error) {
    logError("api/send-bulk-sms", error, { step: "load leads" });
    return NextResponse.json({ error: userFacingError(error) }, { status: 500 });
  }

  const sendable = (leads ?? []).filter((lead) => lead.status !== "DNC" && !lead.is_dnc);

  // Sequential: keeps us under Telnyx rate limits and lets one failure not affect the rest.
  let sent = 0;
  const failures: Array<{ lead_id: string; error: string }> = [];
  for (const lead of sendable) {
    const result = await sendSmsToLead({ db: supabase, userId: user.id, lead, message });
    if (result.ok) {
      sent++;
    } else {
      console.error("[api/send-bulk-sms] send failed", { leadId: lead.id, error: result.error });
      failures.push({ lead_id: lead.id, error: result.error });
    }
  }

  revalidatePath("/dashboard");
  revalidatePath("/leads");
  revalidatePath("/inbox");
  revalidatePath("/pipeline");

  const skipped = leadIds.length - sendable.length;

  if (sent === 0 && failures.length > 0) {
    return NextResponse.json(
      { error: failures[0].error, success: false, sent, failed: failures.length, skipped, failures },
      { status: 502 }
    );
  }

  return NextResponse.json({
    success: true,
    sent,
    failed: failures.length,
    skipped,
    failures,
  });
});
