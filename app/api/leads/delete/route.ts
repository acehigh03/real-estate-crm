import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";

import { readJson, withErrorHandling } from "@/lib/api";
import { logError, userFacingError } from "@/lib/errors";
import { getRouteUser } from "@/lib/route-user";

const schema = z.object({
  ids: z.array(z.string().uuid()).min(1, "At least one ID required"),
});

export const POST = withErrorHandling("api/leads/delete", async (request: Request) => {
  const { supabase, user } = await getRouteUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await readJson(request);
  if (body === undefined) {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const { data: deleted, error } = await supabase
    .from("leads")
    .delete()
    .eq("user_id", user.id)
    .in("id", parsed.data.ids)
    .select("id");

  if (error) {
    logError("api/leads/delete", error, { count: parsed.data.ids.length });
    return NextResponse.json({ error: userFacingError(error, "Couldn't delete the selected leads.") }, { status: 500 });
  }

  revalidatePath("/leads");
  revalidatePath("/dashboard");
  revalidatePath("/inbox");
  revalidatePath("/pipeline");

  return NextResponse.json({ success: true, deleted: deleted?.length ?? 0 });
});
