import { NextResponse } from "next/server";
import { z } from "zod";

import { readJson, withErrorHandling } from "@/lib/api";
import { logError, userFacingError } from "@/lib/errors";
import { getRouteUser } from "@/lib/route-user";

const types = ["cash_offer", "foreclosure_help", "probate", "tax_sale", "custom"] as const;
const bodySchema = z.object({ templates: z.record(z.enum(types), z.string().trim().min(1).max(1000)) });

export const GET = withErrorHandling("api/settings/templates GET", async () => {
  const { supabase, user } = await getRouteUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data, error } = await supabase.from("message_templates").select("campaign_type, body").eq("user_id", user.id);
  if (error) {
    logError("api/settings/templates GET", error);
    return NextResponse.json({ error: userFacingError(error) }, { status: 500 });
  }
  return NextResponse.json({ templates: Object.fromEntries((data ?? []).map((row) => [row.campaign_type, row.body])) });
});

export const PUT = withErrorHandling("api/settings/templates PUT", async (request: Request) => {
  const { supabase, user } = await getRouteUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = bodySchema.safeParse(await readJson(request));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid templates." }, { status: 400 });
  const now = new Date().toISOString();
  const rows = Object.entries(parsed.data.templates).map(([campaign_type, body]) => ({ user_id: user.id, campaign_type: campaign_type as (typeof types)[number], body, updated_at: now }));
  const { error } = await supabase.from("message_templates").upsert(rows, { onConflict: "user_id,campaign_type" });
  if (error) {
    logError("api/settings/templates PUT", error);
    return NextResponse.json({ error: userFacingError(error, "Couldn't save templates.") }, { status: 500 });
  }
  return NextResponse.json({ saved: rows.length });
});
