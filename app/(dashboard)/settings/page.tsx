import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getRouteUser } from "@/lib/route-user";
import { redirect } from "next/navigation";
import { SettingsClient } from "@/components/settings/settings-client";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const { user } = await getRouteUser();
  if (!user) redirect("/login");

  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from("sms_settings")
    .select("auto_send_enabled, send_window_start, send_window_end, timezone")
    .eq("user_id", user.id)
    .maybeSingle();

  const initialSettings = data ?? {
    auto_send_enabled: false,
    send_window_start: "09:00",
    send_window_end: "20:00",
    timezone: "America/Chicago",
  };

  return <SettingsClient initialSettings={initialSettings} />;
}
