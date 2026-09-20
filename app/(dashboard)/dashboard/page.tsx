import { DashboardOverview } from "@/components/dashboard/dashboard-overview";
import { getDashboardStats } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";

/** Read-only owner view. The Inbox remains the operating home for conversations. */
export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const namePart = (user?.email?.split("@")[0] ?? "").replace(/\d+/g, "");
  const userName = namePart.split(/[._-]/).filter(Boolean).map((part) => part[0].toUpperCase() + part.slice(1)).join(" ") || "there";

  const data = await getDashboardStats();
  return <DashboardOverview data={data} userName={userName} />;
}
