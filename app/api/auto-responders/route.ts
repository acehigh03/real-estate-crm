import { NextResponse } from "next/server";

import { readJson, withErrorHandling } from "@/lib/api";
import { autoResponderInputSchema } from "@/lib/automation/rules";
import { logError, userFacingError } from "@/lib/errors";
import { getAuthedAdmin } from "@/lib/route-admin";
import type { Json } from "@/types/database";

export const GET = withErrorHandling("api/auto-responders GET", async () => {
  const auth = await getAuthedAdmin();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await auth.admin.from("auto_responders").select("*").eq("user_id", auth.user.id).order("created_at", { ascending: false });
  if (error) {
    logError("api/auto-responders GET", error);
    return NextResponse.json({ error: userFacingError(error) }, { status: 500 });
  }
  return NextResponse.json({ auto_responders: data ?? [] });
});

export const POST = withErrorHandling("api/auto-responders POST", async (request: Request) => {
  const auth = await getAuthedAdmin();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = autoResponderInputSchema.safeParse(await readJson(request));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid auto-responder." }, { status: 400 });
  }
  const input = parsed.data;

  // A STOP must never trigger a text back to the seller.
  if (input.trigger_type === "sentiment" && input.trigger_value === "stop" && input.actions.some((action) => action.type === "send_sms")) {
    return NextResponse.json({ error: "Don't send a text in reply to STOP — opted-out sellers can't be contacted." }, { status: 400 });
  }

  const { data, error } = await auth.admin
    .from("auto_responders")
    .insert({
      user_id: auth.user.id,
      name: input.name,
      is_active: input.is_active,
      trigger_type: input.trigger_type,
      trigger_value: input.trigger_value?.trim() || null,
      conditions: input.conditions as Json,
      actions: input.actions as Json,
    })
    .select("*")
    .single();
  if (error) {
    logError("api/auto-responders POST", error);
    return NextResponse.json({ error: userFacingError(error, "Couldn't save the auto-responder.") }, { status: 500 });
  }
  return NextResponse.json({ auto_responder: data }, { status: 201 });
});
