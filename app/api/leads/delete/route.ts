import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";

import { getRouteUser } from "@/lib/route-user";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

const schema = z.object({
  ids: z.array(z.string().uuid()).min(1, "At least one ID required"),
});

export async function POST(request: Request) {
  const { user } = await getRouteUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from("leads")
    .delete()
    .eq("user_id", user.id)
    .in("id", parsed.data.ids);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  revalidatePath("/leads");
  revalidatePath("/dashboard");

  return NextResponse.json({ success: true, deleted: parsed.data.ids.length });
}
