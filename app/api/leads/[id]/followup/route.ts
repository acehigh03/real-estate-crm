import { NextResponse } from "next/server";
import { z } from "zod";

import { readJson, withErrorHandling } from "@/lib/api";
import { logError, userFacingError } from "@/lib/errors";
import { getAuthedAdmin } from "@/lib/route-admin";

const schema = z.object({
  /** Local calendar date the follow-up is for, yyyy-mm-dd. */
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  /** The exact moment (ISO) used for "overdue" checks; defaults to 9am UTC-5 that day. */
  at: z.string().datetime({ offset: true }).optional(),
  note: z.string().trim().max(300).nullish(),
});

/**
 * POST /api/leads/[id]/followup — schedule a follow-up without changing the lead's stage
 * (the older setFollowup action forces "Follow Up", which would pull a negotiating deal out of Negotiating).
 */
export const POST = withErrorHandling("api/leads/[id]/followup", async (request: Request, context: { params: Promise<{ id: string }> }) => {
  const auth = await getAuthedAdmin();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await context.params;
  if (!z.string().uuid().safeParse(id).success) return NextResponse.json({ error: "Invalid lead." }, { status: 400 });
  const parsed = schema.safeParse(await readJson(request));
  if (!parsed.success) return NextResponse.json({ error: "Choose a valid date." }, { status: 400 });
  const { admin, user } = auth;

  const { data: lead } = await admin.from("leads").select("id").eq("id", id).eq("user_id", user.id).maybeSingle();
  if (!lead) return NextResponse.json({ error: "Lead not found." }, { status: 404 });

  const at = parsed.data.at ?? `${parsed.data.date}T14:00:00.000Z`;
  const { error: followupError } = await admin.from("followups").insert({ lead_id: id, user_id: user.id, due_date: parsed.data.date, note: parsed.data.note ?? null });
  if (followupError) {
    logError("api/leads/[id]/followup", followupError, { step: "insert followup" });
    return NextResponse.json({ error: userFacingError(followupError, "Couldn't schedule the follow-up.") }, { status: 500 });
  }
  const { error } = await admin.from("leads").update({ next_follow_up_at: at }).eq("id", id).eq("user_id", user.id);
  if (error) {
    logError("api/leads/[id]/followup", error, { step: "update lead" });
    return NextResponse.json({ error: userFacingError(error, "Couldn't schedule the follow-up.") }, { status: 500 });
  }
  return NextResponse.json({ ok: true, next_follow_up_at: at });
});
