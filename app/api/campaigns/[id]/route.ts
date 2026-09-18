import { NextResponse } from "next/server";

import { withErrorHandling } from "@/lib/api";
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
