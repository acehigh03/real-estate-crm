import { NextResponse } from "next/server";
import { z } from "zod";

import { readJson, withErrorHandling } from "@/lib/api";
import { getAuthedAdmin } from "@/lib/route-admin";
import { getRouteUser } from "@/lib/route-user";

const stepSchema = z.object({
  delay_minutes: z.number().int().min(0).max(525600),
  message: z.string().trim().min(1).max(1600),
});

const workflowSchema = z.object({
  name: z.string().trim().min(1).max(120),
  continue_after_reply: z.boolean().default(false),
  steps: z.array(stepSchema).min(1).max(12),
});

export const POST = withErrorHandling("api/drips", async (request: Request) => {
  const { supabase, user } = await getRouteUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = workflowSchema.safeParse(await readJson(request));
  if (!parsed.success) return NextResponse.json({ error: "Enter a name and at least one message step." }, { status: 400 });

  const { name, continue_after_reply, steps } = parsed.data;
  const { data: workflow, error: workflowError } = await supabase
    .from("drip_workflows")
    .insert({ user_id: user.id, name, continue_after_reply })
    .select("*")
    .single();
  if (workflowError || !workflow) return NextResponse.json({ error: "Could not create the workflow." }, { status: 500 });

  const { error: stepsError } = await supabase.from("drip_steps").insert(
    steps.map((step, index) => ({
      workflow_id: workflow.id,
      step_number: index + 1,
      delay_minutes: step.delay_minutes,
      message: step.message,
    }))
  );
  if (stepsError) {
    await supabase.from("drip_workflows").delete().eq("id", workflow.id).eq("user_id", user.id);
    return NextResponse.json({ error: "Could not save workflow steps." }, { status: 500 });
  }

  return NextResponse.json({ workflow }, { status: 201 });
});

/** GET /api/drips — the user's workflows with their steps (for the enroll pickers). */
export const GET = withErrorHandling("api/drips GET", async () => {
  const auth = await getAuthedAdmin();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: workflows, error } = await auth.admin.from("drip_workflows").select("*").eq("user_id", auth.user.id).order("created_at", { ascending: true });
  if (error) return NextResponse.json({ error: "Couldn't load workflows." }, { status: 500 });
  const ids = (workflows ?? []).map((workflow) => workflow.id);
  const { data: steps } = ids.length
    ? await auth.admin.from("drip_steps").select("*").in("workflow_id", ids).order("step_number", { ascending: true })
    : { data: [] as Array<never> };
  return NextResponse.json({
    workflows: (workflows ?? []).map((workflow) => ({ ...workflow, steps: (steps ?? []).filter((step) => step.workflow_id === workflow.id) })),
  });
});
