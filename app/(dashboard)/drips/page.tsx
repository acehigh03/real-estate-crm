import { redirect } from "next/navigation";

import { DripsClient } from "@/components/drips/drips-client";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function TextDripsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: workflows }, { data: steps }, { data: enrollments }] = await Promise.all([
    supabase.from("drip_workflows").select("*").eq("user_id", user.id).order("updated_at", { ascending: false }),
    supabase.from("drip_steps").select("*").order("step_number", { ascending: true }),
    supabase.from("drip_enrollments").select("workflow_id, status").eq("user_id", user.id),
  ]);

  return <DripsClient workflows={workflows ?? []} steps={steps ?? []} enrollments={enrollments ?? []} />;
}
