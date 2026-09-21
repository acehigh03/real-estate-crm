import { NextResponse } from "next/server";
import { z } from "zod";

import { readJson, withErrorHandling } from "@/lib/api";
import { logError, userFacingError } from "@/lib/errors";
import { getRouteUser } from "@/lib/route-user";

interface RouteContext {
  params: Promise<{
    id: string;
  }>;
}

export const GET = withErrorHandling("api/campaigns/[id]", async (_: Request, context: RouteContext) => {
  const { supabase, user } = await getRouteUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await context.params;

  const { data, error } = await supabase
    .from("campaigns")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    logError("api/campaigns/[id]", error, { campaignId: id });
    return NextResponse.json({ error: userFacingError(error) }, { status: 500 });
  }
  if (!data) return NextResponse.json({ error: "Campaign not found" }, { status: 404 });

  return NextResponse.json({ campaign: data });
});

const updateSchema = z.object({
  name: z.string().trim().min(1).max(160),
  campaign_type: z.enum(["cash_offer", "foreclosure_help", "probate", "tax_sale", "custom"]),
  first_sms_template: z.string().trim().min(1).max(1000),
});

export const PATCH = withErrorHandling("api/campaigns/[id] PATCH", async (request: Request, context: RouteContext) => {
  const { supabase, user } = await getRouteUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = updateSchema.safeParse(await readJson(request));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid campaign." }, { status: 400 });
  const { id } = await context.params;
  const { data, error } = await supabase.from("campaigns").update(parsed.data).eq("id", id).eq("user_id", user.id).select("*").maybeSingle();
  if (error) {
    logError("api/campaigns/[id] PATCH", error, { campaignId: id });
    return NextResponse.json({ error: userFacingError(error, "Couldn't update the campaign.") }, { status: 500 });
  }
  if (!data) return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  return NextResponse.json({ campaign: data });
});
