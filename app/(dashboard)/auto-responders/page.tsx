import { redirect } from "next/navigation";

import { AutoRespondersClient } from "@/components/automation/auto-responders-client";
import { logError } from "@/lib/errors";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function AutoRespondersPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Server-side read with the service role, always scoped to the signed-in user.
  const { data, error } = await getSupabaseAdmin().from("auto_responders").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
  if (error) logError("auto-responders page", error, { step: "load auto_responders" });

  return <AutoRespondersClient initial={data ?? []} loadError={error ? "Auto-responders couldn't be loaded. If you just set this up, apply the automation database migration and refresh." : ""} />;
}
