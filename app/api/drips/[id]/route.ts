import { NextResponse } from "next/server";
import { z } from "zod";

import { readJson, withErrorHandling } from "@/lib/api";
import { getRouteUser } from "@/lib/route-user";

const schema = z.object({ status: z.enum(["draft", "active", "paused", "archived"]) });

export const PATCH = withErrorHandling("api/drips/[id]", async (request: Request, context: { params: Promise<{ id: string }> }) => {
  const { supabase, user } = await getRouteUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = schema.safeParse(await readJson(request));
  if (!parsed.success) return NextResponse.json({ error: "Invalid workflow status." }, { status: 400 });
  const { id } = await context.params;
  const { data, error } = await supabase
    .from("drip_workflows")
    .update({ status: parsed.data.status })
    .eq("id", id)
    .eq("user_id", user.id)
    .select("*")
    .maybeSingle();
  if (error) return NextResponse.json({ error: "Could not update workflow." }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Workflow not found." }, { status: 404 });
  return NextResponse.json({ workflow: data });
});
