import { redirect } from "next/navigation";

import { DripsClient } from "@/components/drips/drips-client";
import { ensureStarterWorkflows } from "@/lib/automation/starter-workflows";
import { logError } from "@/lib/errors";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export default async function TextDripsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // First visit: give the user three starter drips (as drafts) so the page is useful straight away.
  // Idempotent and non-fatal — if it fails (e.g. the migration isn't applied yet) the page still loads.
  try {
    await ensureStarterWorkflows(getSupabaseAdmin(), user.id);
  } catch (error) {
    logError("drips page", error, { step: "seed starter workflows" });
  }

  const [{ data: workflows }, { data: steps }, { data: enrollments }, { count: queued }] = await Promise.all([
    supabase.from("drip_workflows").select("*").eq("user_id", user.id).order("updated_at", { ascending: false }),
    supabase.from("drip_steps").select("*").order("step_number", { ascending: true }),
    supabase.from("drip_enrollments").select("workflow_id, status").eq("user_id", user.id),
    supabase.from("drip_executions").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("status", "queued"),
  ]);

  return <DripsClient workflows={workflows ?? []} steps={steps ?? []} enrollments={enrollments ?? []} queued={queued ?? 0} />;
}
