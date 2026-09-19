import { NextResponse } from "next/server";
import { z } from "zod";

import { withErrorHandling } from "@/lib/api";
import { getLeadAutomations } from "@/lib/automation/queries";
import { getAuthedAdmin } from "@/lib/route-admin";

/** GET /api/leads/[id]/automations — drip enrollments, full send log and automation history. */
export const GET = withErrorHandling("api/leads/[id]/automations", async (_request: Request, context: { params: Promise<{ id: string }> }) => {
  const auth = await getAuthedAdmin();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await context.params;
  if (!z.string().uuid().safeParse(id).success) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const data = await getLeadAutomations(auth.admin, auth.user.id, id);
  if (!data) return NextResponse.json({ error: "Lead not found." }, { status: 404 });
  return NextResponse.json(data);
});
