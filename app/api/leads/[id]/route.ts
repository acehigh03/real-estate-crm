import { NextResponse } from "next/server";
import { z } from "zod";

import { readJson, withErrorHandling } from "@/lib/api";
import { EDITABLE_STAGES, writeForStage } from "@/lib/board";
import { logError, userFacingError } from "@/lib/errors";
import { getAuthedAdmin } from "@/lib/route-admin";
import { normalizePhone } from "@/lib/utils";
import type { Database, LeadStage } from "@/types/database";

const text = (max: number) => z.string().trim().max(max);
const optionalText = (max: number) => text(max).nullish().transform((value) => (value ? value : null));

const schema = z
  .object({
    first_name: text(80).min(1),
    last_name: text(80),
    phone: text(40),
    property_address: text(200).min(1),
    city: optionalText(80),
    state: optionalText(40),
    zip: optionalText(20),
    email: optionalText(120),
    tag: optionalText(80),
    lead_source: optionalText(80),
    deal_value: z.number().min(0).max(1_000_000_000).nullable(),
    next_follow_up_at: z.string().datetime({ offset: true }).nullable(),
    deadline: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
    stage: z.enum(EDITABLE_STAGES as [LeadStage, ...LeadStage[]]),
  })
  .partial();

type LeadUpdate = Database["public"]["Tables"]["leads"]["Update"];

/** PATCH /api/leads/[id] — edit any subset of a lead's fields (contacts editor, pipeline inline edits). */
export const PATCH = withErrorHandling("api/leads/[id] PATCH", async (request: Request, context: { params: Promise<{ id: string }> }) => {
  const auth = await getAuthedAdmin();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await context.params;
  if (!z.string().uuid().safeParse(id).success) return NextResponse.json({ error: "Invalid lead." }, { status: 400 });

  const parsed = schema.safeParse(await readJson(request));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid lead details." }, { status: 400 });
  const { stage, phone, ...rest } = parsed.data;

  const update: LeadUpdate = { ...rest };
  if (phone !== undefined) {
    const normalized = normalizePhone(phone);
    if (!normalized) return NextResponse.json({ error: "Enter a valid phone number." }, { status: 400 });
    update.phone = normalized;
  }
  if (stage) {
    const write = writeForStage(stage);
    if (write) Object.assign(update, write);
  }
  if (!Object.keys(update).length) return NextResponse.json({ error: "Nothing to update." }, { status: 400 });

  const { data, error } = await auth.admin.from("leads").update(update).eq("id", id).eq("user_id", auth.user.id).select("*").maybeSingle();
  if (error) {
    logError("api/leads/[id] PATCH", error, { leadId: id });
    return NextResponse.json({ error: userFacingError(error, "Couldn't save the lead.") }, { status: 500 });
  }
  if (!data) return NextResponse.json({ error: "Lead not found." }, { status: 404 });
  return NextResponse.json({ lead: data });
});
