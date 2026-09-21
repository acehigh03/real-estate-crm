import { NextResponse } from "next/server";
import { z } from "zod";

import { readJson, withErrorHandling } from "@/lib/api";
import { COLUMN_BY_KEY, EDITABLE_STAGES, writeForStage, type BoardColumnKey } from "@/lib/board";
import { logError, userFacingError } from "@/lib/errors";
import { getAuthedAdmin } from "@/lib/route-admin";
import type { LeadStage } from "@/types/database";

const schema = z
  .object({
    lead_ids: z.array(z.string().uuid()).min(1).max(500),
    /** A board column (its canonical stage is written) ... */
    column: z.enum(["new", "skip_traced", "contacted", "negotiating", "under_contract", "closed"]).optional(),
    /** ... or an exact stage. */
    stage: z.enum(EDITABLE_STAGES as [LeadStage, ...LeadStage[]]).optional(),
    /** The column's cards in their new top-to-bottom order (persists drag-to-reorder). */
    ordered_ids: z.array(z.string().uuid()).max(500).optional(),
  })
  .refine((value) => value.column || value.stage || value.ordered_ids, { message: "Choose a stage or an order." });

/**
 * POST /api/leads/stage — move leads between stages (drag & drop, bulk change) and/or persist
 * a column's manual order. Always scoped to the caller's own leads.
 */
export const POST = withErrorHandling("api/leads/stage", async (request: Request) => {
  const auth = await getAuthedAdmin();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = schema.safeParse(await readJson(request));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request." }, { status: 400 });
  const { lead_ids, column, stage, ordered_ids } = parsed.data;
  const { admin, user } = auth;

  let moved = 0;
  const target = stage ?? (column ? COLUMN_BY_KEY[column as BoardColumnKey].write.stage : null);
  if (target) {
    const write = writeForStage(target);
    if (!write) return NextResponse.json({ error: "Unknown stage." }, { status: 400 });
    const { data, error } = await admin.from("leads").update(write).eq("user_id", user.id).in("id", lead_ids).select("id");
    if (error) {
      logError("api/leads/stage", error, { step: "move" });
      return NextResponse.json({ error: userFacingError(error, "Couldn't move those leads.") }, { status: 500 });
    }
    moved = data?.length ?? 0;
  }

  // Manual order. If the column hasn't been migrated the move above still succeeded, so this is non-fatal.
  let positioned: boolean | null = null;
  if (ordered_ids?.length) {
    const results = await Promise.all(ordered_ids.map((id, index) => admin.from("leads").update({ pipeline_position: (index + 1) * 10 }).eq("id", id).eq("user_id", user.id)));
    const failed = results.find((result) => result.error);
    positioned = !failed;
    if (failed?.error) logError("api/leads/stage", failed.error, { step: "reorder" });
  }

  return NextResponse.json({ moved, positioned });
});
