import { NextResponse } from "next/server";
import { z } from "zod";

import { readJson, withErrorHandling } from "@/lib/api";
import { autoResponderInputSchema } from "@/lib/automation/rules";
import { logError, userFacingError } from "@/lib/errors";
import { getAuthedAdmin } from "@/lib/route-admin";
import type { Database, Json } from "@/types/database";

type Context = { params: Promise<{ id: string }> };
const idSchema = z.string().uuid();

// PATCH accepts either a full edit or just the on/off toggle.
const toggleSchema = z.object({ is_active: z.boolean() });

export const PATCH = withErrorHandling("api/auto-responders/[id] PATCH", async (request: Request, context: Context) => {
  const auth = await getAuthedAdmin();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await context.params;
  if (!idSchema.safeParse(id).success) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const body = await readJson(request);
  const update: Database["public"]["Tables"]["auto_responders"]["Update"] = {};

  const toggle = toggleSchema.safeParse(body);
  if (toggle.success && Object.keys(body as object).length === 1) {
    update.is_active = toggle.data.is_active;
  } else {
    const parsed = autoResponderInputSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid auto-responder." }, { status: 400 });
    const input = parsed.data;
    if (input.trigger_type === "sentiment" && input.trigger_value === "stop" && input.actions.some((action) => action.type === "send_sms")) {
      return NextResponse.json({ error: "Don't send a text in reply to STOP — opted-out sellers can't be contacted." }, { status: 400 });
    }
    update.name = input.name;
    update.is_active = input.is_active;
    update.trigger_type = input.trigger_type;
    update.trigger_value = input.trigger_value?.trim() || null;
    update.conditions = input.conditions as Json;
    update.actions = input.actions as Json;
  }

  const { data, error } = await auth.admin.from("auto_responders").update(update).eq("id", id).eq("user_id", auth.user.id).select("*").maybeSingle();
  if (error) {
    logError("api/auto-responders/[id] PATCH", error);
    return NextResponse.json({ error: userFacingError(error, "Couldn't update the auto-responder.") }, { status: 500 });
  }
  if (!data) return NextResponse.json({ error: "Auto-responder not found." }, { status: 404 });
  return NextResponse.json({ auto_responder: data });
});

export const DELETE = withErrorHandling("api/auto-responders/[id] DELETE", async (_request: Request, context: Context) => {
  const auth = await getAuthedAdmin();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await context.params;
  if (!idSchema.safeParse(id).success) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const { data, error } = await auth.admin.from("auto_responders").delete().eq("id", id).eq("user_id", auth.user.id).select("id");
  if (error) {
    logError("api/auto-responders/[id] DELETE", error);
    return NextResponse.json({ error: userFacingError(error, "Couldn't delete the auto-responder.") }, { status: 500 });
  }
  if (!data?.length) return NextResponse.json({ error: "Auto-responder not found." }, { status: 404 });
  return NextResponse.json({ success: true });
});
