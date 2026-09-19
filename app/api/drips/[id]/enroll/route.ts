import { NextResponse } from "next/server";
import { z } from "zod";

import { readJson, withErrorHandling } from "@/lib/api";
import { EnrollError, enrollLeads, previewSteps } from "@/lib/automation/enrollments";
import { logError, userFacingError } from "@/lib/errors";
import { getAuthedAdmin } from "@/lib/route-admin";

const schema = z.object({
  lead_ids: z.array(z.string().uuid()).min(1).max(500),
  /** true = return the rendered messages for each lead and change nothing. */
  preview: z.boolean().optional(),
});

/**
 * POST /api/drips/[id]/enroll
 *   { lead_ids, preview: true }  -> every step rendered with each lead's real data (no writes)
 *   { lead_ids }                 -> enrolls the leads and schedules every step (queue only)
 * Enrolling never sends anything: the cron sends when each step comes due.
 */
export const POST = withErrorHandling("api/drips/[id]/enroll", async (request: Request, context: { params: Promise<{ id: string }> }) => {
  const auth = await getAuthedAdmin();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = schema.safeParse(await readJson(request));
  if (!parsed.success) return NextResponse.json({ error: "Choose at least one lead to enroll." }, { status: 400 });
  const { id: workflowId } = await context.params;
  const { admin, user } = auth;

  try {
    if (parsed.data.preview) {
      const { data: workflow } = await admin.from("drip_workflows").select("id, name, status").eq("id", workflowId).eq("user_id", user.id).maybeSingle();
      if (!workflow) return NextResponse.json({ error: "Workflow not found." }, { status: 404 });
      const { data: steps } = await admin.from("drip_steps").select("step_number, delay_minutes, message").eq("workflow_id", workflowId).order("step_number", { ascending: true });
      const { data: leads } = await admin.from("leads").select("id, first_name, last_name, phone, property_address, city, is_dnc, status").eq("user_id", user.id).in("id", parsed.data.lead_ids);

      return NextResponse.json({
        workflow: { id: workflow.id, name: workflow.name, status: workflow.status },
        previews: (leads ?? []).map((lead) => ({
          lead_id: lead.id,
          name: `${lead.first_name} ${lead.last_name}`.trim() || lead.phone,
          phone: lead.phone,
          blocked: lead.is_dnc || lead.status === "DNC" ? "opted_out" : !lead.phone ? "no_phone" : null,
          steps: previewSteps(steps ?? [], lead),
        })),
      });
    }

    const result = await enrollLeads(admin, { userId: user.id, workflowId, leadIds: parsed.data.lead_ids });
    if (!result.enrolled.length) {
      const reason = result.skipped[0]?.reason ?? "unavailable";
      const message =
        reason === "opted_out" ? "Those leads have opted out and can't be enrolled."
        : reason.startsWith("already_") ? "Those leads are already in this workflow."
        : "None of the selected leads could be enrolled.";
      return NextResponse.json({ error: message, skipped: result.skipped }, { status: 400 });
    }
    return NextResponse.json({ enrolled: result.enrolled.length, skipped: result.skipped.length, details: result });
  } catch (error) {
    if (error instanceof EnrollError) return NextResponse.json({ error: error.message }, { status: error.status });
    logError("api/drips/[id]/enroll", error);
    return NextResponse.json({ error: userFacingError(error, "Couldn't enroll the selected leads.") }, { status: 500 });
  }
});
