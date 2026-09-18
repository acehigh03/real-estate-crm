import { NextResponse } from "next/server";
import { z } from "zod";

import { readJson, withErrorHandling } from "@/lib/api";
import { logError, userFacingError } from "@/lib/errors";
import { getRouteUser } from "@/lib/route-user";

const smsSettingsSchema = z.object({
  auto_send_enabled: z.boolean(),
  send_window_start: z
    .string()
    .regex(/^\d{2}:\d{2}(:\d{2})?$/, "Must be HH:MM or HH:MM:SS"),
  send_window_end: z
    .string()
    .regex(/^\d{2}:\d{2}(:\d{2})?$/, "Must be HH:MM or HH:MM:SS"),
  timezone: z.string().min(1),
});

export const GET = withErrorHandling("api/settings/sms GET", async () => {
  const { supabase, user } = await getRouteUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("sms_settings")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    logError("api/settings/sms GET", error);
    return NextResponse.json({ error: userFacingError(error) }, { status: 500 });
  }

  // Return defaults when the row doesn't exist yet
  return NextResponse.json(
    data ?? {
      auto_send_enabled: false,
      send_window_start: "09:00",
      send_window_end: "20:00",
      timezone: "America/Chicago",
    }
  );
});

export const POST = withErrorHandling("api/settings/sms POST", async (request: Request) => {
  const { supabase, user } = await getRouteUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await readJson(request);
  if (body === undefined) {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = smsSettingsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const { error } = await supabase.from("sms_settings").upsert(
    { user_id: user.id, ...parsed.data },
    { onConflict: "user_id" }
  );

  if (error) {
    logError("api/settings/sms POST", error);
    return NextResponse.json({ error: userFacingError(error, "Couldn't save settings.") }, { status: 500 });
  }

  return NextResponse.json({ success: true });
});
