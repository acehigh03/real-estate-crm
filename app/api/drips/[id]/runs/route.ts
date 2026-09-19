import { NextResponse } from "next/server";

import { withErrorHandling } from "@/lib/api";
import { getWorkflowRuns } from "@/lib/automation/queries";
import { getAuthedAdmin } from "@/lib/route-admin";

/** GET /api/drips/[id]/runs — who is in this workflow, what's next, and when. */
export const GET = withErrorHandling("api/drips/[id]/runs", async (_request: Request, context: { params: Promise<{ id: string }> }) => {
  const auth = await getAuthedAdmin();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await context.params;
  return NextResponse.json({ runs: await getWorkflowRuns(auth.admin, auth.user.id, id) });
});
