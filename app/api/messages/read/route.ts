import { NextResponse } from "next/server";
import { z } from "zod";

import { readJson, withErrorHandling } from "@/lib/api";
import { logError } from "@/lib/errors";
import { getAuthedAdmin } from "@/lib/route-admin";

const schema = z.object({ lead_id: z.string().uuid() });

/** POST /api/messages/read — mark a lead's inbound messages as read (opening a conversation). */
export const POST = withErrorHandling("api/messages/read", async (request: Request) => {
  const auth = await getAuthedAdmin();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = schema.safeParse(await readJson(request));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });

  const { error } = await auth.admin
    .from("messages")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", auth.user.id)
    .eq("lead_id", parsed.data.lead_id)
    .eq("direction", "inbound")
    .is("read_at", null);
  if (error) {
    // read_at doesn't exist until the dashboard migration is applied: not fatal, just not persisted.
    logError("api/messages/read", error);
    return NextResponse.json({ ok: false });
  }
  return NextResponse.json({ ok: true });
});
