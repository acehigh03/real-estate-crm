import { NextResponse } from "next/server";
import { z } from "zod";

import { readJson, withErrorHandling } from "@/lib/api";
import { getRouteUser } from "@/lib/route-user";

const schema = z.object({ lead_ids: z.array(z.string().uuid()).min(1).max(500) });

/** Enrolls selected leads and creates idempotent queued execution rows. It never sends SMS. */
export const POST = withErrorHandling("api/drips/[id]/enroll", async (request: Request, context: { params: Promise<{ id: string }> }) => {
  const { supabase, user } = await getRouteUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = schema.safeParse(await readJson(request));
  if (!parsed.success) return NextResponse.json({ error: "Choose at least one lead to enroll." }, { status: 400 });
  const { id: workflowId } = await context.params;

  const [{ data: workflow }, { data: steps }] = await Promise.all([
    supabase.from("drip_workflows").select("*").eq("id", workflowId).eq("user_id", user.id).maybeSingle(),
    supabase.from("drip_steps").select("*").eq("workflow_id", workflowId).order("step_number"),
  ]);
  if (!workflow) return NextResponse.json({ error: "Workflow not found." }, { status: 404 });
  if (workflow.status !== "active") return NextResponse.json({ error: "Activate the workflow before enrolling leads." }, { status: 400 });
  if (!steps?.length) return NextResponse.json({ error: "This workflow has no message steps." }, { status: 400 });

  const { data: leads, error: leadsError } = await supabase
    .from("leads").select("id, is_dnc, status, last_replied_at").eq("user_id", user.id).in("id", parsed.data.lead_ids);
  if (leadsError) return NextResponse.json({ error: "Could not load selected leads." }, { status: 500 });
  const eligible = (leads ?? []).filter((lead) => !lead.is_dnc && lead.status !== "DNC");
  if (!eligible.length) return NextResponse.json({ error: "All selected leads are opted out or unavailable." }, { status: 400 });

  const now = new Date();
  const enrollmentRows = eligible.map((lead) => ({ user_id: user.id, workflow_id: workflowId, lead_id: lead.id, last_reply_at_enrollment: lead.last_replied_at }));
  const { data: enrolled, error: enrollmentError } = await supabase
    .from("drip_enrollments").upsert(enrollmentRows, { onConflict: "workflow_id,lead_id", ignoreDuplicates: true })
    .select("id, lead_id");
  if (enrollmentError) return NextResponse.json({ error: "Could not enroll the selected leads." }, { status: 500 });

  const executions = (enrolled ?? []).flatMap((enrollment) => {
    let at = now.getTime();
    return steps.map((step) => {
      at += step.delay_minutes * 60_000;
      return { user_id: user.id, enrollment_id: enrollment.id, step_id: step.id, scheduled_for: new Date(at).toISOString() };
    });
  });
  if (executions.length) {
    const { error: executionError } = await supabase.from("drip_executions").upsert(executions, { onConflict: "enrollment_id,step_id", ignoreDuplicates: true });
    if (executionError) return NextResponse.json({ error: "Leads were enrolled, but their send schedule could not be created." }, { status: 500 });
  }

  return NextResponse.json({ enrolled: enrolled?.length ?? 0, skipped: parsed.data.lead_ids.length - eligible.length });
});
