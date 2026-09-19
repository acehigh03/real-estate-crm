import { NextResponse } from "next/server";
import { z } from "zod";

import { withErrorHandling } from "@/lib/api";
import { cancelEnrollment, recordHistory } from "@/lib/automation/enrollments";
import { logError, userFacingError } from "@/lib/errors";
import { getAuthedAdmin } from "@/lib/route-admin";

/** POST /api/drips/enrollments/[id]/cancel — stops the enrollment and every send not yet made. */
export const POST = withErrorHandling("api/drips/enrollments/[id]/cancel", async (_request: Request, context: { params: Promise<{ id: string }> }) => {
  const auth = await getAuthedAdmin();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await context.params;
  if (!z.string().uuid().safeParse(id).success) return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  const { admin, user } = auth;

  // Ownership check first: the service role would happily cancel anyone's enrollment.
  const { data: owned } = await admin.from("drip_enrollments").select("id, lead_id, workflow_id, status").eq("id", id).eq("user_id", user.id).maybeSingle();
  if (!owned) return NextResponse.json({ error: "Enrollment not found." }, { status: 404 });
  if (owned.status === "cancelled" || owned.status === "completed") {
    return NextResponse.json({ error: `This enrollment is already ${owned.status}.` }, { status: 400 });
  }

  try {
    await cancelEnrollment(admin, id, "manual");
    const { data: workflow } = await admin.from("drip_workflows").select("name").eq("id", owned.workflow_id).maybeSingle();
    await recordHistory(admin, { user_id: user.id, lead_id: owned.lead_id, automation_type: "drip", automation_name: workflow?.name ?? "Drip", action_taken: "Enrollment cancelled by you", result: "cancelled" });
    return NextResponse.json({ success: true });
  } catch (error) {
    logError("api/drips/enrollments/[id]/cancel", error);
    return NextResponse.json({ error: userFacingError(error, "Couldn't cancel the enrollment.") }, { status: 500 });
  }
});
